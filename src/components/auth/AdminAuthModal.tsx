import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, X, RefreshCw, Key, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { APP_LOGO } from '../../data/initialData';

interface AdminAuthModalProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onGoogleLogin?: () => Promise<boolean> | Promise<void> | void;
  onClose: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ onLogin, onGoogleLogin, onClose }) => {
  const [step, setStep] = useState<'project-key' | 'credentials'>('project-key');
  const [projectKey, setProjectKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const MASTER_PROJECT_KEY = 'DOSSO_2026';

  const handleKeyVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectKey.trim() === MASTER_PROJECT_KEY) {
      setStep('credentials');
      setErrorMessage('');
    } else {
      setErrorMessage('Clé projet invalide');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoggingIn(true);
    try {
      const success = await onLogin(username.trim(), password);
      if (!success) {
        setErrorMessage('Utilisateur ou mot de passe incorrect');
      } else {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-10 space-y-8">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-charcoal dark:text-white">Portail Caisse</h2>
              <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">
                {step === 'project-key' ? 'Niveau 1 : Accès Projet' : 'Niveau 2 : Authentification'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
              {errorMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'project-key' ? (
              <motion.div 
                key="key"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-3xl bg-lapis/10 text-lapis flex items-center justify-center">
                    <Key size={32} />
                  </div>
                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    Saisissez la clé maîtresse de l'institution pour déverrouiller le portail d'administration.
                  </p>
                </div>

                <form onSubmit={handleKeyVerify} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clé d'Accès</label>
                    <input 
                      type="password" 
                      value={projectKey} 
                      onChange={e => setProjectKey(e.target.value)} 
                      className="w-full h-14 text-center text-xl font-mono tracking-[0.5em] rounded-2xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/10 outline-none" 
                      placeholder="••••••••"
                      required 
                      autoFocus
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full h-14 bg-lapis text-white rounded-2xl font-display font-bold text-sm shadow-xl shadow-lapis/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    Vérifier la Clé
                    <ChevronRight size={18} />
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="creds"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Utilisateur</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        className="w-full h-12 pl-12 pr-4 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/10 outline-none text-sm" 
                        placeholder="Identifiant"
                        required 
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full h-12 pl-12 pr-12 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/10 outline-none text-sm font-mono" 
                        placeholder="••••••••"
                        required 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-charcoal">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoggingIn}
                    className="w-full h-14 mt-4 bg-lapis text-white rounded-2xl font-display font-bold text-sm shadow-xl shadow-lapis/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    {isLoggingIn && <RefreshCw size={18} className="animate-spin" />}
                    <span>Se connecter à la Caisse</span>
                  </button>
                </form>

                {onGoogleLogin && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isGoogleLoading}
                      onClick={async () => {
                        setErrorMessage('');
                        setIsGoogleLoading(true);
                        try {
                          const ok = await onGoogleLogin();
                          if (ok === false) {
                            setErrorMessage('Compte Google non autorisé ou connexion annulée.');
                          }
                        } finally {
                          setIsGoogleLoading(false);
                        }
                      }}
                      className="w-full h-12 flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isGoogleLoading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                          <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                        </svg>
                      )}
                      <span>{isGoogleLoading ? 'Connexion en cours...' : 'Authentification Google Admin'}</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStep('project-key');
                    setErrorMessage('');
                  }}
                  className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-charcoal transition-colors cursor-pointer"
                >
                  ← Retour au déverrouillage
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
