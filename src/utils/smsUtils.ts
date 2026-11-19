/**
 * Service de communication SMS & OTP pour PMES-AGR Dosso
 * Permet d'envoyer des confirmations transactionnelles et des codes OTP vérifiés côté serveur
 */

export interface SMSPayload {
  to: string;
  message: string;
  type?: 'transaction' | 'system';
}

export type OTPChannel = 'firebase' | 'server';

export interface OTPSendResponse {
  success: boolean;
  provider?: 'firebase-phone' | 'sms-gateway' | 'sandbox';
  telephone?: string;
  expiresIn?: number;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
  sandboxCode?: string;
  message?: string;
  error?: string;
  errorCode?: string;
  requiresConsoleSetup?: boolean;
}

export interface OTPVerifyResponse {
  success: boolean;
  provider?: string;
  firebaseUid?: string;
  attemptsRemaining?: number;
  message?: string;
  error?: string;
}

export const sendSMS = async (payload: SMSPayload): Promise<boolean> => {
  try {
    let phone = payload.to.replace(/\s/g, '');
    if (/^\d{8}$/.test(phone)) {
      phone = `+227${phone}`;
    }

    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        to: phone,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("Erreur lors de l'envoi du SMS:", error);
    return false;
  }
};

export const requestOTP = async (telephone: string): Promise<OTPSendResponse> => {
  try {
    const response = await fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telephone }),
    });
    const data = await response.json();
    return {
      success: data.success === true,
      provider: data.provider,
      telephone: data.telephone,
      expiresIn: data.expiresIn,
      cooldownSeconds: data.cooldownSeconds,
      retryAfterSeconds: data.retryAfterSeconds,
      sandboxCode: data.sandboxCode,
      message: data.message,
      error: data.error,
    };
  } catch (error) {
    console.error('OTP Request Error:', error);
    return {
      success: false,
      error: 'Impossible de joindre le serveur OTP.',
    };
  }
};

export const verifyOTP = async (telephone: string, code: string): Promise<OTPVerifyResponse> => {
  try {
    const response = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telephone, code }),
    });
    const data = await response.json();
    return {
      success: data.success === true,
      provider: data.provider,
      attemptsRemaining: data.attemptsRemaining,
      message: data.message,
      error: data.error,
    };
  } catch (error) {
    console.error('OTP Verify Error:', error);
    return {
      success: false,
      error: 'Erreur réseau lors de la vérification du code.',
    };
  }
};

/**
 * Templates de messages prédéfinis
 */
export const SMSTemplates = {
  adhesionValidee: (nom: string, livret: string) =>
    `PMES-AGR DOSSO: Félicitations ${nom}, votre adhésion est validée! Votre No Livret: ${livret}. Bienvenue dans notre communauté.`,

  depotConfirme: (nom: string, montant: number, solde: number, ref: string) =>
    `PMES-AGR DOSSO: Depot de ${montant.toLocaleString()}F CFA confirme pour ${nom}. Nouveau Solde: ${solde.toLocaleString()}F. Ref: ${ref}`,

  retraitConfirme: (nom: string, montant: number, solde: number, ref: string) =>
    `PMES-AGR DOSSO: Retrait de ${montant.toLocaleString()}F CFA effectue pour ${nom}. Solde restant: ${solde.toLocaleString()}F. Ref: ${ref}`,

  echeancePayee: (nom: string, montant: number, reste: number) =>
    `PMES-AGR DOSSO: Remboursement de ${montant.toLocaleString()}F recu de ${nom}. Reste a payer: ${reste.toLocaleString()}F. Merci.`,

  financementValide: (nom: string, montant: number, type: string) =>
    `PMES-AGR DOSSO: Votre financement ${type} de ${montant.toLocaleString()}F est approuve et decaisse. Consultez votre agent.`,

  otp: (code: string) =>
    `PMES-AGR DOSSO: Votre code de confirmation pour l'inscription est ${code}. Ne le partagez avec personne.`,
};
