import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, X, Smartphone, CheckCircle } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);

  // If already running as standalone app, show small badge or nothing
  if (isInstalled) {
    return (
      <div className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium ${className}`}>
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        <span>PWA Installée</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btnInstallPWA"
        onClick={install}
        className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer ${className}`}
        title="Installer l'application sur votre écran d'accueil"
      >
        <Download className="w-4 h-4" />
        <span>Installer l'App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btnInstallPWA"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 h-9 px-3 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-semibold text-xs transition cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Installer iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-center text-white font-display">
                Installer sur iPhone / iPad
              </h3>
              
              <p className="mt-2 text-xs text-slate-300 text-center leading-relaxed">
                Profitez du mode hors-ligne complet et d'un accès rapide depuis votre écran d'accueil :
              </p>

              <div className="mt-4 space-y-3 bg-slate-800/60 rounded-xl p-3.5 text-xs border border-slate-700/60">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>Appuyez sur le bouton <strong className="text-amber-400 inline-flex items-center gap-1"><Share2 className="w-3 h-3 inline" /> Partager</strong> dans la barre Safari.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>Faites défiler vers le bas et touchez <strong className="text-white">« Sur l'écran d'accueil »</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>Confirmez en haut à droite avec <strong className="text-emerald-400">« Ajouter »</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-white border border-slate-700"
              >
                J'ai compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback banner trigger for desktop / other browsers
  return (
    <>
      <button
        id="btnInstallPWA"
        type="button"
        onClick={() => setShowDesktopGuide(true)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-400 font-semibold text-xs transition cursor-pointer ${className}`}
        title="Application Web Progressive"
      >
        <Download className="w-3.5 h-3.5" />
        <span>PWA App</span>
      </button>

      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowDesktopGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Download className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-white font-display">
              Installer PMES-AGR Dosso
            </h3>

            <p className="mt-3 text-xs text-slate-300 text-center leading-relaxed">
              Pour installer l&apos;application sur votre ordinateur ou smartphone Android : cliquez sur l&apos;icône d&apos;installation dans la barre d&apos;adresse de votre navigateur ou ouvrez le menu <strong className="text-white">Options → Installer l&apos;application</strong>.
            </p>

            <button
              type="button"
              onClick={() => setShowDesktopGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-white border border-slate-700 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
