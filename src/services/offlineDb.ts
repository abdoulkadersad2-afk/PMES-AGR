import {
  Member,
  Transaction,
  DemandeRetrait,
  DemandeFinancement,
  CaisseMouvement,
} from '../types';

export const OFFLINE_DB_NAME = 'pmes_dosso_offline_db';
export const OFFLINE_DB_VERSION = 1;
export const STORE_ADMIN_RECORDS = 'admin_records';
export const STORE_SYNC_QUEUE = 'pending_sync_queue';

export interface AdminOfflineSnapshot {
  members: Member[];
  transactions: Transaction[];
  demandesRetrait: DemandeRetrait[];
  demandesFinancement: DemandeFinancement[];
  caisseMouvements: CaisseMouvement[];
  updatedAt: string;
}

export interface OfflineSyncItem {
  id: string;
  seq?: number;
  entityType:
    | 'member'
    | 'member_update'
    | 'transaction'
    | 'retrait_decision'
    | 'financement_decision'
    | 'financement_delete'
    | 'caisse_mouvement';
  actionLabel: string;
  summary: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  payload: Record<string, any>;
  createdAt: string;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface OfflineCacheStats {
  pendingOpsCount: number;
  failedOpsCount: number;
  cachedMembersCount: number;
  cachedPendingMembersCount: number;
  cachedTransactionsCount: number;
  cachedPendingRetraitsCount: number;
  cachedPendingFinancementsCount: number;
  lastCachedAt: string | null;
}

let queueSeqCounter = 0;

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non supporté'));
      return;
    }

    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ADMIN_RECORDS)) {
        db.createObjectStore(STORE_ADMIN_RECORDS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const store = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erreur ouverture IndexedDB'));
  });
}

async function idbPut(storeName: string, value: any): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T[]) || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveAdminSnapshotToIDB(snapshot: AdminOfflineSnapshot): Promise<void> {
  try {
    await Promise.all([
      idbPut(STORE_ADMIN_RECORDS, { key: 'members', data: snapshot.members, updatedAt: snapshot.updatedAt }),
      idbPut(STORE_ADMIN_RECORDS, { key: 'transactions', data: snapshot.transactions, updatedAt: snapshot.updatedAt }),
      idbPut(STORE_ADMIN_RECORDS, { key: 'demandesRetrait', data: snapshot.demandesRetrait, updatedAt: snapshot.updatedAt }),
      idbPut(STORE_ADMIN_RECORDS, { key: 'demandesFinancement', data: snapshot.demandesFinancement, updatedAt: snapshot.updatedAt }),
      idbPut(STORE_ADMIN_RECORDS, { key: 'caisseMouvements', data: snapshot.caisseMouvements, updatedAt: snapshot.updatedAt }),
      idbPut(STORE_ADMIN_RECORDS, { key: 'sync_meta', updatedAt: snapshot.updatedAt }),
    ]);

    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PMES_CACHE_SNAPSHOT',
        payload: snapshot,
      });
    }
  } catch (err) {
    console.warn('[IndexedDB] Impossible de sauvegarder le snapshot admin:', err);
  }
}

export async function loadAdminSnapshotFromIDB(): Promise<AdminOfflineSnapshot | null> {
  try {
    const [membersRec, txsRec, retraitsRec, finRec, caisseRec, metaRec] = await Promise.all([
      idbGet<{ data: Member[] }>(STORE_ADMIN_RECORDS, 'members'),
      idbGet<{ data: Transaction[] }>(STORE_ADMIN_RECORDS, 'transactions'),
      idbGet<{ data: DemandeRetrait[] }>(STORE_ADMIN_RECORDS, 'demandesRetrait'),
      idbGet<{ data: DemandeFinancement[] }>(STORE_ADMIN_RECORDS, 'demandesFinancement'),
      idbGet<{ data: CaisseMouvement[] }>(STORE_ADMIN_RECORDS, 'caisseMouvements'),
      idbGet<{ updatedAt: string }>(STORE_ADMIN_RECORDS, 'sync_meta'),
    ]);

    if (!membersRec && !txsRec && !retraitsRec && !finRec) {
      return null;
    }

    return {
      members: membersRec?.data || [],
      transactions: txsRec?.data || [],
      demandesRetrait: retraitsRec?.data || [],
      demandesFinancement: finRec?.data || [],
      caisseMouvements: caisseRec?.data || [],
      updatedAt: metaRec?.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[IndexedDB] Erreur lecture snapshot admin:', err);
    return null;
  }
}

export async function enqueueOfflineOperation(
  item: Omit<OfflineSyncItem, 'id' | 'seq' | 'createdAt' | 'status' | 'retryCount'>
): Promise<OfflineSyncItem> {
  queueSeqCounter += 1;
  const fullItem: OfflineSyncItem = {
    ...item,
    id: `sync_${Date.now()}_${queueSeqCounter}_${Math.random().toString(36).slice(2, 6)}`,
    seq: Date.now() * 1000 + (queueSeqCounter % 1000),
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  try {
    await idbPut(STORE_SYNC_QUEUE, fullItem);

    // Demander au Service Worker d'enregistrer un Background Sync si disponible
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && 'sync' in reg) {
        (reg as any).sync.register('pmes-admin-sync').catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[IndexedDB] Erreur mise en file hors-ligne:', err);
  }

  return fullItem;
}

export async function getPendingOfflineOperations(): Promise<OfflineSyncItem[]> {
  try {
    const items = await idbGetAll<OfflineSyncItem>(STORE_SYNC_QUEUE);
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        (b.seq || 0) - (a.seq || 0)
    );
  } catch {
    return [];
  }
}

export async function clearSyncedOfflineOperations(): Promise<void> {
  try {
    const items = await idbGetAll<OfflineSyncItem>(STORE_SYNC_QUEUE);
    await Promise.all(
      items.filter((i) => i.status === 'synced').map((i) => idbDelete(STORE_SYNC_QUEUE, i.id))
    );
  } catch {
    // Ignore
  }
}

export async function flushOfflineSyncQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
}> {
  const items = await getPendingOfflineOperations();
  // Rejouer strictement dans l'ordre chronologique (du plus ancien au plus récent)
  const toProcess = items
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        (a.seq || 0) - (b.seq || 0)
    );

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of toProcess) {
    try {
      const fetchInit: RequestInit =
        item.method === 'DELETE'
          ? { method: 'DELETE' }
          : {
              method: item.method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            };
      const resp = await fetch(item.endpoint, fetchInit);

      if (resp.ok) {
        await idbPut(STORE_SYNC_QUEUE, {
          ...item,
          status: 'synced',
          lastError: undefined,
        });
        syncedCount++;
      } else {
        const text = await resp.text().catch(() => `HTTP ${resp.status}`);
        await idbPut(STORE_SYNC_QUEUE, {
          ...item,
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: text.slice(0, 140),
        });
        failedCount++;
      }
    } catch (err: any) {
      await idbPut(STORE_SYNC_QUEUE, {
        ...item,
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: err?.message || 'Hors-ligne',
      });
      failedCount++;
    }
  }

  const remaining = (await getPendingOfflineOperations()).filter(
    (i) => i.status !== 'synced'
  ).length;

  return { syncedCount, failedCount, remainingCount: remaining };
}

export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  const [snapshot, queue] = await Promise.all([
    loadAdminSnapshotFromIDB(),
    getPendingOfflineOperations(),
  ]);

  const pendingOpsCount = queue.filter((i) => i.status === 'pending').length;
  const failedOpsCount = queue.filter((i) => i.status === 'failed').length;

  return {
    pendingOpsCount,
    failedOpsCount,
    cachedMembersCount: snapshot?.members.length ?? 0,
    cachedPendingMembersCount:
      snapshot?.members.filter((m) => m.status === 'en_attente').length ?? 0,
    cachedTransactionsCount: snapshot?.transactions.length ?? 0,
    cachedPendingRetraitsCount:
      snapshot?.demandesRetrait.filter((r) => r.status === 'en_attente').length ?? 0,
    cachedPendingFinancementsCount:
      snapshot?.demandesFinancement.filter((f) => f.status === 'en_attente').length ?? 0,
    lastCachedAt: snapshot?.updatedAt ?? null,
  };
}

export async function exportAllOfflineDBStores(): Promise<{
  adminRecords: Record<string, any>;
  pendingSyncQueue: OfflineSyncItem[];
}> {
  try {
    const [adminRecordsArr, queueArr] = await Promise.all([
      idbGetAll<{ key: string; [k: string]: any }>(STORE_ADMIN_RECORDS),
      idbGetAll<OfflineSyncItem>(STORE_SYNC_QUEUE),
    ]);
    const adminRecords: Record<string, any> = {};
    for (const rec of adminRecordsArr) {
      if (rec && rec.key && rec.key !== 'last_backup_package') {
        adminRecords[rec.key] = rec;
      }
    }
    return {
      adminRecords,
      pendingSyncQueue: queueArr || [],
    };
  } catch (err) {
    console.warn('[IndexedDB] Erreur export complet:', err);
    return { adminRecords: {}, pendingSyncQueue: [] };
  }
}

export async function restoreOfflineDBStores(payload: {
  adminRecords?: Record<string, any>;
  pendingSyncQueue?: OfflineSyncItem[];
}): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ADMIN_RECORDS, STORE_SYNC_QUEUE], 'readwrite');
    if (payload.adminRecords) {
      const recStore = tx.objectStore(STORE_ADMIN_RECORDS);
      Object.entries(payload.adminRecords).forEach(([key, val]) => {
        if (val && typeof val === 'object' && key !== 'last_backup_package') {
          recStore.put({ ...val, key: val.key || key });
        }
      });
    }
    if (Array.isArray(payload.pendingSyncQueue)) {
      const queueStore = tx.objectStore(STORE_SYNC_QUEUE);
      payload.pendingSyncQueue.forEach((item) => {
        if (item && item.id) {
          queueStore.put(item);
        }
      });
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
