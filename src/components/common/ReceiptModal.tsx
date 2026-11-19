import React, { useRef, useState } from 'react';
import { ReceiptData } from '../../types';
import { APP_LOGO } from '../../data/initialData';
import { Printer, Share2, X, FileDown, Loader2, Check } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  downloadReceiptPDF,
  getReceiptAmountLabel,
  getReceiptTypeLabel,
} from '../../utils/receiptPdfUtils';
import { encodeReceiptQRPayload } from '../../utils/qrUtils';

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfFormat, setPdfFormat] = useState<'a4' | 'ticket'>('a4');
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const qrPayload = encodeReceiptQRPayload(receipt);
  const parsedReceiptDate = new Date(receipt.date);
  const formattedReceiptDate = Number.isNaN(parsedReceiptDate.getTime())
    ? '---'
    : parsedReceiptDate.toLocaleString('fr-FR');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async (selectedFormat: 'a4' | 'ticket' = pdfFormat) => {
    const ticketElement = document.getElementById('printable-receipt');
    const qrCanvas = qrCanvasRef.current?.querySelector('canvas');
    const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : undefined;

    setIsGenerating(true);
    setPdfError('');
    setPdfDownloaded(false);

    try {
      await downloadReceiptPDF(receipt, {
        format: selectedFormat,
        ticketElement,
        qrDataUrl,
      });
      setPdfDownloaded(true);
      setTimeout(() => setPdfDownloaded(false), 3000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // En cas d'échec de capture DOM pour le ticket, bascule vers le PDF vectoriel A4 garanti
      if (selectedFormat === 'ticket') {
        try {
          await downloadReceiptPDF(receipt, { format: 'a4', qrDataUrl });
          setPdfDownloaded(true);
          setTimeout(() => setPdfDownloaded(false), 3000);
          return;
        } catch {
          // Laisse le message d'erreur ci-dessous
        }
      }
      setPdfError('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  const whatsappText = `*PMES-AGR DOSSO - REÇU OFFICIEL*
Date: ${formattedReceiptDate}
Réf: ${receipt.reference}
Membre: ${receipt.memberNom}
Livret: ${receipt.memberLivret}
Zone: ${receipt.zone}
Opération: ${getReceiptTypeLabel(receipt.type)}
Montant: ${receipt.montant.toLocaleString('fr-FR')} F CFA${receipt.soldeApres !== undefined ? `\nNouveau Solde: ${receipt.soldeApres.toLocaleString('fr-FR')} F CFA` : ''}
Agent: @${receipt.agentNom}`;

  const smsText = `PMES-AGR DOSSO: ${getReceiptTypeLabel(receipt.type)} de ${receipt.montant.toLocaleString('fr-FR')} F CFA pour ${receipt.memberNom} (${receipt.memberLivret}).${receipt.soldeApres !== undefined ? ` Solde: ${receipt.soldeApres.toLocaleString('fr-FR')} F CFA.` : ''} Ref: ${receipt.reference}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-[420px] rounded-3xl bg-slate-900 border border-slate-700/80 p-6 text-slate-100 shadow-2xl relative my-auto">
        <button
          type="button"
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Canvas QR caché pour export vectoriel A4 */}
        <div ref={qrCanvasRef} className="hidden" aria-hidden="true">
          <QRCodeCanvas value={qrPayload} size={160} level="M" bgColor="#ffffff" fgColor="#0f172a" />
        </div>

        {/* Printable Ticket Section */}
        <div id="printable-receipt" className="bg-white text-slate-900 p-5 rounded-2xl shadow-inner font-mono text-xs border border-slate-300">
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-400 pb-3">
            <img
              src={APP_LOGO}
              alt="Logo PMES-AGR"
              className="w-10 h-10 object-contain rounded-full mx-auto mb-1 border border-amber-500/40"
            />
            <div className="text-slate-900 font-bold text-sm tracking-wide">
              PMES-AGR DOSSO
            </div>
            <div className="text-[10px] text-slate-600">Programme Municipal d&apos;Épargne &amp; d&apos;Appui aux AGR</div>
            <div className="text-[9px] text-slate-500">Commune Urbaine de Dosso • République du Niger</div>
            <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 font-bold text-[10px] uppercase">
              {getReceiptTypeLabel(receipt.type)}
            </div>
          </div>

          {/* Details */}
          <div className="py-3 space-y-1.5 border-b border-dashed border-slate-400 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Réf :</span>
              <span className="font-bold text-slate-900 text-right">{receipt.reference}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Date :</span>
              <span className="text-right">{formattedReceiptDate}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Livret :</span>
              <span className="font-bold text-amber-800 text-right">{receipt.memberLivret}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Titulaire :</span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px] text-right">{receipt.memberNom}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Téléphone :</span>
              <span className="text-right">+227 {receipt.memberTelephone}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Zone / Caisse :</span>
              <span className="text-right">{receipt.zone}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Agent caisse :</span>
              <span className="text-right">@{receipt.agentNom}</span>
            </div>
            {receipt.motif && (
              <div className="flex justify-between gap-2 pt-1">
                <span className="text-slate-500 shrink-0">Motif :</span>
                <span className="text-right text-slate-700 break-words max-w-[210px]">{receipt.motif}</span>
              </div>
            )}
          </div>

          {/* Financials */}
          <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
            {receipt.soldeAvant !== undefined && (
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Solde précédent :</span>
                <span>{receipt.soldeAvant.toLocaleString('fr-FR')} F</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg text-slate-900">
              <span className="font-bold text-xs uppercase tracking-wide">
                {getReceiptAmountLabel(receipt.type)} :
              </span>
              <span className="font-extrabold text-sm text-emerald-700">
                {receipt.montant.toLocaleString('fr-FR')} F CFA
              </span>
            </div>
            {receipt.soldeApres !== undefined && (
              <div className="flex justify-between font-bold text-slate-900 text-xs pt-1">
                <span>NOUVEAU SOLDE :</span>
                <span className="text-amber-700">{receipt.soldeApres.toLocaleString('fr-FR')} F CFA</span>
              </div>
            )}
          </div>

          {/* Real QR code and verification badge */}
          <div className="pt-3 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-white border-2 border-slate-900 p-1 rounded-md flex items-center justify-center my-1">
              <QRCodeSVG
                value={qrPayload}
                size={68}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
                includeMargin={false}
              />
            </div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">Vérification numérique sécurisée PMES</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Conservez ce reçu comme preuve officielle</div>
          </div>
        </div>

        {/* Action Buttons (Hidden when printing) */}
        <div className="no-print mt-5 space-y-3">
          {pdfError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center">
              {pdfError}
            </div>
          )}

          {/* Sélecteur de format PDF */}
          <div className="flex items-center justify-between gap-2 p-1 rounded-xl bg-slate-800/80 border border-slate-700/70">
            <span className="text-[11px] font-semibold text-slate-400 pl-2.5">Format PDF :</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPdfFormat('a4')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  pdfFormat === 'a4' ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                A4 Officiel
              </button>
              <button
                type="button"
                onClick={() => setPdfFormat('ticket')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  pdfFormat === 'ticket' ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                Ticket 80mm
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPDF(pdfFormat)}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pdfDownloaded ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{pdfDownloaded ? 'PDF enregistré' : 'Télécharger PDF'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
            <a
              href={`sms:${receipt.memberTelephone}?body=${encodeURIComponent(smsText)}`}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
            >
              <span>Envoyer SMS</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
