import React, { useRef, useState } from 'react';
import { Member } from '../../types';
import { X, Printer, Shield, QrCode, Camera, Loader2, Download, Copy, Check } from 'lucide-react';
import { compressImageFile } from '../../utils/imageUtils';
import { MemberCard } from './MemberCard';
import { QRCodeCanvas } from 'qrcode.react';
import { encodeMemberQRPayload } from '../../utils/qrUtils';
import jsPDF from 'jspdf';
import { captureElementToCanvas } from '../../utils/pdfCanvasUtils';

interface MemberCardModalProps {
  member: Member | null;
  onClose: () => void;
  onUpdatePhoto?: (memberId: string, photoSource: string | File) => Promise<string | void> | void;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({ member, onClose, onUpdatePhoto }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCanvasWrapperRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'qr'>('card');
  const [copiedId, setCopiedId] = useState(false);

  if (!member) return null;

  const currentPhoto = localPhoto || member.photo;
  const qrPayload = encodeMemberQRPayload(member);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQRPng = () => {
    const canvas = qrCanvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `PMES_QR_${member.id}.png`;
    link.click();
  };

  const handleCopyMemberId = async () => {
    try {
      await navigator.clipboard.writeText(member.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback silencieux si le presse-papier est bloqué
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-member-card');
    if (!element) return;

    setIsGenerating(true);
    setPdfError('');
    try {
      const canvas = await captureElementToCanvas(element, {
        scale: 4, // High quality for cards
        useCORS: true,
        logging: false,
        backgroundColor: null, // Keep transparency
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidthMm = 120;
      const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
      
      const x = (pdfWidth - imgWidthMm) / 2;
      const y = (pdfHeight - imgHeightMm) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidthMm, imgHeightMm);
      pdf.save(`PMES_CARTE_${member.livret}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressedBase64 = await compressImageFile(file, 600, 600, 0.85);
      setLocalPhoto(compressedBase64);
      if (onUpdatePhoto) {
        const uploadedUrl = await onUpdatePhoto(member.id, compressedBase64);
        if (typeof uploadedUrl === 'string' && uploadedUrl) {
          setLocalPhoto(uploadedUrl);
        }
      }
    } catch (err) {
      console.error('Error processing photo:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-[540px] rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 text-slate-100 shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-4 pr-8">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span>Carte d&apos;Adhérent Officielle PMES-AGR</span>
          </h3>

          <div className="flex p-0.5 rounded-xl bg-slate-800 border border-slate-700/80">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Carte
            </button>
            <button
              type="button"
              onClick={() => setViewMode('qr')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'qr'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pass QR Guichet</span>
            </button>
          </div>
        </div>

        {viewMode === 'card' ? (
          <div id="printable-member-card" className="flex justify-center p-2 bg-transparent">
            <MemberCard member={member} currentPhoto={localPhoto} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 text-center">
            <div
              ref={qrCanvasWrapperRef}
              className="p-4 rounded-2xl bg-white shadow-xl"
            >
              <QRCodeCanvas
                value={qrPayload}
                size={196}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
                includeMargin={false}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-white font-display">{member.nom}</div>
              <div className="text-xs font-mono text-amber-300">
                {member.livret} · ID : {member.id}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Présentez ce QR code au guichet pour un pointage et un lancement immédiat de vos opérations.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyMemberId}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                <span>{copiedId ? 'ID copié' : 'Copier ID'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadQRPng}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger QR (PNG)</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons (Print & Photo Upload) */}
        <div className="no-print mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {onUpdatePhoto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Camera className="w-4 h-4 text-amber-400" />
                )}
                <span>{currentPhoto ? 'Changer la photo' : 'Prendre une photo'}</span>
              </button>
            )}

            {viewMode === 'card' && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>PDF (A4)</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer</span>
                </button>
              </div>
            )}
          </div>
          
          {pdfError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center">
              {pdfError}
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 text-center leading-relaxed italic">
              Note : Le QR code officiel encode l&apos;identifiant adhérent ({member.id}) et le numéro de livret pour une identification instantanée au guichet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
