import { Member, ReceiptData, Transaction } from '../types';

export const MEMBER_QR_PREFIX = 'PMES-MEMBER';
export const RECEIPT_QR_PREFIX = 'PMES';

/**
 * Encode le QR code officiel d'un adhérent avec son identifiant unique (`member.id`)
 * et son numéro de livret (`member.livret`) pour un check-in et des opérations rapides au guichet.
 * Format : PMES-MEMBER|<member.id>|<member.livret>
 */
export function encodeMemberQRPayload(member: Pick<Member, 'id' | 'livret'>): string {
  return `${MEMBER_QR_PREFIX}|${member.id}|${member.livret}`;
}

/**
 * Encode le QR code officiel d'un reçu de transaction imprimé ou PDF.
 * Format : PMES|<reference>|<memberLivret>|<montant>|<date>
 */
export function encodeReceiptQRPayload(
  receipt: Pick<ReceiptData, 'reference' | 'memberLivret' | 'montant' | 'date'>
): string {
  return `${RECEIPT_QR_PREFIX}|${receipt.reference}|${receipt.memberLivret}|${receipt.montant}|${receipt.date}`;
}

/**
 * Décode le texte scanné d'un QR code membre et retrouve l'adhérent correspondant.
 * Supporte :
 * - Format standard : PMES-MEMBER|<id>|<livret>
 * - Format historique : PMES-MEMBER|<livret>
 * - Format JSON : { "id": "...", "livret": "..." }
 * - Identifiant brut : <id>, <livret>, ou <telephone>
 */
export function decodeMemberQRPayload(
  decodedText: string,
  members: Member[]
): Member | undefined {
  const raw = decodedText.trim();
  if (!raw) return undefined;

  // 1. Format structuré JSON éventuel
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { id?: string; memberId?: string; member_id?: string; livret?: string };
      const targetId = parsed.id || parsed.memberId || parsed.member_id;
      const targetLivret = parsed.livret;
      const found = members.find(
        (m) =>
          (targetId && m.id === targetId) ||
          (targetLivret && (m.livret || '').toUpperCase() === targetLivret.toUpperCase())
      );
      if (found) return found;
    } catch {
      // Fallback aux formats délimités ou bruts
    }
  }

  // 2. Format PMES-MEMBER|<id>|<livret> ou PMES-MEMBER|<livret>
  if (raw.startsWith(`${MEMBER_QR_PREFIX}|`)) {
    const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
    const idOrLivret = parts[1];
    const secondaryLivret = parts[2];

    const found = members.find(
      (m) =>
        (idOrLivret && (m.id === idOrLivret || (m.livret || '').toUpperCase() === idOrLivret.toUpperCase())) ||
        (secondaryLivret && (m.livret || '').toUpperCase() === secondaryLivret.toUpperCase())
    );
    if (found) return found;
  }

  // 3. Correspondance directe (id, livret, téléphone)
  const cleanPhone = raw.replace(/\D/g, '').slice(-8);
  return members.find(
    (m) =>
      m.id === raw ||
      (m.livret || '').toUpperCase() === raw.toUpperCase() ||
      (cleanPhone.length === 8 && m.telephone === cleanPhone)
  );
}

/**
 * Construit l'objet ReceiptData complet à partir d'une transaction et de la liste d'adhérents.
 */
export function buildReceiptFromTransaction(
  tx: Transaction,
  members: Member[]
): ReceiptData {
  const txMember = members.find(
    (m) =>
      m.id === tx.member_id ||
      (tx.member_livret && (m.livret || '').toUpperCase() === tx.member_livret.toUpperCase())
  );

  return {
    transactionId: tx.id,
    type: tx.type,
    reference: tx.reference || `PMES-${tx.id.slice(-6).toUpperCase()}`,
    date: tx.date,
    memberNom: tx.member_nom || txMember?.nom || 'Adhérent',
    memberLivret: tx.member_livret || txMember?.livret || '---',
    memberTelephone: txMember?.telephone || '---',
    zone: tx.zone || txMember?.zone || 'Dosso',
    montant: tx.montant,
    soldeAvant: tx.solde_avant,
    soldeApres: tx.solde_apres,
    agentNom: tx.agent,
    motif: tx.description,
  };
}

/**
 * Décode le QR code d'un reçu imprimé ou PDF et retrouve la transaction correspondante.
 * Supporte :
 * - Format officiel reçu : PMES|<reference>|<memberLivret>|<montant>|<date>
 * - Format alternatif : PMES-RECEIPT|<reference>|... ou ligne "Empreinte : PMES|..."
 * - Format JSON : { "reference": "...", "transactionId": "...", ... }
 * - Référence directe (REC-DOSSO-...) ou ID de transaction brut (tx_...)
 */
export function decodeReceiptQRPayload(
  decodedText: string,
  transactions: Transaction[],
  members: Member[]
): ReceiptData | undefined {
  let raw = decodedText.trim();
  if (!raw || raw.startsWith(`${MEMBER_QR_PREFIX}|`)) return undefined;

  // Nettoie un éventuel préfixe copié depuis le pied de page PDF ("Empreinte : PMES|...")
  if (/^empreinte\s*:/i.test(raw)) {
    raw = raw.replace(/^empreinte\s*:\s*/i, '').trim();
  }

  let targetRef = '';
  let targetTxId = '';
  let targetLivret = '';
  let targetAmount: number | undefined;
  let targetDate = '';

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as {
        reference?: string;
        ref?: string;
        transactionId?: string;
        txId?: string;
        id?: string;
        memberLivret?: string;
        livret?: string;
        montant?: number | string;
        date?: string;
      };
      targetRef = (parsed.reference || parsed.ref || '').trim();
      targetTxId = (parsed.transactionId || parsed.txId || parsed.id || '').trim();
      targetLivret = (parsed.memberLivret || parsed.livret || '').trim();
      if (parsed.montant !== undefined) {
        const num = Number(parsed.montant);
        if (!Number.isNaN(num)) targetAmount = num;
      }
      targetDate = (parsed.date || '').trim();
    } catch {
      // Fallback aux autres formats
    }
  } else if (raw.startsWith(`${RECEIPT_QR_PREFIX}|`) || raw.startsWith('PMES-RECEIPT|')) {
    const parts = raw.split('|').map((p) => p.trim());
    targetRef = parts[1] || '';
    targetLivret = parts[2] || '';
    if (parts[3]) {
      const parsedAmount = Number(parts[3]);
      if (!Number.isNaN(parsedAmount)) targetAmount = parsedAmount;
    }
    targetDate = parts[4] || '';
  } else {
    targetRef = raw;
    targetTxId = raw;
  }

  const normalizedRef = targetRef.toUpperCase();
  const normalizedLivret = targetLivret.toUpperCase();

  let matchedTx: Transaction | undefined;

  // 1. Correspondance par ID de transaction exact
  if (targetTxId) {
    matchedTx = transactions.find((t) => t.id === targetTxId);
  }

  // 2. Correspondance par référence officielle (ou référence courte PMES-XXXXXX)
  if (!matchedTx && normalizedRef && normalizedRef !== 'REF') {
    matchedTx = transactions.find((t) => {
      const txRef = (t.reference || '').trim().toUpperCase();
      const shortRef = `PMES-${t.id.slice(-6).toUpperCase()}`;
      if (txRef !== normalizedRef && shortRef !== normalizedRef) return false;
      // Si livret est fourni dans le QR, vérifier cohérence si disponible
      if (normalizedLivret) {
        const txMember = members.find((m) => m.id === t.member_id);
        const txLivret = (t.member_livret || txMember?.livret || '').toUpperCase();
        if (txLivret && txLivret !== normalizedLivret) return false;
      }
      return true;
    });
  }

  // 3. Repli composite (livret + montant + date) pour références génériques
  if (!matchedTx && normalizedLivret && targetAmount !== undefined) {
    matchedTx = transactions.find((t) => {
      const txMember = members.find((m) => m.id === t.member_id);
      const txLivret = (t.member_livret || txMember?.livret || '').toUpperCase();
      if (txLivret !== normalizedLivret) return false;
      if (t.montant !== targetAmount) return false;
      if (targetDate && t.date !== targetDate) {
        return (t.date || '').slice(0, 10) === targetDate.slice(0, 10);
      }
      return true;
    });
  }

  if (!matchedTx) return undefined;
  return buildReceiptFromTransaction(matchedTx, members);
}
