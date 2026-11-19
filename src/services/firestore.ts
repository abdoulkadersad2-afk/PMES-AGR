import { 
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs, 
  query, limit, getDoc, getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function stripNullish<T extends Record<string, any>>(obj: T): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)
  );
}

const ALLOWED_KEYS_BY_COLLECTION: Record<string, string[]> = {
  users: ['id', 'username', 'nom', 'role', 'zone', 'password', 'created_at', 'telephone'],
  members: [
    'id', 'nom', 'telephone', 'pin', 'livret', 'zone', 'solde', 'status', 'created_at',
    'corporationId', 'corporationNom', 'corporationEmoji', 'photo', 'activite', 'notes',
    'objectif_montant', 'objectif_date', 'objectif_label', 'date_naissance', 'lieu_naissance',
  ],
  transactions: [
    'id', 'uid', 'member_id', 'type', 'montant', 'date', 'agent', 'zone', 'validated',
    'member_nom', 'member_livret', 'solde_avant', 'solde_apres', 'reference', 'description',
  ],
  audit_logs: ['id', 'uid', 'date', 'action', 'acteur', 'role', 'details', 'categorie', 'cible'],
  retraits: [
    'id', 'uid', 'member_id', 'montant', 'motif', 'status', 'date', 'type',
    'date_traitement', 'agent_validateur', 'motif_rejet',
  ],
  financements: [
    'id', 'uid', 'member_id', 'montant', 'duree_mois', 'motif', 'status', 'date', 'type',
    'financement_type', 'marge_beneficiaire', 'partage_profit_pct', 'cout_achat',
    'frequence', 'montant_total', 'montant_rembourse', 'echeances',
    'date_traitement', 'agent_validateur', 'decaissed_from_caisse',
  ],
};

const REQUIRED_KEYS_BY_COLLECTION: Record<string, string[]> = {
  users: ['id', 'username', 'nom', 'role', 'zone'],
  members: ['id', 'nom', 'telephone', 'pin', 'livret', 'zone', 'solde', 'status', 'created_at'],
  transactions: ['id', 'member_id', 'type', 'montant', 'date', 'agent', 'zone', 'validated'],
  audit_logs: ['id', 'date', 'action', 'acteur', 'role', 'details', 'categorie'],
  retraits: ['id', 'member_id', 'montant', 'motif', 'status', 'date', 'type'],
  financements: ['id', 'member_id', 'montant', 'status', 'date', 'type', 'financement_type'],
};

function clampStr(val: any, maxLen: number): string {
  const s = String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function sanitizeForFirestore(collectionName: string, data: Record<string, any>): Record<string, any> {
  const cleaned = stripNullish(data);
  const allowed = ALLOWED_KEYS_BY_COLLECTION[collectionName];
  const filtered: Record<string, any> = allowed
    ? Object.fromEntries(Object.entries(cleaned).filter(([k]) => allowed.includes(k)))
    : { ...cleaned };

  if (collectionName === 'users') {
    if (filtered.id !== undefined) filtered.id = clampStr(filtered.id, 128);
    if (filtered.nom !== undefined) filtered.nom = clampStr(filtered.nom, 128);
    if (filtered.username !== undefined) filtered.username = clampStr(filtered.username, 128);
    if (filtered.zone !== undefined) filtered.zone = clampStr(filtered.zone, 128);
  } else if (collectionName === 'members') {
    if (filtered.id !== undefined) filtered.id = clampStr(filtered.id, 128);
    if (filtered.nom !== undefined) filtered.nom = clampStr(filtered.nom, 128);
    if (filtered.telephone !== undefined) filtered.telephone = clampStr(filtered.telephone, 20);
    if (filtered.solde !== undefined) filtered.solde = Number(filtered.solde) || 0;
    if (!filtered.created_at) filtered.created_at = new Date().toISOString();
    if (!filtered.pin) filtered.pin = '0000';
    if (!filtered.status) filtered.status = 'valide';
    if (!filtered.zone) filtered.zone = 'Dosso Centre';
    if (!filtered.livret) filtered.livret = `PMES-${new Date().getFullYear()}-0000`;
  } else if (collectionName === 'transactions') {
    if (filtered.id !== undefined) filtered.id = clampStr(filtered.id, 128);
    if (filtered.member_id !== undefined) filtered.member_id = clampStr(filtered.member_id, 128);
    if (filtered.montant !== undefined) filtered.montant = Math.max(0, Number(filtered.montant) || 0);
    if (filtered.validated === undefined) filtered.validated = true;
    if (filtered.uid === 'anonymous') delete filtered.uid;
  } else if (collectionName === 'audit_logs') {
    if (filtered.id !== undefined) filtered.id = clampStr(filtered.id, 128);
    if (filtered.uid === 'anonymous') delete filtered.uid;
  } else if (collectionName === 'retraits' || collectionName === 'financements') {
    if (filtered.uid === 'anonymous') delete filtered.uid;
  }

  return filtered;
}

function hasValidBlueprintShape(collectionName: string, data: Record<string, any>): boolean {
  const required = REQUIRED_KEYS_BY_COLLECTION[collectionName];
  const allowed = ALLOWED_KEYS_BY_COLLECTION[collectionName];
  if (!required || !allowed) return true;
  const keys = Object.keys(data);
  const hasAll = required.every((k) => keys.includes(k));
  const hasOnly = keys.every((k) => k === 'sync_at' || allowed.includes(k));
  return hasAll && hasOnly;
}

export async function fsInsert(collectionName: string, data: any) {
  try {
    const id = data.id || doc(collection(db, collectionName)).id;
    const sanitized = sanitizeForFirestore(collectionName, { ...data, id });

    await setDoc(doc(db, collectionName, id), {
      ...sanitized,
      sync_at: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
    return false;
  }
}

export async function fsUpsert(collectionName: string, id: string, data: any) {
  try {
    const sanitized = sanitizeForFirestore(collectionName, { ...data, id });
    await setDoc(doc(db, collectionName, id), {
      ...sanitized,
      sync_at: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${id}`);
    return false;
  }
}

export async function fsUpdate(
  collectionName: string,
  id: string,
  updates: any,
  fallbackFullDoc?: Record<string, any>
) {
  try {
    const docRef = doc(db, collectionName, id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      if (fallbackFullDoc) {
        const merged = sanitizeForFirestore(collectionName, {
          ...fallbackFullDoc,
          ...updates,
          id,
        });
        await setDoc(docRef, {
          ...merged,
          sync_at: serverTimestamp(),
        });
        return true;
      }
      // Document does not exist in Firestore yet; avoid updateDoc which fails security rules
      return false;
    }

    const existingData = snap.data() || {};
    if (fallbackFullDoc || !hasValidBlueprintShape(collectionName, existingData)) {
      const merged = sanitizeForFirestore(collectionName, {
        ...existingData,
        ...(fallbackFullDoc || {}),
        ...updates,
        id,
      });
      await setDoc(docRef, {
        ...merged,
        sync_at: serverTimestamp(),
      });
      return true;
    }

    const sanitizedUpdates = sanitizeForFirestore(collectionName, updates);
    // Avoid auto-injecting default required fields on partial updateDoc payloads
    const allowed = ALLOWED_KEYS_BY_COLLECTION[collectionName];
    const partialUpdates = allowed
      ? Object.fromEntries(
          Object.entries(stripNullish(updates)).filter(([k]) => allowed.includes(k))
        )
      : stripNullish(updates);

    if (collectionName === 'members') {
      if (partialUpdates.nom !== undefined) partialUpdates.nom = clampStr(partialUpdates.nom, 128);
      if (partialUpdates.telephone !== undefined) partialUpdates.telephone = clampStr(partialUpdates.telephone, 20);
      if (partialUpdates.solde !== undefined) partialUpdates.solde = Number(partialUpdates.solde) || 0;
    } else if (collectionName === 'users') {
      if (partialUpdates.nom !== undefined) partialUpdates.nom = clampStr(partialUpdates.nom, 128);
    } else if (collectionName === 'transactions') {
      if (partialUpdates.montant !== undefined) partialUpdates.montant = Math.max(0, Number(partialUpdates.montant) || 0);
    }

    if (Object.keys(partialUpdates).length === 0) {
      return true;
    }

    await updateDoc(docRef, {
      ...partialUpdates,
      sync_at: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    return false;
  }
}

export async function fsDelete(collectionName: string, id: string) {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    return false;
  }
}

export async function fsFetchAll<T>(collectionName: string): Promise<T[]> {
  try {
    const q = query(collection(db, collectionName), limit(500));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as T);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
    return [];
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Use getDocFromServer to bypass local cache and force a network roundtrip
    await getDocFromServer(doc(db, 'test', 'ping'));
    return true;
  } catch (error: any) {
    // If we get a permission error, it means we ARE connected to the server
    // but the rules are blocking us. If it's a network error, we are not connected.
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      return true;
    }
    console.warn('Firestore connectivity check failed:', error);
    return false;
  }
}
