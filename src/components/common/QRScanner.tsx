import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Search, X } from 'lucide-react';
import { motion } from 'motion/react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  errorMessage?: string;
  title?: string;
  subtitle?: string;
  helperText?: string;
  manualPlaceholder?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onClose,
  errorMessage,
  title = 'Scanner QR Code',
  subtitle = 'Scanner une carte adhérent ou un reçu QR',
  helperText = 'Placez le code QR à l\'intérieur du cadre pour identifier l\'adhérent ou le reçu automatiquement.',
  manualPlaceholder = 'Ex: REC-DOSSO-2026-0042 ou PMES|...',
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        const now = Date.now();
        if (
          lastScanRef.current.text === decodedText &&
          now - lastScanRef.current.at < 1500
        ) {
          return;
        }
        lastScanRef.current = { text: decodedText, at: now };
        onScanRef.current(decodedText);
      },
      () => {
        // Suppress errors for frame noise
      }
    );

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualInput.trim();
    if (!cleaned) return;
    onScanRef.current(cleaned);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b hairline flex items-center justify-between bg-paper dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-display font-bold text-charcoal dark:text-white">{title}</h2>
            <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 hairline flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-4">
          <div id="qr-reader" className="w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700" />
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={manualPlaceholder}
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-charcoal dark:text-white outline-none focus:border-lapis"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-lapis text-white text-xs font-bold hover:bg-lapis/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Vérifier
            </button>
          </form>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs text-center leading-relaxed font-medium">
            {helperText}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
