import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut,
} from 'firebase/auth';
import { phoneAuth } from '../lib/firebase';
import type { OTPSendResponse, OTPVerifyResponse } from '../utils/smsUtils';

let activeRecaptchaVerifier: RecaptchaVerifier | null = null;
let activeConfirmationResult: ConfirmationResult | null = null;
let activePhoneNumber = '';

export function formatNigerPhoneE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.startsWith('227') && digitsOnly.length === 11) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 8) {
    return `+227${digitsOnly}`;
  }
  return null;
}

export function resetFirebaseRecaptcha(): void {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch {
      // Ignore cleanup errors if container was already unmounted
    }
    activeRecaptchaVerifier = null;
  }
}

function mapFirebasePhoneError(err: any): {
  message: string;
  code: string;
  requiresConsoleSetup?: boolean;
} {
  const code: string = err?.code || 'auth/unknown';
  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        code,
        requiresConsoleSetup: true,
        message:
          'Le fournisseur "Téléphone (Phone)" n\'est pas encore activé dans Firebase Console (Authentication → Sign-in method).',
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        requiresConsoleSetup: true,
        message: `Le domaine actuel (${window.location.hostname}) doit être ajouté aux domaines autorisés dans Firebase Console → Authentication → Settings.`,
      };
    case 'auth/billing-not-enabled':
      return {
        code,
        requiresConsoleSetup: true,
        message:
          'Firebase Phone Auth nécessite le plan Blaze ou l\'utilisation de numéros de test configurés dans Firebase Console.',
      };
    case 'auth/invalid-phone-number':
      return {
        code,
        message: 'Numéro de téléphone invalide pour l\'envoi SMS (+227 requis).',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Trop de tentatives Firebase SMS. Patientez quelques minutes ou utilisez la passerelle serveur.',
      };
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return {
        code,
        requiresConsoleSetup: true,
        message: 'Vérification reCAPTCHA refusée. Vérifiez les domaines autorisés dans Firebase Console.',
      };
    case 'auth/invalid-verification-code':
      return {
        code,
        message: 'Code OTP Firebase incorrect. Vérifiez les 6 chiffres reçus par SMS.',
      };
    case 'auth/code-expired':
    case 'auth/session-expired':
      return {
        code,
        message: 'Ce code OTP Firebase a expiré. Demandez un nouvel envoi.',
      };
    default:
      return {
        code,
        message: err?.message || 'Erreur Firebase Phone Authentication.',
      };
  }
}

export async function sendFirebasePhoneOTP(
  telephone: string,
  recaptchaContainerId = 'firebase-recaptcha-container'
): Promise<OTPSendResponse> {
  const formatted = formatNigerPhoneE164(telephone);
  if (!formatted) {
    return {
      success: false,
      provider: 'firebase-phone',
      error: 'Numéro invalide. Saisissez 8 chiffres Niger (ex: 96 00 00 00).',
    };
  }

  try {
    const containerEl = document.getElementById(recaptchaContainerId);
    if (!containerEl) {
      return {
        success: false,
        provider: 'firebase-phone',
        error: 'Conteneur reCAPTCHA introuvable dans le modal.',
      };
    }

    resetFirebaseRecaptcha();
    phoneAuth.languageCode = 'fr';

    activeRecaptchaVerifier = new RecaptchaVerifier(phoneAuth, recaptchaContainerId, {
      size: 'invisible',
    });

    activeConfirmationResult = await signInWithPhoneNumber(
      phoneAuth,
      formatted,
      activeRecaptchaVerifier
    );
    activePhoneNumber = formatted;

    return {
      success: true,
      provider: 'firebase-phone',
      telephone: formatted,
      expiresIn: 300,
      cooldownSeconds: 60,
      message: `Code OTP envoyé par Firebase Auth au ${formatted}`,
    };
  } catch (err: any) {
    resetFirebaseRecaptcha();
    const mapped = mapFirebasePhoneError(err);
    return {
      success: false,
      provider: 'firebase-phone',
      error: mapped.message,
      errorCode: mapped.code,
      requiresConsoleSetup: mapped.requiresConsoleSetup,
    };
  }
}

export async function verifyFirebasePhoneOTP(
  telephone: string,
  code: string
): Promise<OTPVerifyResponse> {
  const formatted = formatNigerPhoneE164(telephone);
  if (!activeConfirmationResult || (formatted && activePhoneNumber !== formatted)) {
    return {
      success: false,
      provider: 'firebase-phone',
      error: 'Session OTP Firebase expirée ou introuvable. Veuillez renvoyer le code.',
    };
  }

  try {
    const cleanCode = code.replace(/\D/g, '');
    const credential = await activeConfirmationResult.confirm(cleanCode);
    const firebaseUid = credential.user.uid;

    activeConfirmationResult = null;
    resetFirebaseRecaptcha();

    // Déconnexion immédiate de l'instance secondaire pour garder l'authentification par téléphone stateless
    await signOut(phoneAuth).catch(() => {});

    return {
      success: true,
      provider: 'firebase-phone',
      firebaseUid,
      message: 'Numéro vérifié avec succès via Firebase Phone Auth.',
    };
  } catch (err: any) {
    const mapped = mapFirebasePhoneError(err);
    return {
      success: false,
      provider: 'firebase-phone',
      error: mapped.message,
    };
  }
}
