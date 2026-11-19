import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

interface SWManifestEntry {
  url: string;
  revision: string | null;
}

declare global {
  interface Window {
    __WB_MANIFEST: Array<SWManifestEntry | string>;
  }
}

interface SWScope {
  location: Location;
  skipWaiting: () => Promise<void>;
  clients: {
    claim: () => Promise<void>;
    matchAll: (options?: { type?: string; includeUncontrolled?: boolean }) => Promise<Array<{ postMessage: (data: any) => void }>>;
  };
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

const sw = globalThis as unknown as SWScope;

const OFFLINE_DB_NAME = 'pmes_dosso_offline_db';
const OFFLINE_DB_VERSION = 1;
const STORE_ADMIN_RECORDS = 'admin_records';
const STORE_SYNC_QUEUE = 'pending_sync_queue';
const ADMIN_API_CACHE = 'pmes-admin-api-cache-v1';

// Precache app shell assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// SPA navigation fallback when offline
try {
  const navHandler = createHandlerBoundToURL('/index.html');
  registerRoute(
    new NavigationRoute(navHandler, {
      denylist: [/^\/api\//],
    })
  );
} catch {
  // Dev mode middleware may serve index.html dynamically without precache entry
}

// Cache Google Fonts stylesheets and webfonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'pmes-google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Cache images & icons
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'pmes-images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

function openSwIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ADMIN_RECORDS)) {
        db.createObjectStore(STORE_ADMIN_RECORDS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const store = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function swPutRecord(storeName: string, value: any): Promise<void> {
  const db = await openSwIDB();
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

async function swGetRecord<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openSwIDB();
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

async function swGetAllQueue(): Promise<any[]> {
  const db = await openSwIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function persistSyncAllToIDB(data: any): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    Array.isArray(data.members)
      ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'members', data: data.members, updatedAt: now })
      : Promise.resolve(),
    Array.isArray(data.transactions)
      ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'transactions', data: data.transactions, updatedAt: now })
      : Promise.resolve(),
    Array.isArray(data.demandesRetrait)
      ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'demandesRetrait', data: data.demandesRetrait, updatedAt: now })
      : Promise.resolve(),
    Array.isArray(data.financements)
      ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'demandesFinancement', data: data.financements, updatedAt: now })
      : Array.isArray(data.demandesFinancement)
        ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'demandesFinancement', data: data.demandesFinancement, updatedAt: now })
        : Promise.resolve(),
    Array.isArray(data.caisseMouvements)
      ? swPutRecord(STORE_ADMIN_RECORDS, { key: 'caisseMouvements', data: data.caisseMouvements, updatedAt: now })
      : Promise.resolve(),
    swPutRecord(STORE_ADMIN_RECORDS, { key: 'sync_meta', updatedAt: now }),
  ]);
}

async function buildSyncAllResponseFromIDB(): Promise<Response | null> {
  try {
    const [membersRec, txsRec, finRec, caisseRec] = await Promise.all([
      swGetRecord<{ data: any[] }>(STORE_ADMIN_RECORDS, 'members'),
      swGetRecord<{ data: any[] }>(STORE_ADMIN_RECORDS, 'transactions'),
      swGetRecord<{ data: any[] }>(STORE_ADMIN_RECORDS, 'demandesFinancement'),
      swGetRecord<{ data: any[] }>(STORE_ADMIN_RECORDS, 'caisseMouvements'),
    ]);

    if (!membersRec && !txsRec) return null;

    return new Response(
      JSON.stringify({
        corporations: [],
        zones: [],
        members: membersRec?.data || [],
        transactions: txsRec?.data || [],
        financements: finRec?.data || [],
        caisseMouvements: caisseRec?.data || [],
        offlineCached: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-PMES-Source': 'indexeddb-offline',
        },
      }
    );
  } catch {
    return null;
  }
}

async function replayQueueFromSW(): Promise<{ syncedCount: number }> {
  let syncedCount = 0;
  try {
    const rawQueue = await swGetAllQueue();
    const queue = rawQueue
      .filter((item) => item.status !== 'synced')
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
          (a.seq || 0) - (b.seq || 0)
      );

    for (const item of queue) {
      try {
        const isDelete = item.method === 'DELETE';
        const res = await fetch(item.endpoint, {
          method: item.method,
          ...(isDelete
            ? {}
            : {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload),
              }),
        });
        if (res.ok) {
          await swPutRecord(STORE_SYNC_QUEUE, {
            ...item,
            status: 'synced',
            lastError: undefined,
          });
          syncedCount++;
        }
      } catch {
        // Toujours hors-ligne, on réessaiera au prochain événement sync
      }
    }

    if (syncedCount > 0) {
      const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'PMES_SYNC_COMPLETE', syncedCount });
      }
    }
  } catch {
    // Ignore IDB errors
  }
  return { syncedCount };
}

// Stratégie NetworkFirst + sauvegarde IndexedDB pour /api/db/sync-all
const syncAllStrategy = new NetworkFirst({
  cacheName: ADMIN_API_CACHE,
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
});

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/db/sync-all',
  async ({ request, event }) => {
    try {
      const response = await syncAllStrategy.handle({ request, event });
      if (response && response.ok) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => persistSyncAllToIDB(data))
          .catch(() => {});
      }
      return response;
    } catch {
      const idbFallback = await buildSyncAllResponseFromIDB();
      if (idbFallback) return idbFallback;
      return new Response(JSON.stringify({ error: 'Offline cache unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
);

// Activation & contrôle immédiat
sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event: any) => {
  event.waitUntil(sw.clients.claim());
});

// Background Sync : rejoue la file IndexedDB au retour du réseau
sw.addEventListener('sync', (event: any) => {
  if (event.tag === 'pmes-admin-sync') {
    event.waitUntil(replayQueueFromSW());
  }
});

// Pont de messagerie avec AdminSpace / App
sw.addEventListener('message', (event: any) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  } else if (data.type === 'PMES_CACHE_SNAPSHOT' && data.payload) {
    event.waitUntil(persistSyncAllToIDB(data.payload));
  } else if (data.type === 'PMES_FLUSH_QUEUE') {
    event.waitUntil(replayQueueFromSW());
  }
});
