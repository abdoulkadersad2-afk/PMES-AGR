import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, User, Banknote } from 'lucide-react';
import { Member } from '../../types';
import { decodeMemberQRPayload } from '../../utils/qrUtils';

interface QRScannerModalProps {
  onClose: () => void;
  members: Member[];
  onResult: (member: Member, action: 'profile' | 'collect') => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, members, onResult }) => {
  const [scannerActive, setScannerActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundMember, setFoundMember] = useState<Member | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const qrCodeSuccessCallback = (decodedText: string) => {
          handleScan(decodedText);
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          undefined
        );
        setScannerActive(true);
      } catch (err) {
        console.error("Erreur scanner:", err);
        setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleScan = (data: string) => {
    const member = decodeMemberQRPayload(data, members);
    if (member) {
      setFoundMember(member);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.pause(true);
      }
    }
  };

  const resetScanner = () => {
    setFoundMember(null);
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
            <Camera className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold font-display text-white">Scanner Livret Membre</h2>
          <p className="text-xs text-slate-400 mt-1">Placez le QR Code du livret face à la caméra</p>
        </div>

        {!foundMember ? (
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-black border-2 border-slate-800 shadow-inner">
            <div id={containerId} className="w-full h-full" />
            {!scannerActive && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Initialisation caméra...</span>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="p-3 rounded-full bg-rose-500/20 mb-3">
                  <X className="w-6 h-6 text-rose-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-amber-500/30 shrink-0">
                {foundMember.photo ? (
                  <img src={foundMember.photo} alt={foundMember.nom} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold">
                    {foundMember.nom.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{foundMember.nom}</h3>
                <div className="text-xs font-mono text-amber-400">{foundMember.livret}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">{foundMember.zone}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onResult(foundMember, 'profile')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-all group"
              >
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 mb-2 group-hover:scale-110 transition">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Voir Profil</span>
              </button>
              <button
                onClick={() => onResult(foundMember, 'collect')}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-all group"
              >
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 mb-2 group-hover:scale-110 transition">
                  <Banknote className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Transaction</span>
              </button>
            </div>

            <button
              onClick={resetScanner}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition"
            >
              Scanner un autre livret
            </button>
          </div>
        )}

        <p className="text-[10px] text-slate-500 text-center mt-6 uppercase tracking-[0.2em] font-bold">
          Système Sécurisé PMES-AGR Dosso
        </p>
      </div>
    </div>
  );
};
