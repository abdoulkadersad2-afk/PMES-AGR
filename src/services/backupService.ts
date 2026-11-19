import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OfflineSyncItem,
  exportAllOfflineDBStores,
  restoreOfflineDBStores,
} from './offlineDb';

export const BACKUP_CONFIG_STORAGE_KEY = 'pmes_dosso_backup_config';
export const BACKUP_HISTORY_STORAGE_KEY = 'pmes_dosso_backup_history';
export const BACKUP_LATEST_SNAPSHOT_KEY = 'pmes_dosso_backup_latest_json';

export interface BackupScheduleConfig {
  enabled: boolean;
  scheduledTime: string; // Format 24h "HH:MM"
  autoDownload: boolean;
  includeLocalStorage: boolean;
  includeIndexedDB: boolean;
  includeSecurityHashes: boolean;
  retentionCount: number;
  lastBackupAt: string | null;
  lastBackupDateKey: string | null;
  lastBackupFilename: string | null;
  lastBackupSizeBytes: number | null;
}

export interface BackupRecordCounts {
  members: number;
  transactions: number;
  retraits: number;
  financements: number;
  caisseMouvements: number;
  auditLogs: number;
  pendingQueue: number;
  localStorageKeys: number;
}

export interface BackupHistoryEntry {
  id: string;
  createdAt: string;
  trigger: 'scheduled' | 'manual';
  filename: string;
  sizeBytes: number;
  recordCounts: BackupRecordCounts;
  checksum: string;
}

export interface FullBackupPackage {
  schemaVersion: '1.0.0';
  application: 'PMES-AGR Dosso';
  exportedAt: string;
  trigger: 'scheduled' | 'manual';
  createdBy: string;
  checksumSha256: string;
  options: {
    includeLocalStorage: boolean;
    includeIndexedDB: boolean;
    includeSecurityHashes: boolean;
  };
  summary: BackupRecordCounts;
  indexedDB?: {
    dbName: string;
    dbVersion: number;
    adminRecords: Record<string, any>;
    pendingSyncQueue: OfflineSyncItem[];
  };
  localStorage?: Record<string, any>;
}

export const DEFAULT_BACKUP_CONFIG: BackupScheduleConfig = {
  enabled: false,
  scheduledTime: '18:00',
  autoDownload: true,
  includeLocalStorage: true,
  includeIndexedDB: true,
  includeSecurityHashes: true,
  retentionCount: 14,
  lastBackupAt: null,
  lastBackupDateKey: null,
  lastBackupFilename: null,
  lastBackupSizeBytes: null,
};

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadBackupConfig(): BackupScheduleConfig {
  try {
    const raw = localStorage.getItem(BACKUP_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_BACKUP_CONFIG;
    return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BACKUP_CONFIG;
  }
}

export function saveBackupConfig(config: BackupScheduleConfig): BackupScheduleConfig {
  try {
    localStorage.setItem(BACKUP_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('[Backup] Impossible de sauvegarder la configuration:', err);
  }
  return config;
}

export function loadBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBackupHistory(
  entries: BackupHistoryEntry[],
  retentionCount: number = 14
): BackupHistoryEntry[] {
  const trimmed = entries.slice(0, Math.max(1, retentionCount));
  try {
    localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[Backup] Impossible de sauvegarder l\'historique:', err);
  }
  return trimmed;
}

function sanitizeSecurityFields(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sanitizeSecurityFields);
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'pin' || k === 'password') {
        copy[k] = '[REDACTED]';
      } else {
        copy[k] = sanitizeSecurityFields(v);
      }
    }
    return copy;
  }
  return value;
}

async function computeIntegrityDigest(content: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback FNV-1a
  }
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function collectLocalStorageState(includeSecurityHashes: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (typeof localStorage === 'undefined') return result;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    // Éviter la récursion sur le dernier blob stocké ou les données volatiles tierces
    if (key === BACKUP_LATEST_SNAPSHOT_KEY) continue;
    if (!key.startsWith('pmes_')) continue;

    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      const parsed = JSON.parse(raw);
      result[key] = includeSecurityHashes ? parsed : sanitizeSecurityFields(parsed);
    } catch {
      result[key] = raw;
    }
  }
  return result;
}

export function buildBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `pmes-dosso-backup-${yyyy}-${mm}-${dd}_${hh}h${min}.json`;
}

export async function createFullBackupPackage(params: {
  config: BackupScheduleConfig;
  trigger: 'scheduled' | 'manual';
  createdBy: string;
}): Promise<{
  pkg: FullBackupPackage;
  jsonString: string;
  entry: BackupHistoryEntry;
}> {
  const now = new Date();
  const { config, trigger, createdBy } = params;

  const localStorageData = config.includeLocalStorage
    ? collectLocalStorageState(config.includeSecurityHashes)
    : undefined;

  const rawIdbData = config.includeIndexedDB
    ? await exportAllOfflineDBStores()
    : undefined;

  const idbData = rawIdbData
    ? {
        dbName: OFFLINE_DB_NAME,
        dbVersion: OFFLINE_DB_VERSION,
        adminRecords: config.includeSecurityHashes
          ? rawIdbData.adminRecords
          : sanitizeSecurityFields(rawIdbData.adminRecords),
        pendingSyncQueue: config.includeSecurityHashes
          ? rawIdbData.pendingSyncQueue
          : sanitizeSecurityFields(rawIdbData.pendingSyncQueue),
      }
    : undefined;

  const membersArr =
    idbData?.adminRecords?.members?.data ||
    localStorageData?.pmes_dosso_members ||
    [];
  const txsArr =
    idbData?.adminRecords?.transactions?.data ||
    localStorageData?.pmes_dosso_transactions ||
    [];
  const retraitsArr =
    idbData?.adminRecords?.demandesRetrait?.data ||
    localStorageData?.pmes_dosso_retraits ||
    [];
  const finArr =
    idbData?.adminRecords?.demandesFinancement?.data ||
    localStorageData?.pmes_dosso_financements ||
    [];
  const caisseArr =
    idbData?.adminRecords?.caisseMouvements?.data ||
    localStorageData?.pmes_dosso_caisse_mouvements ||
    [];
  const auditArr = localStorageData?.pmes_dosso_audit || [];

  const summary: BackupRecordCounts = {
    members: Array.isArray(membersArr) ? membersArr.length : 0,
    transactions: Array.isArray(txsArr) ? txsArr.length : 0,
    retraits: Array.isArray(retraitsArr) ? retraitsArr.length : 0,
    financements: Array.isArray(finArr) ? finArr.length : 0,
    caisseMouvements: Array.isArray(caisseArr) ? caisseArr.length : 0,
    auditLogs: Array.isArray(auditArr) ? auditArr.length : 0,
    pendingQueue: idbData?.pendingSyncQueue?.length ?? 0,
    localStorageKeys: localStorageData ? Object.keys(localStorageData).length : 0,
  };

  const bodyWithoutChecksum = {
    schemaVersion: '1.0.0' as const,
    application: 'PMES-AGR Dosso' as const,
    exportedAt: now.toISOString(),
    trigger,
    createdBy,
    options: {
      includeLocalStorage: config.includeLocalStorage,
      includeIndexedDB: config.includeIndexedDB,
      includeSecurityHashes: config.includeSecurityHashes,
    },
    summary,
    ...(idbData ? { indexedDB: idbData } : {}),
    ...(localStorageData ? { localStorage: localStorageData } : {}),
  };

  const checksumSha256 = await computeIntegrityDigest(JSON.stringify(bodyWithoutChecksum));
  const pkg: FullBackupPackage = {
    ...bodyWithoutChecksum,
    checksumSha256,
  };

  const jsonString = JSON.stringify(pkg, null, 2);
  const sizeBytes = new Blob([jsonString]).size;
  const filename = buildBackupFilename(now);

  const entry: BackupHistoryEntry = {
    id: `bkp_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now.toISOString(),
    trigger,
    filename,
    sizeBytes,
    recordCounts: summary,
    checksum: checksumSha256,
  };

  // Mémoriser localement le dernier JSON si taille raisonnable (< 3.5 Mo) pour re-téléchargement direct
  try {
    if (sizeBytes < 3_500_000) {
      localStorage.setItem(BACKUP_LATEST_SNAPSHOT_KEY, jsonString);
    }
  } catch {
    // Quota localStorage dépassé: on continue sans bloquer le téléchargement
  }

  return { pkg, jsonString, entry };
}

export function triggerJsonDownload(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLatestCachedBackup(filename?: string | null): boolean {
  try {
    const raw = localStorage.getItem(BACKUP_LATEST_SNAPSHOT_KEY);
    if (!raw) return false;
    triggerJsonDownload(raw, filename || buildBackupFilename());
    return true;
  } catch {
    return false;
  }
}

export function shouldRunDailyBackup(
  config: BackupScheduleConfig,
  now: Date = new Date()
): boolean {
  if (!config.enabled) return false;
  const todayKey = getLocalDateKey(now);
  if (config.lastBackupDateKey === todayKey) return false;

  const [hhStr, mmStr] = (config.scheduledTime || '18:00').split(':');
  const targetHour = Number(hhStr);
  const targetMin = Number(mmStr);
  if (Number.isNaN(targetHour) || Number.isNaN(targetMin)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetHour * 60 + targetMin;
  return currentMinutes >= targetMinutes;
}

export function getNextScheduledLabel(config: BackupScheduleConfig, now: Date = new Date()): string {
  if (!config.enabled) return 'Planification désactivée';
  const todayKey = getLocalDateKey(now);
  const [hhStr, mmStr] = (config.scheduledTime || '18:00').split(':');
  const targetMinutes = Number(hhStr) * 60 + Number(mmStr);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (config.lastBackupDateKey === todayKey || currentMinutes >= targetMinutes) {
    return `Demain à ${config.scheduledTime}`;
  }
  return `Aujourd'hui à ${config.scheduledTime}`;
}

export async function validateBackupJsonFile(
  rawText: string
): Promise<{ valid: boolean; pkg?: FullBackupPackage; error?: string }> {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || parsed.application !== 'PMES-AGR Dosso' || !parsed.schemaVersion) {
      return { valid: false, error: 'Fichier incompatible : signature PMES-AGR Dosso manquante.' };
    }
    if (!parsed.localStorage && !parsed.indexedDB) {
      return { valid: false, error: 'Le fichier de sauvegarde ne contient aucune donnée exploitable.' };
    }
    return { valid: true, pkg: parsed as FullBackupPackage };
  } catch {
    return { valid: false, error: 'Format JSON invalide ou corrompu.' };
  }
}

export async function applyBackupPackageRestore(pkg: FullBackupPackage): Promise<void> {
  if (pkg.localStorage && typeof pkg.localStorage === 'object') {
    for (const [key, val] of Object.entries(pkg.localStorage)) {
      if (!key.startsWith('pmes_') || key === BACKUP_LATEST_SNAPSHOT_KEY) continue;
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    }
  }
  if (pkg.indexedDB) {
    await restoreOfflineDBStores({
      adminRecords: pkg.indexedDB.adminRecords,
      pendingSyncQueue: pkg.indexedDB.pendingSyncQueue,
    });
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
