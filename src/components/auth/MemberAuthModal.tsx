import React, { useState, useEffect } from 'react';
import { ZoneItem, Corporation, Member } from '../../types';
import { OTPSendResponse, OTPVerifyResponse, OTPChannel } from '../../utils/smsUtils';
import { resetFirebaseRecaptcha } from '../../services/firebasePhoneAuth';
import { compressImageFile } from '../../utils/imageUtils';
import { Eye, EyeOff, X, Shield, RefreshCw, ChevronRight, KeyRound, Clock, Camera, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MemberAuthModalProps {
  zones: ZoneItem[];
  corporations: Corporation[];
  initialMode?: 'login' | 'register';
  onLogin: (telephone: string, pin: string) => Promise<boolean>;
  onRegister: (nom: string, telephone: string, pin: string, zone: string, corporationId: string, photo?: string) => Promise<boolean>;
  onSendOTP: (telephone: string, channel?: OTPChannel) => Promise<OTPSendResponse>;
  onVerifyOTP: (telephone: string, code: string, channel?: OTPChannel) => Promise<OTPVerifyResponse>;
  onResetPin: (telephone: string, newPin: string) => Promise<boolean>;
  onClose: () => void;
  members: Member[];
}

export const MemberAuthModal: React.FC<MemberAuthModalProps> = ({
  zones,
  corporations,
  initialMode = 'login',
  onLogin,
  onRegister,
  onSendOTP,
  onVerifyOTP,
  onResetPin,
  onClose,
  members,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset-pin'>(initialMode);
  const [flowStep, setFlowStep] = useState<'form' | 'otp'>('form');
  const [otpChannel, setOtpChannel] = useState<OTPChannel>('firebase');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [requiresConsoleSetup, setRequiresConsoleSetup] = useState(false);

  // Form States
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [nom, setNom] = useState('');
  const [zone, setZone] = useState(zones[0]?.nom || '');
  const [corpo, setCorpo] = useState(corporations[0]?.id || '');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
  const [otp, setOtp] = useState('');

  // Real OTP metadata & timers
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresCountdown, setExpiresCountdown] = useState(0);
  const [otpMeta, setOtpMeta] = useState<{ provider?: string; sandboxCode?: string; telephone?: string } | null>(null);

  useEffect(() => {
    if (!zone && zones.length > 0) setZone(zones[0].nom);
  }, [zones, zone]);

  useEffect(() => {
    if (!corpo && corporations.length > 0) setCorpo(corporations[0].id);
  }, [corporations, corpo]);

  useEffect(() => {
    return () => {
      resetFirebaseRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (expiresCountdown <= 0) return;
    const timer = setInterval(() => {
      setExpiresCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresCountdown]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 600, 600, 0.85);
      setPhotoPreview(compressed);
    } catch (err) {
      console.error('Erreur compression photo:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setRequiresConsoleSetup(false);
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    if (cleanTel.length !== 8) return setErrorMessage('Téléphone invalide (8 chiffres requis)');
    setIsLoggingIn(true);
    try {
      const success = await onLogin(cleanTel, pin);
      if (!success) setErrorMessage('Identifiants incorrects ou compte non validé');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const triggerOtpDispatch = async (cleanTel: string, channelOverride?: OTPChannel) => {
    const targetChannel = channelOverride ?? otpChannel;
    setIsSendingOtp(true);
    setErrorMessage('');
    setRequiresConsoleSetup(false);
    const res = await onSendOTP(cleanTel, targetChannel);
    setIsSendingOtp(false);

    if (res.success) {
      setOtp('');
      setOtpMeta({
        provider: res.provider,
        sandboxCode: res.sandboxCode,
        telephone: res.telephone || `+227${cleanTel}`,
      });
      setResendCooldown(res.cooldownSeconds || 60);
      setExpiresCountdown(res.expiresIn || 300);
      setFlowStep('otp');
      return true;
    } else {
      if (res.retryAfterSeconds) {
        setResendCooldown(res.retryAfterSeconds);
      }
      setRequiresConsoleSetup(Boolean(res.requiresConsoleSetup));
      setErrorMessage(res.error || "Impossible d'envoyer le code OTP.");
      return false;
    }
  };

  const handleRegisterStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (nom.trim().length < 2) return setErrorMessage('Veuillez saisir votre nom complet');
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    if (cleanTel.length !== 8) return setErrorMessage('Téléphone invalide (8 chiffres requis)');
    if (pin.length !== 4) return setErrorMessage('Code PIN invalide (4 chiffres requis)');
    if (members.some((m) => m.telephone === cleanTel)) return setErrorMessage('Ce numéro est déjà associé à un livret');

    await triggerOtpDispatch(cleanTel);
  };

  const handleResetPinStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    if (cleanTel.length !== 8) return setErrorMessage('Téléphone invalide (8 chiffres requis)');
    if (newPin.length !== 4) return setErrorMessage('Nouveau code PIN invalide (4 chiffres requis)');
    if (!members.some((m) => m.telephone === cleanTel)) {
      return setErrorMessage('Aucun livret trouvé pour ce numéro de téléphone');
    }

    await triggerOtpDispatch(cleanTel);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    await triggerOtpDispatch(cleanTel);
  };

  const handleFallbackToServerOtp = async () => {
    setOtpChannel('server');
    setRequiresConsoleSetup(false);
    setErrorMessage('');
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    if (cleanTel.length === 8) {
      await triggerOtpDispatch(cleanTel, 'server');
    }
  };

  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (otp.length !== 6) {
      return setErrorMessage('Veuillez saisir les 6 chiffres du code de vérification.');
    }

    setIsVerifying(true);
    const cleanTel = tel.replace(/\D/g, '').slice(-8);
    const verification = await onVerifyOTP(cleanTel, otp, otpChannel);

    if (!verification.success) {
      setErrorMessage(verification.error || 'Code de vérification incorrect ou expiré.');
      setIsVerifying(false);
      return;
    }

    if (mode === 'reset-pin') {
      const updated = await onResetPin(cleanTel, newPin);
      setIsVerifying(false);
      if (updated) {
        setMode('login');
        setFlowStep('form');
        setPin('');
        setNewPin('');
        setOtp('');
        setErrorMessage('');
      }
      return;
    }

    const success = await onRegister(nom.trim(), cleanTel, pin, zone || zones[0]?.nom || 'Dosso Centre', corpo || corporations[0]?.id || '', photoPreview);
    setIsVerifying(false);
    if (success) {
      setMode('login');
      setFlowStep('form');
      setOtp('');
      setPhotoPreview(undefined);
      setErrorMessage('');
    }
  };

  const switchMode = (nextMode: 'login' | 'register' | 'reset-pin') => {
    setMode(nextMode);
    setFlowStep('form');
    setErrorMessage('');
    setRequiresConsoleSetup(false);
    setOtp('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden my-auto"
      >
        <div className="p-8 sm:p-10 space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-bold text-charcoal dark:text-white">
                {flowStep === 'otp'
                  ? 'Vérification SMS'
                  : mode === 'login'
                    ? 'Espace Membre'
                    : mode === 'register'
                      ? 'Nouveau Livret'
                      : 'Réinitialiser le PIN'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {flowStep === 'otp'
                  ? `Code envoyé au ${otpMeta?.telephone || `+227 ${tel}`}`
                  : mode === 'reset-pin'
                    ? 'Confirmez votre identité par SMS'
                    : 'Accédez à vos services financiers'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold text-center space-y-2.5">
              <div>{errorMessage}</div>
              {requiresConsoleSetup && otpChannel === 'firebase' && (
                <button
                  type="button"
                  onClick={handleFallbackToServerOtp}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-lapis dark:text-blue-300 border border-lapis/20 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Utiliser la passerelle Serveur / Sandbox
                </button>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {flowStep === 'form' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Tab Select */}
                {mode !== 'reset-pin' && (
                  <div className="flex p-1 bg-paper dark:bg-slate-800 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        mode === 'login'
                          ? 'bg-white dark:bg-slate-700 text-lapis dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-charcoal dark:hover:text-white'
                      }`}
                    >
                      Connexion
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        mode === 'register'
                          ? 'bg-white dark:bg-slate-700 text-lapis dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-charcoal dark:hover:text-white'
                      }`}
                    >
                      S&apos;inscrire
                    </button>
                  </div>
                )}

                <form
                  onSubmit={
                    mode === 'login'
                      ? handleLogin
                      : mode === 'register'
                        ? handleRegisterStart
                        : handleResetPinStart
                  }
                  className="space-y-4"
                >
                  {mode === 'register' && (
                    <div className="flex items-center gap-4">
                      <label className="relative w-14 h-14 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer shrink-0 group">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                        ) : (
                          <Camera size={18} className="text-slate-400 group-hover:text-lapis transition-colors" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nom complet</label>
                          {photoPreview && (
                            <button
                              type="button"
                              onClick={() => setPhotoPreview(undefined)}
                              className="text-[11px] text-rose-500 hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 size={11} /> Retirer photo
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/20 outline-none text-sm text-charcoal dark:text-white"
                          placeholder="Votre nom complet"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Téléphone (+227)</label>
                    <input
                      type="tel"
                      value={tel}
                      onChange={(e) => setTel(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/20 outline-none text-sm font-mono tabular text-charcoal dark:text-white"
                      placeholder="96 00 00 00"
                      required
                    />
                  </div>

                  {mode === 'reset-pin' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Nouveau code PIN (4 chiffres)
                      </label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/20 outline-none text-sm font-mono tracking-widest text-charcoal dark:text-white"
                          placeholder="••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-charcoal dark:hover:text-white"
                        >
                          {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Code PIN (4 chiffres)
                        </label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => switchMode('reset-pin')}
                            className="text-xs font-semibold text-lapis dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <KeyRound size={12} />
                            PIN oublié ?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border-none focus:ring-2 focus:ring-lapis/20 outline-none text-sm font-mono tracking-widest text-charcoal dark:text-white"
                          placeholder="••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-charcoal dark:hover:text-white"
                        >
                          {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'register' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Zone</label>
                        <select
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-paper dark:bg-slate-800 border-none text-xs text-charcoal dark:text-white outline-none"
                        >
                          {zones.map((z) => (
                            <option key={z.id} value={z.nom}>
                              {z.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Corporation</label>
                        <select
                          value={corpo}
                          onChange={(e) => setCorpo(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-paper dark:bg-slate-800 border-none text-xs text-charcoal dark:text-white outline-none"
                        >
                          {corporations.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.emoji} {c.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {mode !== 'login' && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        Canal de vérification SMS (OTP)
                      </span>
                      <div className="flex p-1 bg-paper dark:bg-slate-800 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setOtpChannel('firebase');
                            setRequiresConsoleSetup(false);
                            setErrorMessage('');
                          }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                            otpChannel === 'firebase'
                              ? 'bg-white dark:bg-slate-700 text-lapis dark:text-white shadow-sm'
                              : 'text-slate-500 hover:text-charcoal dark:hover:text-white'
                          }`}
                        >
                          Firebase Phone Auth
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpChannel('server');
                            setRequiresConsoleSetup(false);
                            setErrorMessage('');
                          }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                            otpChannel === 'server'
                              ? 'bg-white dark:bg-slate-700 text-lapis dark:text-white shadow-sm'
                              : 'text-slate-500 hover:text-charcoal dark:hover:text-white'
                          }`}
                        >
                          Passerelle Serveur
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn || isSendingOtp}
                    className="w-full h-12 mt-2 bg-lapis text-white rounded-xl font-display font-bold text-sm shadow-lg shadow-lapis/20 hover:bg-lapis/90 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {(isLoggingIn || isSendingOtp) && <RefreshCw size={16} className="animate-spin" />}
                    <span>
                      {mode === 'login'
                        ? 'Se connecter'
                        : mode === 'register'
                          ? 'Envoyer le code SMS'
                          : 'Recevoir le code OTP'}
                    </span>
                    <ChevronRight size={16} />
                  </button>

                  {mode === 'reset-pin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-charcoal dark:hover:text-white transition-colors"
                    >
                      Retour à la connexion
                    </button>
                  )}
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gold/10 text-gold flex items-center justify-center">
                    <Shield size={28} />
                  </div>

                  <div className="text-center space-y-2 w-full">
                    <label htmlFor="otp-code-input" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Saisissez le code à 6 chiffres
                    </label>
                    <input
                      id="otp-code-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full py-3 text-center text-3xl font-mono font-bold tracking-[0.35em] tabular outline-none bg-paper dark:bg-slate-800 rounded-2xl text-charcoal dark:text-white focus:ring-2 focus:ring-gold/30"
                      placeholder="000000"
                      autoFocus
                    />
                  </div>

                  {/* Expiration & Provider Feedback */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular">
                    <Clock size={13} />
                    <span>
                      {otpMeta?.provider === 'firebase-phone' && 'Firebase Auth · '}
                      {expiresCountdown > 0
                        ? `Expire dans ${formatCountdown(expiresCountdown)}`
                        : 'Code expiré, demandez un nouvel envoi'}
                    </span>
                  </div>

                  {otpMeta?.provider === 'sandbox' && otpMeta?.sandboxCode && (
                    <div className="w-full p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1 text-center">
                      <div className="font-semibold">
                        Mode Sandbox SMS (passerelle SMS non configurée)
                      </div>
                      <div>
                        Code de test généré par le serveur :{' '}
                        <span className="font-mono font-bold tabular tracking-wider select-all">
                          {otpMeta.sandboxCode}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleOTPVerify} className="space-y-3">
                  <button
                    type="submit"
                    disabled={isVerifying || otp.length !== 6}
                    className="w-full h-12 bg-gold text-white rounded-xl font-display font-bold text-sm shadow-lg shadow-gold/20 hover:bg-gold/90 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying && <RefreshCw size={16} className="animate-spin" />}
                    <span>
                      {mode === 'reset-pin' ? 'Valider et modifier le PIN' : "Confirmer l'inscription"}
                    </span>
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setFlowStep('form')}
                      className="font-semibold text-slate-500 hover:text-charcoal dark:hover:text-white transition-colors"
                    >
                      Modifier le numéro
                    </button>

                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isSendingOtp}
                      onClick={handleResendOtp}
                      className="font-semibold text-lapis dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline tabular"
                    >
                      {isSendingOtp
                        ? 'Envoi...'
                        : resendCooldown > 0
                          ? `Renvoyer dans ${resendCooldown}s`
                          : 'Renvoyer le code'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conteneur invisible requis par Firebase RecaptchaVerifier */}
          <div id="firebase-recaptcha-container" className="hidden" />
        </div>
      </motion.div>
    </div>
  );
};
