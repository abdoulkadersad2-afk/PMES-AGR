import crypto from 'node:crypto';
import { createPool } from '../db/index.ts';

export type OtpProviderName = 'sms-gateway' | 'sandbox';

export interface OtpSendResult {
  success: boolean;
  provider: OtpProviderName;
  telephone: string;
  expiresIn?: number;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
  sandboxCode?: string;
  message: string;
  error?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  provider: OtpProviderName;
  attemptsRemaining?: number;
  message: string;
  error?: string;
}

interface StoredOtpRecord {
  telephone: string;
  salt: string;
  codeHash: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

const memoryOtpStore = new Map<string, StoredOtpRecord>();
const hourlyRateStore = new Map<string, number[]>();
let sqlTableInitialized = false;
let sqlAvailable = true;

function getOtpSecret(): string {
  return process.env.OTP_HMAC_SECRET || process.env.SMS_API_KEY || 'pmes-dosso-otp-secret';
}

export function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  // 8-digit Niger local number (e.g. 96123456 -> +22796123456)
  if (/^\d{8}$/.test(cleaned)) {
    return `+227${cleaned}`;
  }
  // 227 + 8 digits without plus
  if (/^227\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  // Standard E.164
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function hashOtpCode(code: string, salt: string): string {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${salt}:${code}`)
    .digest('hex');
}

function constantTimeCompare(hexA: string, hexB: string): boolean {
  const bufA = Buffer.from(hexA, 'hex');
  const bufB = Buffer.from(hexB, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function ensureOtpTable(): Promise<boolean> {
  if (!sqlAvailable) return false;
  if (sqlTableInitialized) return true;
  if (!process.env.SQL_HOST || !process.env.SQL_DB_NAME) {
    sqlAvailable = false;
    return false;
  }

  try {
    const pool = createPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        telephone TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      )
    `);
    sqlTableInitialized = true;
    return true;
  } catch (err) {
    console.warn('[OTP SERVICE] PostgreSQL unavailable for OTP store, using memory store:', (err as Error).message);
    sqlAvailable = false;
    return false;
  }
}

async function getStoredOtp(telephone: string): Promise<StoredOtpRecord | null> {
  if (await ensureOtpTable()) {
    try {
      const pool = createPool();
      const result = await pool.query(
        'SELECT telephone, salt, code_hash, expires_at, created_at, attempts FROM otp_verifications WHERE telephone = $1',
        [telephone]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          telephone: row.telephone,
          salt: row.salt,
          codeHash: row.code_hash,
          expiresAt: Number(row.expires_at),
          createdAt: Number(row.created_at),
          attempts: Number(row.attempts),
        };
      }
      return null;
    } catch {
      // Fall back to memory
    }
  }
  return memoryOtpStore.get(telephone) || null;
}

async function saveStoredOtp(record: StoredOtpRecord): Promise<void> {
  memoryOtpStore.set(record.telephone, record);
  if (await ensureOtpTable()) {
    try {
      const pool = createPool();
      await pool.query(
        `INSERT INTO otp_verifications (telephone, salt, code_hash, expires_at, created_at, attempts)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (telephone) DO UPDATE SET
           salt = EXCLUDED.salt,
           code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           created_at = EXCLUDED.created_at,
           attempts = EXCLUDED.attempts`,
        [record.telephone, record.salt, record.codeHash, record.expiresAt, record.createdAt, record.attempts]
      );
    } catch {
      // Memory fallback already updated
    }
  }
}

async function incrementOtpAttempts(telephone: string, attempts: number): Promise<void> {
  const mem = memoryOtpStore.get(telephone);
  if (mem) mem.attempts = attempts;
  if (await ensureOtpTable()) {
    try {
      const pool = createPool();
      await pool.query('UPDATE otp_verifications SET attempts = $1 WHERE telephone = $2', [attempts, telephone]);
    } catch {
      // Ignore
    }
  }
}

async function deleteStoredOtp(telephone: string): Promise<void> {
  memoryOtpStore.delete(telephone);
  if (await ensureOtpTable()) {
    try {
      const pool = createPool();
      await pool.query('DELETE FROM otp_verifications WHERE telephone = $1', [telephone]);
    } catch {
      // Ignore
    }
  }
}

function isValidHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectOtpProvider(): OtpProviderName {
  const gatewayUrl = process.env.SMS_PROVIDER_URL;
  const gatewayKey = process.env.SMS_API_KEY;

  if (isValidHttpUrl(gatewayUrl) && gatewayKey) return 'sms-gateway';
  return 'sandbox';
}

export async function dispatchSmsMessage(toE164: string, message: string): Promise<{ ok: boolean; provider: OtpProviderName; providerRef?: string; error?: string }> {
  const provider = detectOtpProvider();

  if (provider === 'sms-gateway') {
    const url = process.env.SMS_PROVIDER_URL!.trim();
    const apiKey = process.env.SMS_API_KEY!;
    const sender = process.env.SMS_SENDER_ID || 'PMES-DOSSO';

    if (!isValidHttpUrl(url)) {
      console.warn('[SMS GATEWAY] URL invalide ignorée, bascule en mode sandbox.');
      return { ok: true, provider: 'sandbox', providerRef: `sandbox_${Date.now()}` };
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: toE164,
          message,
          sender,
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok) {
        return { ok: false, provider, error: data?.error || data?.message || `Erreur passerelle SMS (${resp.status})` };
      }
      return { ok: true, provider, providerRef: data?.id || data?.messageId || `gw_${Date.now()}` };
    } catch (err: any) {
      return { ok: false, provider, error: err?.message || 'Erreur réseau passerelle SMS' };
    }
  }

  // Sandbox mode
  console.log(`[SMS SANDBOX] To ${toE164}: ${message}`);
  return { ok: true, provider: 'sandbox', providerRef: `sandbox_${Date.now()}` };
}

export async function sendOtpCode(rawTelephone: string): Promise<OtpSendResult> {
  const telephone = normalizePhoneE164(rawTelephone);
  if (!telephone) {
    return {
      success: false,
      provider: detectOtpProvider(),
      telephone: rawTelephone,
      message: 'Numéro de téléphone invalide',
      error: 'Format attendu : 8 chiffres (ex: 96 12 34 56) ou format international +227...',
    };
  }

  const now = Date.now();
  const provider = detectOtpProvider();

  // Check resend cooldown
  const existing = await getStoredOtp(telephone);
  if (existing && now - existing.createdAt < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000);
    return {
      success: false,
      provider,
      telephone,
      retryAfterSeconds,
      message: `Veuillez patienter ${retryAfterSeconds}s avant de demander un nouveau code.`,
      error: `Veuillez patienter ${retryAfterSeconds}s avant de renvoyer un code.`,
    };
  }

  // Check hourly rate limit
  const timestamps = (hourlyRateStore.get(telephone) || []).filter((ts) => now - ts < ONE_HOUR_MS);
  if (timestamps.length >= MAX_SENDS_PER_HOUR) {
    return {
      success: false,
      provider,
      telephone,
      retryAfterSeconds: 300,
      message: 'Limite horaire atteinte',
      error: 'Trop de demandes de code pour ce numéro. Réessayez plus tard.',
    };
  }

  // Generate CSPRNG 6-digit OTP and salted HMAC hash
  const code = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashOtpCode(code, salt);

  const smsText = `PMES-AGR DOSSO : Votre code de vérification est ${code}. Valable 5 minutes. Ne le partagez avec personne.`;
  const smsResult = await dispatchSmsMessage(telephone, smsText);

  if (!smsResult.ok) {
    return {
      success: false,
      provider,
      telephone,
      message: 'Échec envoi SMS',
      error: smsResult.error || 'Impossible d’envoyer le SMS OTP.',
    };
  }

  await saveStoredOtp({
    telephone,
    salt,
    codeHash,
    expiresAt: now + OTP_TTL_MS,
    createdAt: now,
    attempts: 0,
  });
  hourlyRateStore.set(telephone, [...timestamps, now]);

  return {
    success: true,
    provider,
    telephone,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    cooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    // Only expose sandboxCode when running without a real SMS provider in non-production
    ...(provider === 'sandbox' && process.env.NODE_ENV !== 'production' ? { sandboxCode: code } : {}),
    message:
      provider === 'sandbox'
        ? `Code OTP généré (mode sandbox) pour ${telephone}`
        : `Code OTP envoyé par SMS au ${telephone}`,
  };
}

export async function verifyOtpCode(rawTelephone: string, rawCode: string): Promise<OtpVerifyResult> {
  const telephone = normalizePhoneE164(rawTelephone);
  const code = rawCode.replace(/\D/g, '');
  const provider = detectOtpProvider();

  if (!telephone) {
    return {
      success: false,
      provider,
      message: 'Numéro invalide',
      error: 'Numéro de téléphone invalide.',
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      success: false,
      provider,
      message: 'Format de code invalide',
      error: 'Veuillez saisir un code valide à 6 chiffres.',
    };
  }

  const stored = await getStoredOtp(telephone);
  if (!stored) {
    return {
      success: false,
      provider,
      message: 'Aucun code actif',
      error: 'Aucun code actif trouvé pour ce numéro. Veuillez en demander un nouveau.',
    };
  }

  if (Date.now() > stored.expiresAt) {
    await deleteStoredOtp(telephone);
    return {
      success: false,
      provider,
      message: 'Code expiré',
      error: 'Ce code a expiré (validité 5 min). Veuillez demander un nouveau code.',
    };
  }

  const candidateHash = hashOtpCode(code, stored.salt);
  if (!constantTimeCompare(candidateHash, stored.codeHash)) {
    const nextAttempts = stored.attempts + 1;
    const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts);

    if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
      await deleteStoredOtp(telephone);
      return {
        success: false,
        provider,
        attemptsRemaining: 0,
        message: 'Trop de tentatives',
        error: 'Trop de tentatives incorrectes. Veuillez demander un nouveau code.',
      };
    }

    await incrementOtpAttempts(telephone, nextAttempts);
    return {
      success: false,
      provider,
      attemptsRemaining: remaining,
      message: 'Code incorrect',
      error: `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
    };
  }

  await deleteStoredOtp(telephone);
  return {
    success: true,
    provider,
    message: 'Numéro vérifié avec succès.',
  };
}
