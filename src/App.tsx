import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Member, Transaction, DemandeRetrait, DemandeFinancement, 
  Corporation, ZoneItem, ReceiptData, SyncStatus, CaisseMouvement, FinancementType,
  InvestissementProjet, InvestissementParticipation, AuditLog 
} from './types';
import { 
  INITIAL_USERS, INITIAL_MEMBERS, INITIAL_TRANSACTIONS, 
  INITIAL_DEMANDES_RETRAIT, INITIAL_DEMANDES_FINANCEMENT, 
  INITIAL_CORPORATIONS, INITIAL_ZONES, INITIAL_CAISSE_MOUVEMENTS, generateLivretNumber, 
  generateReceiptReference, APP_LOGO 
} from './data/initialData';
import { 
  fsInsert, fsUpsert, fsUpdate, fsDelete, fsFetchAll, testFirestoreConnection 
} from './services/firestore';
import { auth } from './lib/firebase';
import { 
  seedCloudSqlDatabase, fetchAllFromCloudSql, 
  dbSaveMember, dbUpdateMember, dbDeleteMember, dbSaveTransaction, dbUpdateTransaction,
  dbSaveRetrait, dbUpdateRetrait,
  dbSaveFinancement, dbUpdateFinancement, dbDeleteFinancement,
  dbSaveCaisseMouvement, dbSaveCorporation, dbUpdateCorporation,
  dbSaveZone
} from './services/cloudsql';
import { sendSMS, SMSTemplates, requestOTP, verifyOTP, OTPSendResponse, OTPVerifyResponse, OTPChannel } from './utils/smsUtils';
import { sendFirebasePhoneOTP, verifyFirebasePhoneOTP } from './services/firebasePhoneAuth';
import { uploadMemberPhoto } from './services/firebaseStorage';
import { requestNotificationPermission, notifyAdminNewRequest } from './utils/notificationUtils';
import { hashData, compareData } from './utils/authUtils';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  saveAdminSnapshotToIDB,
  loadAdminSnapshotFromIDB,
  enqueueOfflineOperation,
  getPendingOfflineOperations,
  flushOfflineSyncQueue,
  clearSyncedOfflineOperations,
  getOfflineCacheStats,
  OfflineSyncItem,
  OfflineCacheStats,
} from './services/offlineDb';
import {
  BackupScheduleConfig,
  BackupHistoryEntry,
  loadBackupConfig,
  saveBackupConfig,
  loadBackupHistory,
  saveBackupHistory,
  createFullBackupPackage,
  triggerJsonDownload,
  shouldRunDailyBackup,
  getLocalDateKey,
} from './services/backupService';
import { PWAInstallButton } from './components/common/PWAInstallButton';
import { ReceiptModal } from './components/common/ReceiptModal';
import { MemberCardModal } from './components/common/MemberCardModal';
import { LandingPage } from './components/landing/LandingPage';
import { MemberSpace } from './components/member/MemberSpace';
import { AdminSpace } from './components/admin/AdminSpace';
import { MemberAuthModal } from './components/auth/MemberAuthModal';
import { AdminAuthModal } from './components/auth/AdminAuthModal';
import { Wifi, WifiOff, Cloud, Shield, LogOut, CheckCircle, Moon, Sun, Lock, Key } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  const isOnline = useOnlineStatus();

  // Storage-backed state
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_users');
      return stored ? JSON.parse(stored) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_members');
      return stored ? JSON.parse(stored) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_transactions');
      return stored ? JSON.parse(stored) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [demandesRetrait, setDemandesRetrait] = useState<DemandeRetrait[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_retraits');
      return stored ? JSON.parse(stored) : INITIAL_DEMANDES_RETRAIT;
    } catch {
      return INITIAL_DEMANDES_RETRAIT;
    }
  });

  const [demandesFinancement, setDemandesFinancement] = useState<DemandeFinancement[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_financements');
      return stored ? JSON.parse(stored) : INITIAL_DEMANDES_FINANCEMENT;
    } catch {
      return INITIAL_DEMANDES_FINANCEMENT;
    }
  });

  const [corporations, setCorporations] = useState<Corporation[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_corpos');
      return stored ? JSON.parse(stored) : INITIAL_CORPORATIONS;
    } catch {
      return INITIAL_CORPORATIONS;
    }
  });

  const [zones, setZones] = useState<ZoneItem[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_zones');
      return stored ? JSON.parse(stored) : INITIAL_ZONES;
    } catch {
      return INITIAL_ZONES;
    }
  });

  const [caisseMouvements, setCaisseMouvements] = useState<CaisseMouvement[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_caisse_mouvements');
      return stored ? JSON.parse(stored) : INITIAL_CAISSE_MOUVEMENTS;
    } catch {
      return INITIAL_CAISSE_MOUVEMENTS;
    }
  });

  const [investissements, setInvestissements] = useState<InvestissementProjet[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_invests');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [participations, setParticipations] = useState<InvestissementParticipation[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_participations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('pmes_dosso_theme') as 'dark' | 'light') || 'dark';
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const stored = localStorage.getItem('pmes_dosso_audit');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Firebase connection & status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Navigation & Session
  const [currentView, setCurrentView] = useState<'landing' | 'member-space' | 'admin-space'>('landing');
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Modals
  const [showMemberAuth, setShowMemberAuth] = useState(false);
  const [memberAuthMode, setMemberAuthMode] = useState<'login' | 'register'>('login');
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [activeMemberCard, setActiveMemberCard] = useState<Member | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSyncItem[]>([]);
  const [offlineStats, setOfflineStats] = useState<OfflineCacheStats | null>(null);
  const [backupConfig, setBackupConfig] = useState<BackupScheduleConfig>(() => loadBackupConfig());
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>(() => loadBackupHistory());
  const backupRunningRef = useRef(false);
  const migratingHashesRef = useRef(false);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthReady(true);
      if (user) {
        setSyncStatus('connected');
        // If we just logged in, try to pull data
        pullFromFirebase(false);
      } else {
        setSyncStatus('local');
      }
    });
    return () => unsubscribe();
  }, []);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  const safeSetLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[Storage] Impossible d'enregistrer ${key}:`, err);
    }
  };

  const isStaffFirebaseSession = (): boolean => {
    const fbUser = auth.currentUser;
    if (!fbUser) return false;
    if (fbUser.emailVerified && fbUser.email === 'abdoulkadersad2@gmail.com') {
      return true;
    }
    const isPhoneOnly =
      !fbUser.email &&
      fbUser.providerData.some((p) => p.providerId === 'phone');
    if (isPhoneOnly) return false;
    if (currentUser && currentUser.role !== 'MAIRE') return true;
    return users.some(
      (u) =>
        u.id === fbUser.uid &&
        (u.role === 'ADMIN' || u.role === 'TRESORIER' || u.role === 'AGENT')
    );
  };

  const bgSyncFirestore = (op: () => Promise<any>) => {
    if (!isStaffFirebaseSession()) return;
    op().catch((err) => {
      console.warn('[Firestore background sync]', err);
    });
  };

  const refreshOfflineState = async () => {
    const [queue, stats] = await Promise.all([
      getPendingOfflineOperations(),
      getOfflineCacheStats(),
    ]);
    setOfflineQueue(queue);
    setOfflineStats(stats);
  };

  const syncOrEnqueue = async (
    dbCall: () => Promise<boolean>,
    item: Omit<OfflineSyncItem, 'id' | 'seq' | 'createdAt' | 'status' | 'retryCount'>
  ): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueOfflineOperation(item);
      await refreshOfflineState();
      return false;
    }
    const ok = await dbCall();
    if (!ok) {
      await enqueueOfflineOperation(item);
      await refreshOfflineState();
    }
    return ok;
  };

  const handleFlushOfflineQueue = async (notify = true) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (notify) showToast('Mode hors-ligne actif — synchronisation différée dès le retour réseau.');
      return;
    }
    const res = await flushOfflineSyncQueue();
    await refreshOfflineState();
    if (res.syncedCount > 0) {
      const dbState = await fetchAllFromCloudSql();
      if (dbState) {
        if (dbState.members?.length > 0) setMembers(dbState.members);
        if (dbState.transactions?.length > 0) setTransactions(dbState.transactions);
        if (dbState.retraits && dbState.retraits.length > 0) setDemandesRetrait(dbState.retraits);
        if (dbState.financements?.length > 0) setDemandesFinancement(dbState.financements);
        if (dbState.caisseMouvements?.length > 0) setCaisseMouvements(dbState.caisseMouvements);
      }
      if (notify) {
        showToast(`${res.syncedCount} opération(s) hors-ligne synchronisée(s) ✅`);
      }
    } else if (notify && res.remainingCount === 0) {
      showToast('Toutes les opérations hors-ligne sont déjà synchronisées.');
    } else if (notify && res.failedCount > 0) {
      showToast(`${res.failedCount} opération(s) restent en file d'attente.`);
    }
  };

  const handleRefreshOfflineCache = async () => {
    await saveAdminSnapshotToIDB({
      members,
      transactions,
      demandesRetrait,
      demandesFinancement,
      caisseMouvements,
      updatedAt: new Date().toISOString(),
    });
    await refreshOfflineState();
    showToast('Cache IndexedDB actualisé localement');
  };

  const handleClearSyncedOfflineOps = async () => {
    await clearSyncedOfflineOperations();
    await refreshOfflineState();
  };

  const executeLocalBackup = async (
    trigger: 'manual' | 'scheduled',
    configOverride?: BackupScheduleConfig
  ) => {
    if (backupRunningRef.current) return;
    backupRunningRef.current = true;
    try {
      const activeConfig = configOverride || backupConfig;
      await saveAdminSnapshotToIDB({
        members,
        transactions,
        demandesRetrait,
        demandesFinancement,
        caisseMouvements,
        updatedAt: new Date().toISOString(),
      });

      const { jsonString, entry } = await createFullBackupPackage({
        config: activeConfig,
        trigger,
        createdBy: currentUser?.nom || (trigger === 'scheduled' ? 'Planificateur' : 'Admin'),
      });

      if (trigger === 'manual' || activeConfig.autoDownload) {
        triggerJsonDownload(jsonString, entry.filename);
      }

      const nextConfig: BackupScheduleConfig = {
        ...activeConfig,
        lastBackupAt: entry.createdAt,
        lastBackupDateKey: getLocalDateKey(new Date()),
        lastBackupFilename: entry.filename,
        lastBackupSizeBytes: entry.sizeBytes,
      };
      setBackupConfig(saveBackupConfig(nextConfig));

      setBackupHistory((prev) =>
        saveBackupHistory([entry, ...prev], nextConfig.retentionCount)
      );

      if (currentUser) {
        addAuditLog(
          trigger === 'scheduled' ? 'Sauvegarde Quotidienne Auto' : 'Sauvegarde Manuelle JSON',
          `Archive JSON générée (${entry.filename}) avec ${entry.recordCounts.members} adhérents et ${entry.recordCounts.transactions} transactions.`,
          entry.filename,
          'info'
        );
      }

      showToast(
        trigger === 'scheduled'
          ? `Sauvegarde quotidienne automatique exportée (${entry.filename})`
          : `Sauvegarde JSON téléchargée (${entry.filename})`
      );
    } finally {
      backupRunningRef.current = false;
    }
  };

  const handleSaveBackupConfig = (nextConfig: BackupScheduleConfig) => {
    const saved = saveBackupConfig(nextConfig);
    setBackupConfig(saved);
    setBackupHistory((prev) => saveBackupHistory(prev, saved.retentionCount));
    if (currentUser) {
      addAuditLog(
        'Configuration Sauvegarde',
        `Planification quotidienne ${saved.enabled ? `activée à ${saved.scheduledTime}` : 'désactivée'}.`,
        undefined,
        'securite'
      );
    }
  };

  const handleClearBackupHistory = () => {
    setBackupHistory(saveBackupHistory([], backupConfig.retentionCount));
    showToast('Historique local des sauvegardes effacé.');
  };

  const handleRestoreBackupComplete = async () => {
    try {
      const storedUsers = localStorage.getItem('pmes_dosso_users');
      const storedMembers = localStorage.getItem('pmes_dosso_members');
      const storedTxs = localStorage.getItem('pmes_dosso_transactions');
      const storedRetraits = localStorage.getItem('pmes_dosso_retraits');
      const storedFin = localStorage.getItem('pmes_dosso_financements');
      const storedCorpos = localStorage.getItem('pmes_dosso_corpos');
      const storedZones = localStorage.getItem('pmes_dosso_zones');
      const storedCaisse = localStorage.getItem('pmes_dosso_caisse_mouvements');
      const storedInvests = localStorage.getItem('pmes_dosso_invests');
      const storedParts = localStorage.getItem('pmes_dosso_participations');
      const storedAudit = localStorage.getItem('pmes_dosso_audit');

      if (storedUsers) setUsers(JSON.parse(storedUsers));
      if (storedMembers) setMembers(JSON.parse(storedMembers));
      if (storedTxs) setTransactions(JSON.parse(storedTxs));
      if (storedRetraits) setDemandesRetrait(JSON.parse(storedRetraits));
      if (storedFin) setDemandesFinancement(JSON.parse(storedFin));
      if (storedCorpos) setCorporations(JSON.parse(storedCorpos));
      if (storedZones) setZones(JSON.parse(storedZones));
      if (storedCaisse) setCaisseMouvements(JSON.parse(storedCaisse));
      if (storedInvests) setInvestissements(JSON.parse(storedInvests));
      if (storedParts) setParticipations(JSON.parse(storedParts));
      if (storedAudit) setAuditLogs(JSON.parse(storedAudit));
    } catch {
      // Ignore malformed individual keys
    }
    await refreshOfflineState();
    showToast('État local restauré depuis la sauvegarde JSON ✅');
  };

  // Planificateur quotidien de sauvegarde locale (vérification au montage + toutes les 30 secondes)
  useEffect(() => {
    if (!backupConfig.enabled) return;

    const checkSchedule = () => {
      if (shouldRunDailyBackup(backupConfig, new Date())) {
        executeLocalBackup('scheduled', backupConfig);
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 30_000);
    return () => clearInterval(interval);
  }, [backupConfig, members, transactions, demandesRetrait, demandesFinancement, caisseMouvements]);

  const addAuditLog = (
    action: string, 
    details: string, 
    cible?: string, 
    categorie: 'critique' | 'info' | 'securite' = 'info'
  ) => {
    if (!currentUser) return;
    const log: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      date: new Date().toISOString(),
      action,
      acteur: currentUser.nom,
      role: currentUser.role,
      details,
      cible,
      categorie
    };
    setAuditLogs(prev => [log, ...prev].slice(0, 1000));
    bgSyncFirestore(() => fsInsert('audit_logs', log));
  };

  // Sync to localStorage (guarded against QuotaExceededError)
  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_retraits', JSON.stringify(demandesRetrait));
  }, [demandesRetrait]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_financements', JSON.stringify(demandesFinancement));
  }, [demandesFinancement]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_corpos', JSON.stringify(corporations));
  }, [corporations]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_zones', JSON.stringify(zones));
  }, [zones]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_caisse_mouvements', JSON.stringify(caisseMouvements));
  }, [caisseMouvements]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_invests', JSON.stringify(investissements));
  }, [investissements]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_participations', JSON.stringify(participations));
  }, [participations]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    safeSetLocalStorage('pmes_dosso_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // AUTO-MIGRATION: Hash plain text passwords/PINs
  useEffect(() => {
    const needsMigration =
      members.some(m => m.pin && !m.pin.startsWith('$2a$') && !m.pin.startsWith('$2b$')) ||
      users.some(u => u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$'));

    if (!needsMigration || migratingHashesRef.current) return;

    const migrateHashes = async () => {
      migratingHashesRef.current = true;
      try {
        const migratedMembers: Member[] = [];
        const migratedUsers: User[] = [];

        const updatedMembers = await Promise.all(members.map(async (m) => {
          if (m.pin && !m.pin.startsWith('$2a$') && !m.pin.startsWith('$2b$')) {
            const hashed = await hashData(m.pin);
            const nextMember = { ...m, pin: hashed };
            migratedMembers.push(nextMember);
            return nextMember;
          }
          return m;
        }));

        const updatedUsers = await Promise.all(users.map(async (u) => {
          if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
            const hashed = await hashData(u.password);
            const nextUser = { ...u, password: hashed };
            migratedUsers.push(nextUser);
            return nextUser;
          }
          return u;
        }));

        if (migratedMembers.length > 0) {
          setMembers(updatedMembers);
          if (isOnline) {
            migratedMembers.forEach(m => {
              dbUpdateMember(m.id, { pin: m.pin }).catch(() => {});
            });
          }
        }
        if (migratedUsers.length > 0) {
          setUsers(updatedUsers);
        }

        // Update only documents that already exist in Firestore (skips unpushed Cloud SQL / local docs)
        if (isOnline && isStaffFirebaseSession()) {
          migratedMembers.forEach(m => bgSyncFirestore(() => fsUpdate('members', m.id, { pin: m.pin })));
          migratedUsers.forEach(u => bgSyncFirestore(() => fsUpdate('users', u.id, { password: u.password })));
        }
      } finally {
        migratingHashesRef.current = false;
      }
    };

    migrateHashes();
  }, [members, users, isOnline, syncStatus]);

  // Hydrate offline snapshot on mount & listen for Service Worker Background Sync completions
  useEffect(() => {
    let mounted = true;
    loadAdminSnapshotFromIDB().then((snap) => {
      if (!mounted || !snap) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (snap.members?.length > 0) setMembers(snap.members);
        if (snap.transactions?.length > 0) setTransactions(snap.transactions);
        if (snap.demandesRetrait?.length > 0) setDemandesRetrait(snap.demandesRetrait);
        if (snap.demandesFinancement?.length > 0) setDemandesFinancement(snap.demandesFinancement);
        if (snap.caisseMouvements?.length > 0) setCaisseMouvements(snap.caisseMouvements);
      }
    });
    refreshOfflineState();

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PMES_SYNC_COMPLETE') {
        refreshOfflineState();
        fetchAllFromCloudSql().then((dbState) => {
          if (!dbState) return;
          if (dbState.members?.length > 0) setMembers(dbState.members);
          if (dbState.transactions?.length > 0) setTransactions(dbState.transactions);
          if (dbState.retraits && dbState.retraits.length > 0) setDemandesRetrait(dbState.retraits);
          if (dbState.financements?.length > 0) setDemandesFinancement(dbState.financements);
          if (dbState.caisseMouvements?.length > 0) setCaisseMouvements(dbState.caisseMouvements);
        });
        if (event.data.syncedCount > 0) {
          showToast(`${event.data.syncedCount} opération(s) synchronisée(s) en arrière-plan`);
        }
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      mounted = false;
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  // Persist admin/member records to IndexedDB for offline access
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAdminSnapshotToIDB({
        members,
        transactions,
        demandesRetrait,
        demandesFinancement,
        caisseMouvements,
        updatedAt: new Date().toISOString(),
      }).then(() => {
        refreshOfflineState();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [members, transactions, demandesRetrait, demandesFinancement, caisseMouvements]);

  // Initial Cloud SQL & Offline Queue reconciliation on mount / reconnect
  useEffect(() => {
    const initCloudSql = async () => {
      if (isOnline) {
        // Flush any queued offline mutations before pulling fresh state from Cloud SQL
        const flushResult = await flushOfflineSyncQueue();
        await refreshOfflineState();
        if (flushResult.syncedCount > 0) {
          showToast(`${flushResult.syncedCount} opération(s) hors-ligne synchronisée(s) ✅`);
        }

        // Auto-seed PostgreSQL if empty
        await seedCloudSqlDatabase({
          initialCorporations: INITIAL_CORPORATIONS,
          initialZones: INITIAL_ZONES,
          initialMembers: INITIAL_MEMBERS,
          initialTransactions: INITIAL_TRANSACTIONS,
          initialRetraits: INITIAL_DEMANDES_RETRAIT,
          initialFinancements: INITIAL_DEMANDES_FINANCEMENT,
          initialCaisseMouvements: INITIAL_CAISSE_MOUVEMENTS,
        });

        const dbState = await fetchAllFromCloudSql();
        if (dbState) {
          if (dbState.corporations?.length > 0) setCorporations(dbState.corporations);
          if (dbState.zones?.length > 0) setZones(dbState.zones);
          if (dbState.members?.length > 0) {
            setMembers(prev =>
              dbState.members.map(dbM => {
                const localM = prev.find(lm => lm.id === dbM.id);
                if (!localM) return dbM;
                return {
                  ...dbM,
                  objectif_montant: dbM.objectif_montant ?? localM.objectif_montant,
                  objectif_date: dbM.objectif_date ?? localM.objectif_date,
                  objectif_label: dbM.objectif_label ?? localM.objectif_label,
                };
              })
            );
          }
          if (dbState.transactions?.length > 0) setTransactions(dbState.transactions);
          if (dbState.retraits && dbState.retraits.length > 0) setDemandesRetrait(dbState.retraits);
          if (dbState.financements?.length > 0) setDemandesFinancement(dbState.financements);
          if (dbState.caisseMouvements?.length > 0) setCaisseMouvements(dbState.caisseMouvements);
        }

        testFirestoreConnection().then(ok => {
          if (!ok) setSyncStatus('error');
        });
      } else {
        // Offline: ensure UI displays latest IndexedDB snapshot & cached SW state
        const snap = await loadAdminSnapshotFromIDB();
        if (snap) {
          if (snap.members?.length > 0) setMembers(snap.members);
          if (snap.transactions?.length > 0) setTransactions(snap.transactions);
          if (snap.demandesRetrait?.length > 0) setDemandesRetrait(snap.demandesRetrait);
          if (snap.demandesFinancement?.length > 0) setDemandesFinancement(snap.demandesFinancement);
          if (snap.caisseMouvements?.length > 0) setCaisseMouvements(snap.caisseMouvements);
        }
        await refreshOfflineState();
      }
    };

    initCloudSql();
  }, [isOnline]);

  // Handle Firebase Pull (Merge remote records with local)
  const pullFromFirebase = async (notify = true) => {
    // SECURITY CHECK: Don't attempt to fetch if no user is authenticated
    if (!auth.currentUser) {
      if (notify) showToast('Connexion requise pour la synchronisation');
      setSyncStatus('local');
      return;
    }

    setSyncStatus('connecting');
    try {
      const [remoteMembers, remoteUsers, remoteInvests, remoteParts] = await Promise.all([
        fsFetchAll<Member>('members'),
        fsFetchAll<User>('users'),
        fsFetchAll<InvestissementProjet>('investissements'),
        fsFetchAll<InvestissementParticipation>('participations'),
      ]);

      if (remoteInvests) setInvestissements(remoteInvests);
      if (remoteParts) setParticipations(remoteParts);

      if (remoteMembers && remoteMembers.length > 0) {
        setMembers(prev => {
          const merged = [...prev];
          remoteMembers.forEach(rm => {
            const idx = merged.findIndex(m => m.id === rm.id || m.telephone === rm.telephone);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...rm };
            } else {
              merged.push(rm);
            }
          });
          return merged;
        });
      }

      if (remoteUsers && remoteUsers.length > 0) {
        setUsers(prev => {
          const merged = [...prev];
          remoteUsers.forEach(ru => {
            const idx = merged.findIndex(u => u.username === ru.username);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...ru };
            } else {
              merged.push(ru);
            }
          });
          return merged;
        });
      }

      setSyncStatus('connected');
      if (notify) showToast('Synchronisation Firebase réussie ✅');
    } catch (err: any) {
      console.warn('Sync pull failed:', err);
      
      // Check if it's a permission error (means we ARE connected, just not authorized)
      const isPermissionError = err?.message?.includes('permission') || err?.message?.includes('403');
      
      if (isPermissionError) {
        setSyncStatus('connected');
        if (notify) showToast('Connecté à Firebase - Authentification requise pour synchroniser');
      } else {
        setSyncStatus('local');
        if (notify) showToast('Mode local actif - Impossible de joindre Firebase');
      }
    }
  };

  // Push local state to Firebase
  const pushToFirebase = async () => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en lecture seule.');
      return;
    }
    if (!auth.currentUser) {
      showToast('Connectez-vous avec Google Admin pour pousser les données vers Firebase Firestore.');
      return;
    }
    setSyncStatus('connecting');
    showToast('Envoi des données vers Firebase en cours...');
    try {
      const pushedMemberIds = new Set<string>();
      for (const m of members) {
        await fsUpsert('members', m.id, m);
        pushedMemberIds.add(m.id);
      }
      if (currentUser) {
        await fsUpsert('users', auth.currentUser.uid, { ...currentUser, id: auth.currentUser.uid });
      }
      for (const u of users) {
        await fsUpsert('users', u.id, u);
      }
      for (const t of transactions) {
        if (pushedMemberIds.has(t.member_id)) {
          await fsUpsert('transactions', t.id, t);
        }
      }
      setSyncStatus('connected');
      showToast('Toutes les données ont été envoyées vers Firebase ✅');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showToast('Erreur lors de l\'envoi vers Firebase');
    }
  };

  // MEMBER AUTH HANDLERS
  const handleMemberLogin = async (telephone: string, pin: string): Promise<boolean> => {
    const found = members.find(m => m.telephone === telephone);
    if (!found) return false;
    if (found.status === 'rejete') return false;

    const isMatch = await compareData(pin, found.pin || '');
    if (!isMatch) return false;

    setCurrentMember(found);
    setShowMemberAuth(false);
    setCurrentView('member-space');
    showToast(`Bienvenue ${found.nom} ! Livret ${found.livret}`);
    
    // Demander la permission pour les notifications locales
    requestNotificationPermission();

    return true;
  };

  const handleMemberRegister = async (
    nom: string, 
    telephone: string, 
    pin: string, 
    zone: string, 
    corporationId: string, 
    photo?: string
  ): Promise<boolean> => {
    if (members.some(m => m.telephone === telephone)) {
      return false;
    }
    const corpo = corporations.find(c => c.id === corporationId);
    const memberId = `m_${Date.now()}`;

    // Si une photo a été fournie, on tente d'abord l'upload sur Firebase Storage
    let finalPhoto = photo;
    if (photo) {
      const uploadRes = await uploadMemberPhoto(memberId, photo);
      finalPhoto = uploadRes.url;
    }
    
    // Hash the PIN before saving
    const hashedPin = await hashData(pin);

    const newMember: Member = {
      id: memberId,
      nom,
      telephone,
      pin: hashedPin,
      livret: generateLivretNumber(),
      zone,
      corporationId,
      corporationNom: corpo?.nom || 'Commerce',
      corporationEmoji: corpo?.emoji || '🛍️',
      solde: 0,
      status: 'en_attente',
      created_at: new Date().toISOString(),
      photo: finalPhoto,
    };

    setMembers(prev => [...prev, newMember]);
    syncOrEnqueue(() => dbSaveMember(newMember), {
      entityType: 'member',
      actionLabel: 'Inscription adhérent',
      summary: `${newMember.nom} (${newMember.livret})`,
      endpoint: '/api/db/members',
      method: 'POST',
      payload: newMember,
    });
    bgSyncFirestore(() => fsUpsert('members', newMember.id, newMember));
    showToast(`Livret ${newMember.livret} créé avec succès ! En attente de validation par la caisse.`);
    return true;
  };

  const handleSendOTP = async (
    telephone: string,
    channel: OTPChannel = 'firebase'
  ): Promise<OTPSendResponse> => {
    const result =
      channel === 'firebase'
        ? await sendFirebasePhoneOTP(telephone, 'firebase-recaptcha-container')
        : await requestOTP(telephone);

    if (result.success) {
      showToast(
        result.provider === 'sandbox'
          ? `Code OTP généré (mode sandbox) pour +227 ${telephone}`
          : result.provider === 'firebase-phone'
            ? `Code SMS envoyé via Firebase Auth au +227 ${telephone}`
            : `Code de confirmation envoyé par SMS au +227 ${telephone}`
      );
    } else {
      showToast(result.error || "Erreur lors de l'envoi du code. Veuillez réessayer.");
    }
    return result;
  };

  const handleVerifyOTP = async (
    telephone: string,
    code: string,
    channel: OTPChannel = 'firebase'
  ): Promise<OTPVerifyResponse> => {
    return channel === 'firebase'
      ? await verifyFirebasePhoneOTP(telephone, code)
      : await verifyOTP(telephone, code);
  };

  const handleResetMemberPin = async (telephone: string, newPin: string): Promise<boolean> => {
    const cleanTel = telephone.replace(/\D/g, '').slice(-8);
    const target = members.find(m => m.telephone === cleanTel);
    if (!target) {
      showToast('Aucun livret trouvé pour ce numéro.');
      return false;
    }
    const hashedPin = await hashData(newPin);
    setMembers(prev => prev.map(m => m.id === target.id ? { ...m, pin: hashedPin } : m));
    dbUpdateMember(target.id, { pin: hashedPin });
    bgSyncFirestore(() => fsUpdate('members', target.id, { pin: hashedPin }, { ...target, pin: hashedPin }));
    showToast(`Code PIN réinitialisé avec succès pour ${target.nom} ✅`);
    return true;
  };

  const handleUpdateMemberPhoto = async (memberId: string, photoSource: string | File): Promise<string | void> => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }

    const uploadResult = await uploadMemberPhoto(memberId, photoSource);
    const finalPhotoUrl = uploadResult.url;

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, photo: finalPhotoUrl } : m));
    if (currentMember && currentMember.id === memberId) {
      setCurrentMember(prev => prev ? { ...prev, photo: finalPhotoUrl } : null);
    }
    if (activeMemberCard && activeMemberCard.id === memberId) {
      setActiveMemberCard(prev => prev ? { ...prev, photo: finalPhotoUrl } : null);
    }
    dbUpdateMember(memberId, { photo: finalPhotoUrl });
    const existingMember = members.find(m => m.id === memberId);
    bgSyncFirestore(() =>
      fsUpdate(
        'members',
        memberId,
        { photo: finalPhotoUrl },
        existingMember ? { ...existingMember, photo: finalPhotoUrl } : undefined
      )
    );
    showToast(
      uploadResult.storageProvider === 'firebase-storage'
        ? "Photo d'identité enregistrée dans Firebase Storage 📸"
        : "Photo enregistrée localement (Firebase Storage en attente d'activation) 📸"
    );
    return finalPhotoUrl;
  };

  // ADMIN AUTH HANDLERS
  const handleAdminLogin = async (username: string, password: string): Promise<boolean> => {
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!found) return false;

    const isMatch = await compareData(password, found.password || '');
    if (!isMatch) return false;

    setCurrentUser(found);
    setShowAdminAuth(false);
    setCurrentView('admin-space');
    showToast(`Connecté en tant que ${found.role} • ${found.nom}`);
    
    // Demander la permission pour les notifications locales (alertes admin)
    requestNotificationPermission();

    return true;
  };

  const handleGoogleLogin = async (): Promise<boolean> => {
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { googleAuthProvider } = await import('./lib/firebase');
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = credential.user;
      const email = fbUser.email || '';

      const matchedStaff = users.find(
        (u) =>
          u.username.toLowerCase() === email.toLowerCase() ||
          u.id === fbUser.uid
      );

      const adminUser: User = matchedStaff || {
        id: fbUser.uid,
        username: email || `google_${fbUser.uid.slice(0, 6)}`,
        nom: fbUser.displayName || email.split('@')[0] || 'Administrateur Google',
        role: 'ADMIN',
        zone: 'Dosso Centre',
        created_at: new Date().toISOString(),
      };

      if (!matchedStaff) {
        setUsers((prev) =>
          prev.some((u) => u.id === adminUser.id) ? prev : [...prev, adminUser]
        );
      }

      setCurrentUser(adminUser);
      setShowAdminAuth(false);
      setCurrentView('admin-space');
      requestNotificationPermission();

      // Sync auth user profile to PostgreSQL & Firestore in background
      fbUser.getIdToken().then((token) => {
        fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nom: adminUser.nom }),
        }).catch(() => {});
      }).catch(() => {});

      bgSyncFirestore(() =>
        fsInsert('users', {
          id: fbUser.uid,
          username: adminUser.username,
          nom: adminUser.nom,
          role: adminUser.role,
          zone: adminUser.zone,
          created_at: adminUser.created_at,
        })
      );

      showToast(`Connecté en tant que ${adminUser.role} • ${adminUser.nom} ✅`);
      return true;
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      showToast(`Erreur d'authentification : ${error?.message || 'Échec Google Sign-In'}`);
      return false;
    }
  };

  // MEMBER ACTIONS
  const handleMemberDemandeRetrait = (montant: number, motif: string) => {
    if (!currentMember) return;
    const demande: DemandeRetrait = {
      id: `dr_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: currentMember.id,
      montant,
      motif,
      status: 'en_attente',
      date: new Date().toISOString(),
      type: 'retrait',
    };
    setDemandesRetrait(prev => [demande, ...prev]);
    syncOrEnqueue(() => dbSaveRetrait(demande), {
      entityType: 'retrait_decision',
      actionLabel: 'Demande retrait',
      summary: `${currentMember.nom} · ${montant.toLocaleString()} F`,
      endpoint: '/api/db/retraits',
      method: 'POST',
      payload: demande,
    });
    bgSyncFirestore(() => fsInsert('retraits', demande));
    
    // Notification locale (PWA)
    notifyAdminNewRequest('retrait', currentMember.nom, montant);

    showToast(`Demande de retrait de ${montant.toLocaleString()} F CFA enregistrée.`);
  };

  const handleMemberDemandeFinancement = (
    montant: number, 
    dureeMois: number, 
    motif: string, 
    financementType: FinancementType,
    frequence: 'hebdomadaire' | 'mensuel',
    margeOuProfit?: number
  ) => {
    if (!currentMember) return;
    
    // Total calculé selon le type de financement (PAS de 5% systématique)
    let total = montant;
    let margeCommerciale: number | undefined = undefined;
    let partagePct: number | undefined = undefined;

    if (financementType === 'mourabaha') {
      margeCommerciale = margeOuProfit || 0;
      total = montant + margeCommerciale;
    } else if (financementType === 'moudaraba') {
      partagePct = margeOuProfit || 20;
      total = montant; // Le capital d'origine est remboursé selon l'échéancier et les profits partagés
    } else {
      // Qard al Hassane : 0% frais / 0% intérêt
      total = montant;
    }

    const nb = frequence === 'hebdomadaire' ? dureeMois * 4 : dureeMois;
    const part = Math.round(total / nb);

    const echeances = Array.from({ length: nb }).map((_, i) => ({
      numero: i + 1,
      date: new Date(Date.now() + (i + 1) * (frequence === 'hebdomadaire' ? 7 : 30) * 86400000).toISOString().slice(0, 10),
      montant: part,
      paye: false,
    }));

    const demande: DemandeFinancement = {
      id: `df_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: currentMember.id,
      montant,
      duree_mois: dureeMois,
      motif,
      status: 'en_attente',
      date: new Date().toISOString(),
      type: 'financement',
      financement_type: financementType,
      frequence,
      montant_total: total,
      montant_rembourse: 0,
      marge_beneficiaire: margeCommerciale,
      partage_profit_pct: partagePct,
      cout_achat: financementType === 'mourabaha' ? montant : undefined,
      echeances,
    };

    setDemandesFinancement(prev => [demande, ...prev]);
    syncOrEnqueue(() => dbSaveFinancement(demande), {
      entityType: 'financement_decision',
      actionLabel: 'Demande financement',
      summary: `${currentMember.nom} · ${montant.toLocaleString()} F`,
      endpoint: '/api/db/financements',
      method: 'POST',
      payload: demande,
    });
    bgSyncFirestore(() => fsInsert('financements', demande));

    // Notification locale (PWA)
    notifyAdminNewRequest('financement', currentMember.nom, montant);

    const typeNom = financementType === 'mourabaha' ? 'Mourabaha' : financementType === 'moudaraba' ? 'Moudaraba' : 'Qard Al Hassane';
    showToast(`Dossier de financement ${typeNom} de ${montant.toLocaleString()} F CFA soumis à la commission.`);
  };

  const handleUpdatePin = async (currentPin: string, newPin: string): Promise<boolean> => {
    if (!currentMember) return false;
    const isCurrentValid = await compareData(currentPin, currentMember.pin || '');
    if (!isCurrentValid) {
      showToast('Code PIN actuel incorrect.');
      return false;
    }
    const hashedPin = await hashData(newPin);
    const updated = { ...currentMember, pin: hashedPin };
    setCurrentMember(updated);
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    dbUpdateMember(updated.id, { pin: hashedPin });
    bgSyncFirestore(() => fsUpdate('members', updated.id, { pin: hashedPin }, updated));
    showToast('Code PIN modifié avec succès.');
    return true;
  };

  // ADMIN ACTIONS
  const handleValidateMember = (memberId: string) => {
    if (currentUser?.role === 'MAIRE' || currentUser?.role === 'AGENT') {
      showToast('Action non autorisée : Seuls l\'Admin et le Trésorier peuvent valider les adhésions.');
      return;
    }
    const target = members.find(m => m.id === memberId);
    if (!target) return;
    if (target.status === 'valide') {
      showToast('Cet adhérent est déjà validé.');
      return;
    }

    // Frais d'adhésion de la corporation
    const corpo = corporations.find(c => c.id === target.corporationId);
    const frais = corpo?.frais_adhesion || 5000;

    // Créditer la Caisse Financement avec les frais d'adhésion
    const mvAdhesion: CaisseMouvement = {
      id: `cm_adh_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'adhesion',
      montant: frais,
      member_id: target.id,
      member_nom: target.nom,
      corporation_nom: corpo?.nom || 'Corporation',
      description: `Frais d'adhésion corporation ${corpo?.nom || ''} (${target.nom})`,
      agent: currentUser?.username || 'admin',
    };

    setCaisseMouvements(prev => [mvAdhesion, ...prev]);
    syncOrEnqueue(() => dbSaveCaisseMouvement(mvAdhesion), {
      entityType: 'caisse_mouvement',
      actionLabel: 'Frais adhésion',
      summary: `${target.nom} · ${frais.toLocaleString()} F`,
      endpoint: '/api/db/caisse-mouvements',
      method: 'POST',
      payload: mvAdhesion,
    });
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mvAdhesion));

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'valide' } : m));
    syncOrEnqueue(() => dbUpdateMember(memberId, { status: 'valide' }), {
      entityType: 'member_update',
      actionLabel: 'Validation adhérent',
      summary: `${target.nom} (${target.livret})`,
      endpoint: `/api/db/members/${encodeURIComponent(memberId)}`,
      method: 'PATCH',
      payload: { status: 'valide' },
    });
    bgSyncFirestore(() => fsUpdate('members', memberId, { status: 'valide' }, { ...target, status: 'valide' }));
    addAuditLog('Validation Membre', `L'adhérent a été validé et les frais d'adhésion (${frais} F) ont été encaissés.`, target.nom, 'critique');
    
    // SMS Notification
    sendSMS({
      to: target.telephone,
      message: SMSTemplates.adhesionValidee(target.nom, target.livret),
      type: 'system'
    });

    showToast(`Adhérent validé avec succès ✅ Frais d'adhésion (${frais.toLocaleString()} F) reversés à la Caisse Financement`);
  };

  const handleRejectMember = (memberId: string) => {
    if (currentUser?.role === 'MAIRE' || currentUser?.role === 'AGENT') {
      showToast('Action non autorisée.');
      return;
    }
    const target = members.find(m => m.id === memberId);
    if (!target || target.status !== 'en_attente') return;
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'rejete' } : m));
    syncOrEnqueue(() => dbUpdateMember(memberId, { status: 'rejete' }), {
      entityType: 'member_update',
      actionLabel: 'Rejet adhérent',
      summary: `${target.nom || memberId}`,
      endpoint: `/api/db/members/${encodeURIComponent(memberId)}`,
      method: 'PATCH',
      payload: { status: 'rejete' },
    });
    bgSyncFirestore(() => fsUpdate('members', memberId, { status: 'rejete' }, { ...target, status: 'rejete' }));
    addAuditLog('Rejet Membre', `L'adhésion de l'utilisateur a été rejetée par la direction.`, target.nom || 'Inconnu', 'securite');
    showToast('Adhérent rejeté');
  };

  const handleAddMemberByAdmin = async (newM: Omit<Member, 'id' | 'created_at'>): Promise<boolean> => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return false;
    }

    const cleanTel = newM.telephone.replace(/\D/g, '').slice(-8);
    if (cleanTel.length !== 8) {
      showToast('Erreur : Numéro de téléphone invalide (8 chiffres requis).');
      return false;
    }

    // VERIFICATION DUPLICATA TELEPHONE
    const duplicate = members.find(m => m.telephone === cleanTel);
    if (duplicate) {
      showToast(`Erreur : Le numéro ${cleanTel} est déjà utilisé par ${duplicate.nom} (Livret ${duplicate.livret}).`);
      return false;
    }

    const hashedPin = newM.pin && (newM.pin.startsWith('$2a$') || newM.pin.startsWith('$2b$'))
      ? newM.pin
      : await hashData(newM.pin || '1234');

    const member: Member = {
      ...newM,
      telephone: cleanTel,
      pin: hashedPin,
      id: `m_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    // Créditer la Caisse Financement avec les frais d'adhésion planifiés de la corporation
    const corpo = corporations.find(c => c.id === member.corporationId);
    const frais = corpo?.frais_adhesion || 5000;

    const mvAdhesion: CaisseMouvement = {
      id: `cm_adh_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'adhesion',
      montant: frais,
      member_id: member.id,
      member_nom: member.nom,
      corporation_nom: corpo?.nom || 'Corporation',
      description: `Frais d'adhésion corporation ${corpo?.nom || ''} (${member.nom})`,
      agent: currentUser?.username || 'admin',
    };

    setCaisseMouvements(prev => [mvAdhesion, ...prev]);
    syncOrEnqueue(() => dbSaveCaisseMouvement(mvAdhesion), {
      entityType: 'caisse_mouvement',
      actionLabel: 'Frais adhésion',
      summary: `${member.nom} · ${frais.toLocaleString()} F`,
      endpoint: '/api/db/caisse-mouvements',
      method: 'POST',
      payload: mvAdhesion,
    });
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mvAdhesion));

    setMembers(prev => [...prev, member]);
    syncOrEnqueue(() => dbSaveMember(member), {
      entityType: 'member',
      actionLabel: 'Nouvel adhérent',
      summary: `${member.nom} (${member.livret})`,
      endpoint: '/api/db/members',
      method: 'POST',
      payload: member,
    });
    bgSyncFirestore(() => fsInsert('members', member));
    addAuditLog('Inscription Membre', `Nouvel adhérent inscrit dans la zone ${member.zone} avec un versement initial de ${member.solde} F.`, member.nom, 'info');
    showToast(`Adhérent ${member.nom} inscrit ! Frais d'adhésion (${frais.toLocaleString()} F CFA) crédités dans la Caisse Financement.`);
    return true;
  };

  const handleUpdateMember = (memberId: string, updates: Partial<Member>): boolean => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Action réservée à l\'administrateur');
      return false;
    }

    const cleanUpdates: Partial<Member> = { ...updates };

    // NORMALISATION & VERIFICATION DUPLICATA TELEPHONE SI CHANGEMENT
    if (cleanUpdates.telephone !== undefined) {
      const cleanTel = cleanUpdates.telephone.replace(/\D/g, '').slice(-8);
      if (cleanTel.length !== 8) {
        showToast('Erreur : Numéro de téléphone invalide (8 chiffres requis).');
        return false;
      }
      const duplicate = members.find(m => m.telephone === cleanTel && m.id !== memberId);
      if (duplicate) {
        showToast(`Erreur : Le numéro ${cleanTel} est déjà utilisé par ${duplicate.nom}.`);
        return false;
      }
      cleanUpdates.telephone = cleanTel;
    }

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...cleanUpdates } : m));
    if (currentMember && currentMember.id === memberId) {
      setCurrentMember(prev => prev ? { ...prev, ...cleanUpdates } : null);
    }
    if (activeMemberCard && activeMemberCard.id === memberId) {
      setActiveMemberCard(prev => prev ? { ...prev, ...cleanUpdates } : null);
    }
    syncOrEnqueue(() => dbUpdateMember(memberId, cleanUpdates), {
      entityType: 'member_update',
      actionLabel: 'Mise à jour adhérent',
      summary: `${cleanUpdates.nom || memberId}`,
      endpoint: `/api/db/members/${encodeURIComponent(memberId)}`,
      method: 'PATCH',
      payload: cleanUpdates as Record<string, any>,
    });
    const existingMember = members.find(m => m.id === memberId);
    bgSyncFirestore(() =>
      fsUpdate(
        'members',
        memberId,
        cleanUpdates,
        existingMember ? { ...existingMember, ...cleanUpdates } : undefined
      )
    );
    showToast(`Profil de l'adhérent mis à jour avec succès ✅`);
    return true;
  };

  const handleDeleteMember = (memberId: string): boolean => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Action réservée à l\'administrateur');
      return false;
    }
    
    // Check for related data first (client-side check for safety)
    const hasTransactions = transactions.some(t => t.member_id === memberId);
    const hasFinancements = demandesFinancement.some(f => f.member_id === memberId);
    
    if (hasTransactions || hasFinancements) {
      showToast('Impossible de supprimer : Cet adhérent possède des transactions ou des financements actifs.');
      return false;
    }

    setMembers(prev => prev.filter(m => m.id !== memberId));
    bgSyncFirestore(() => fsDelete('members', memberId));
    dbDeleteMember(memberId);
    showToast('Adhérent supprimé définitivement.');
    return true;
  };

  const handleAddHealthContribution = (memberId: string, montant: number, note?: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Compte en lecture seule.');
      return;
    }
    const m = members.find(item => item.id === memberId);
    const mouvement: CaisseMouvement = {
      id: `cm_health_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'cotisation_sante',
      montant,
      member_id: memberId,
      member_nom: m?.nom,
      description: note || `Cotisation santé pour ${m?.nom || 'Membre'}`,
      agent: currentUser?.username || 'agent',
    };

    setCaisseMouvements(prev => [mouvement, ...prev]);
    dbSaveCaisseMouvement(mouvement);
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mouvement));
    showToast(`Cotisation santé de ${montant.toLocaleString()} F enregistrée pour ${m?.nom || 'Adhérent'} 🩺`);
  };

  const handleAddSocialAssistance = (memberId: string, montant: number, motif: 'accident' | 'maladie' | 'accouchement' | 'deces', note?: string) => {
    if (currentUser?.role === 'MAIRE' || currentUser?.role === 'AGENT') {
      showToast('Action non autorisée : Seuls l\'Admin et le Trésorier peuvent décaisser des aides sociales.');
      return;
    }
    const m = members.find(item => item.id === memberId);
    
    // Check fund balance first
    const fundBalance = (caisseMouvements || [])
      .filter(mov => mov.type === 'cotisation_sante' || mov.type === 'assistance_sociale')
      .reduce((sum, mov) => sum + (mov.type === 'cotisation_sante' ? mov.montant : -mov.montant), 0);
    
    if (fundBalance < montant) {
      showToast(`Solde Fonds Social insuffisant (${fundBalance.toLocaleString()} F dispo).`);
      return;
    }

    const motifLabels = {
      'accident': 'Accident',
      'maladie': 'Maladie',
      'accouchement': 'Accouchement',
      'deces': 'Décès'
    };

    const mouvement: CaisseMouvement = {
      id: `cm_social_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'assistance_sociale',
      montant,
      member_id: memberId,
      member_nom: m?.nom,
      motif_social: motif,
      description: note || `Assistance sociale (${motifLabels[motif]}) pour ${m?.nom || 'Membre'}`,
      agent: currentUser?.username || 'admin',
    };

    setCaisseMouvements(prev => [mouvement, ...prev]);
    dbSaveCaisseMouvement(mouvement);
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mouvement));
    addAuditLog('Décaissement Social', `Aide sociale de ${montant} F décaissée pour un motif de ${motifLabels[motif]}.`, m?.nom, 'critique');
    showToast(`Assistance sociale décaissée pour ${m?.nom || 'Adhérent'} (Motif: ${motifLabels[motif]}) 🤝`);
  };

  const handleCollecteDepot = (memberId: string, montant: number, note?: string): boolean => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return false;
    }
    if (!montant || isNaN(montant) || montant <= 0) {
      showToast('Montant invalide.');
      return false;
    }
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return false;

    const soldeAvant = targetMember.solde;
    const soldeApres = soldeAvant + montant;
    const ref = generateReceiptReference();

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: targetMember.id,
      member_nom: targetMember.nom,
      member_livret: targetMember.livret,
      type: 'depot',
      montant,
      date: new Date().toISOString(),
      agent: currentUser?.username || 'caisse',
      zone: targetMember.zone,
      validated: true,
      solde_avant: soldeAvant,
      solde_apres: soldeApres,
      reference: ref,
      description: note || 'Versement d\'épargne tontine',
    };

    // Update state
    setTransactions(prev => [tx, ...prev]);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, solde: soldeApres } : m));
    if (currentMember && currentMember.id === memberId) {
      setCurrentMember({ ...currentMember, solde: soldeApres });
    }

    // Sync (ou file d'attente IndexedDB si hors-ligne)
    syncOrEnqueue(() => dbSaveTransaction(tx), {
      entityType: 'transaction',
      actionLabel: 'Dépôt guichet',
      summary: `${targetMember.nom} (${targetMember.livret}) · +${montant.toLocaleString()} F`,
      endpoint: '/api/db/transactions',
      method: 'POST',
      payload: tx,
    });
    syncOrEnqueue(() => dbUpdateMember(memberId, { solde: soldeApres }), {
      entityType: 'member_update',
      actionLabel: 'Solde après dépôt',
      summary: `${targetMember.nom} → ${soldeApres.toLocaleString()} F`,
      endpoint: `/api/db/members/${encodeURIComponent(memberId)}`,
      method: 'PATCH',
      payload: { solde: soldeApres },
    });
    const updatedMember = { ...targetMember, solde: soldeApres };
    bgSyncFirestore(() =>
      fsUpsert('members', updatedMember.id, updatedMember)
        .then(() => fsInsert('transactions', tx))
    );
    addAuditLog('Collecte Dépôt', `Versement d'épargne de ${montant} F effectué au guichet.`, targetMember.nom, 'info');

    // SMS Notification
    sendSMS({
      to: targetMember.telephone,
      message: SMSTemplates.depotConfirme(targetMember.nom, montant, soldeApres, ref),
      type: 'transaction'
    });

    // Prompt receipt immediately
    setActiveReceipt({
      transactionId: tx.id,
      type: 'depot',
      reference: ref,
      date: tx.date,
      memberNom: targetMember.nom,
      memberLivret: targetMember.livret,
      memberTelephone: targetMember.telephone,
      zone: targetMember.zone,
      montant,
      soldeAvant,
      soldeApres,
      agentNom: currentUser?.username || 'agent',
      motif: note,
    });

    showToast(`Collecte de ${montant.toLocaleString()} F CFA enregistrée pour ${targetMember.nom} ✅`);
    return true;
  };

  const handleCollecteRetrait = (memberId: string, montant: number, note?: string): boolean => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return false;
    }
    if (!montant || isNaN(montant) || montant <= 0) {
      showToast('Montant invalide.');
      return false;
    }
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return false;

    if (targetMember.solde < montant) {
      showToast('Erreur: Solde insuffisant');
      return false;
    }

    const soldeAvant = targetMember.solde;
    const soldeApres = soldeAvant - montant;
    const ref = generateReceiptReference();

    const tx: Transaction = {
      id: `tx_ret_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: targetMember.id,
      member_nom: targetMember.nom,
      member_livret: targetMember.livret,
      type: 'retrait',
      montant,
      date: new Date().toISOString(),
      agent: currentUser?.username || 'caisse',
      zone: targetMember.zone,
      validated: true,
      solde_avant: soldeAvant,
      solde_apres: soldeApres,
      reference: ref,
      description: note || 'Retrait d\'épargne espèces au guichet',
    };

    // Update state
    setTransactions(prev => [tx, ...prev]);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, solde: soldeApres } : m));
    if (currentMember && currentMember.id === memberId) {
      setCurrentMember({ ...currentMember, solde: soldeApres });
    }

    // Sync (ou file d'attente IndexedDB si hors-ligne)
    syncOrEnqueue(() => dbSaveTransaction(tx), {
      entityType: 'transaction',
      actionLabel: 'Retrait guichet',
      summary: `${targetMember.nom} (${targetMember.livret}) · -${montant.toLocaleString()} F`,
      endpoint: '/api/db/transactions',
      method: 'POST',
      payload: tx,
    });
    syncOrEnqueue(() => dbUpdateMember(memberId, { solde: soldeApres }), {
      entityType: 'member_update',
      actionLabel: 'Solde après retrait',
      summary: `${targetMember.nom} → ${soldeApres.toLocaleString()} F`,
      endpoint: `/api/db/members/${encodeURIComponent(memberId)}`,
      method: 'PATCH',
      payload: { solde: soldeApres },
    });
    const updatedMember = { ...targetMember, solde: soldeApres };
    bgSyncFirestore(() =>
      fsUpsert('members', updatedMember.id, updatedMember)
        .then(() => fsInsert('transactions', tx))
    );
    addAuditLog('Retrait Guichet', `Retrait direct d'espèces de ${montant} F effectué au guichet (sans validation préalable).`, targetMember.nom, 'critique');

    // SMS Notification
    sendSMS({
      to: targetMember.telephone,
      message: SMSTemplates.retraitConfirme(targetMember.nom, montant, soldeApres, ref),
      type: 'transaction'
    });

    // Prompt receipt immediately
    setActiveReceipt({
      transactionId: tx.id,
      type: 'retrait',
      reference: ref,
      date: tx.date,
      memberNom: targetMember.nom,
      memberLivret: targetMember.livret,
      memberTelephone: targetMember.telephone,
      zone: targetMember.zone,
      montant,
      soldeAvant,
      soldeApres,
      agentNom: currentUser?.username || 'agent',
      motif: note || 'Retrait espèces',
    });

    showToast(`Retrait de ${montant.toLocaleString()} F CFA effectué pour ${targetMember.nom} ✅`);
    return true;
  };

  const handleValidateRetrait = (demandeId: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const d = demandesRetrait.find(item => item.id === demandeId);
    if (!d) return;
    if (d.status !== 'en_attente') {
      showToast('Cette demande de retrait a déjà été traitée.');
      return;
    }
    const m = members.find(item => item.id === d.member_id);
    if (!m) return;

    if (m.solde < d.montant) {
      showToast('Erreur: Solde disponible insuffisant pour ce retrait');
      return;
    }

    const soldeAvant = m.solde;
    const soldeApres = soldeAvant - d.montant;
    const ref = generateReceiptReference();

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: m.id,
      member_nom: m.nom,
      member_livret: m.livret,
      type: 'retrait',
      montant: d.montant,
      date: new Date().toISOString(),
      agent: currentUser?.username || 'tresor',
      zone: m.zone,
      validated: true,
      solde_avant: soldeAvant,
      solde_apres: soldeApres,
      reference: ref,
      description: d.motif,
    };

    const nowIso = new Date().toISOString();
    const validator = currentUser?.username || 'tresor';

    setDemandesRetrait(prev =>
      prev.map(item =>
        item.id === demandeId
          ? { ...item, status: 'valide', date_traitement: nowIso, agent_validateur: validator }
          : item
      )
    );
    setMembers(prev => prev.map(item => item.id === m.id ? { ...item, solde: soldeApres } : item));
    setTransactions(prev => [tx, ...prev]);

    if (currentMember && currentMember.id === m.id) {
      setCurrentMember({ ...currentMember, solde: soldeApres });
    }

    syncOrEnqueue(() => dbUpdateRetrait(demandeId, { status: 'valide', date_traitement: nowIso, agent_validateur: validator }), {
      entityType: 'retrait_decision',
      actionLabel: 'Statut retrait validé',
      summary: `${m.nom} (${m.livret}) · ${d.montant.toLocaleString()} F`,
      endpoint: `/api/db/retraits/${encodeURIComponent(demandeId)}`,
      method: 'PATCH',
      payload: { status: 'valide', date_traitement: nowIso, agent_validateur: validator },
    });
    syncOrEnqueue(() => dbSaveTransaction(tx), {
      entityType: 'retrait_decision',
      actionLabel: 'Validation retrait',
      summary: `${m.nom} (${m.livret}) · ${d.montant.toLocaleString()} F`,
      endpoint: '/api/db/transactions',
      method: 'POST',
      payload: tx,
    });
    syncOrEnqueue(() => dbUpdateMember(m.id, { solde: soldeApres }), {
      entityType: 'member_update',
      actionLabel: 'Solde après retrait',
      summary: `${m.nom} → ${soldeApres.toLocaleString()} F`,
      endpoint: `/api/db/members/${encodeURIComponent(m.id)}`,
      method: 'PATCH',
      payload: { solde: soldeApres },
    });
    const updatedMember = { ...m, solde: soldeApres };
    bgSyncFirestore(() =>
      fsUpdate(
        'retraits',
        demandeId,
        { status: 'valide', date_traitement: nowIso, agent_validateur: validator },
        { ...d, status: 'valide', date_traitement: nowIso, agent_validateur: validator }
      )
    );
    bgSyncFirestore(() =>
      fsUpsert('members', m.id, updatedMember)
        .then(() => fsInsert('transactions', tx))
    );

    addAuditLog('Décaissement Retrait', `Retrait d'épargne validé et décaissé en espèces pour un montant de ${d.montant} F.`, m.nom, 'critique');

    // SMS Notification
    sendSMS({
      to: m.telephone,
      message: SMSTemplates.retraitConfirme(m.nom, d.montant, soldeApres, ref),
      type: 'transaction'
    });

    setActiveReceipt({
      transactionId: tx.id,
      type: 'retrait',
      reference: ref,
      date: tx.date,
      memberNom: m.nom,
      memberLivret: m.livret,
      memberTelephone: m.telephone,
      zone: m.zone,
      montant: d.montant,
      soldeAvant,
      soldeApres,
      agentNom: currentUser?.username || 'tresor',
      motif: d.motif,
    });

    showToast(`Retrait de ${d.montant.toLocaleString()} F CFA validé pour ${m.nom}`);
  };

  const handleRejectRetrait = (demandeId: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const d = demandesRetrait.find(item => item.id === demandeId);
    if (!d || d.status !== 'en_attente') return;
    const nowIso = new Date().toISOString();
    const validator = currentUser?.username || 'tresor';
    setDemandesRetrait(prev =>
      prev.map(item =>
        item.id === demandeId
          ? { ...item, status: 'rejete', date_traitement: nowIso, agent_validateur: validator }
          : item
      )
    );
    syncOrEnqueue(() => dbUpdateRetrait(demandeId, { status: 'rejete', date_traitement: nowIso, agent_validateur: validator }), {
      entityType: 'retrait_decision',
      actionLabel: 'Rejet retrait',
      summary: `Demande ${demandeId}`,
      endpoint: `/api/db/retraits/${encodeURIComponent(demandeId)}`,
      method: 'PATCH',
      payload: { status: 'rejete', date_traitement: nowIso, agent_validateur: validator },
    });
    bgSyncFirestore(() =>
      fsUpdate(
        'retraits',
        demandeId,
        { status: 'rejete', date_traitement: nowIso, agent_validateur: validator },
        { ...d, status: 'rejete', date_traitement: nowIso, agent_validateur: validator }
      )
    );
    showToast('Demande de retrait rejetée.');
  };

  const handleValidateFinancement = (demandeId: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const df = demandesFinancement.find(f => f.id === demandeId);
    if (!df) return;
    if (df.status !== 'en_attente' || df.decaissed_from_caisse) {
      showToast('Ce dossier de financement a déjà été traité.');
      return;
    }

    // Calcul du solde de la Caisse Financement (exclut les mouvements du Fonds Social)
    const caisseTotal = (caisseMouvements || [])
      .filter(m => m.type !== 'cotisation_sante' && m.type !== 'assistance_sociale')
      .reduce((acc, m) => {
        if (m.type === 'decaissement') return acc - m.montant;
        return acc + m.montant;
      }, 0);

    if (caisseTotal < df.montant) {
      showToast(`Solde Caisse Financement insuffisant (${caisseTotal.toLocaleString()} F CFA dispo). Décaissement impossible.`);
      return;
    }

    // Décaissement depuis la Caisse Spéciale Financement
    const m = members.find(item => item.id === df.member_id);
    const mouvementDecaissement: CaisseMouvement = {
      id: `cm_dec_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'decaissement',
      montant: df.montant,
      member_id: df.member_id,
      member_nom: m?.nom,
      financement_id: df.id,
      description: `Décaissement Financement ${df.financement_type.toUpperCase()} pour ${m?.nom || 'Adhérent'} (${df.motif})`,
      agent: currentUser?.username || 'admin',
    };

    setCaisseMouvements(prev => [mouvementDecaissement, ...prev]);
    syncOrEnqueue(() => dbSaveCaisseMouvement(mouvementDecaissement), {
      entityType: 'caisse_mouvement',
      actionLabel: 'Décaissement caisse',
      summary: `${m?.nom || df.member_id} · ${df.montant.toLocaleString()} F`,
      endpoint: '/api/db/caisse-mouvements',
      method: 'POST',
      payload: mouvementDecaissement,
    });
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mouvementDecaissement));

    setDemandesFinancement(prev => prev.map(item => item.id === demandeId ? { ...item, status: 'valide', decaissed_from_caisse: true } : item));
    syncOrEnqueue(() => dbUpdateFinancement(demandeId, { status: 'valide', decaissed_from_caisse: true }), {
      entityType: 'financement_decision',
      actionLabel: 'Approbation financement',
      summary: `${m?.nom || df.member_id} · ${df.montant.toLocaleString()} F`,
      endpoint: `/api/db/financements/${encodeURIComponent(demandeId)}`,
      method: 'PATCH',
      payload: { status: 'valide', decaissed_from_caisse: true },
    });
    bgSyncFirestore(() =>
      fsUpdate(
        'financements',
        demandeId,
        { status: 'valide', decaissed_from_caisse: true },
        { ...df, status: 'valide', decaissed_from_caisse: true }
      )
    );
    addAuditLog('Décaissement Financement', `Approbation et décaissement d'un financement ${df.financement_type.toUpperCase()} de ${df.montant} F.`, m?.nom, 'critique');
    
    // SMS Notification
    if (m) {
      sendSMS({
        to: m.telephone,
        message: SMSTemplates.financementValide(m.nom, df.montant, df.financement_type.toUpperCase()),
        type: 'transaction'
      });
    }

    showToast(`Financement approuvé et décaissé (${df.montant.toLocaleString()} F CFA) depuis la Caisse Spéciale ✅`);
  };

  const handleRejectFinancement = (demandeId: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const df = demandesFinancement.find(f => f.id === demandeId);
    if (!df || df.status !== 'en_attente') return;
    setDemandesFinancement(prev => prev.map(item => item.id === demandeId ? { ...item, status: 'rejete' } : item));
    syncOrEnqueue(() => dbUpdateFinancement(demandeId, { status: 'rejete' }), {
      entityType: 'financement_decision',
      actionLabel: 'Rejet financement',
      summary: `Dossier ${demandeId}`,
      endpoint: `/api/db/financements/${encodeURIComponent(demandeId)}`,
      method: 'PATCH',
      payload: { status: 'rejete' },
    });
    bgSyncFirestore(() => fsUpdate('financements', demandeId, { status: 'rejete' }, { ...df, status: 'rejete' }));
    showToast('Dossier de financement rejeté.');
  };

  const handlePayEcheance = (demandeId: string, numeroEcheance: number) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const df = demandesFinancement.find(f => f.id === demandeId);
    if (!df || !df.echeances) return;

    const ech = df.echeances.find(e => e.numero === numeroEcheance);
    if (!ech) return;
    if (ech.paye) {
      showToast(`L'échéance #${numeroEcheance} est déjà encaissée.`);
      return;
    }

    const updatedEcheances = df.echeances.map(e => 
      e.numero === numeroEcheance ? { ...e, paye: true, date_paiement: new Date().toISOString().slice(0, 10) } : e
    );

    const newRembourse = (df.montant_rembourse || 0) + ech.montant;

    setDemandesFinancement(prev => prev.map(f => 
      f.id === demandeId ? { ...f, echeances: updatedEcheances, montant_rembourse: newRembourse } : f
    ));

    const m = members.find(item => item.id === df.member_id);

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: df.member_id,
      member_nom: m?.nom,
      member_livret: m?.livret,
      type: 'remboursement',
      montant: ech.montant,
      date: new Date().toISOString(),
      agent: currentUser?.username || 'caisse',
      zone: m?.zone || 'Dosso Centre',
      validated: true,
      reference: generateReceiptReference(),
      description: `Remboursement échéance #${numeroEcheance} Financement ${df.financement_type.toUpperCase()}`,
    };

    // Mouvement d'entrée dans la Caisse Financement
    const mvRemboursement: CaisseMouvement = {
      id: `cm_remb_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'remboursement',
      montant: ech.montant,
      member_id: df.member_id,
      member_nom: m?.nom,
      financement_id: df.id,
      description: `Retour échéance #${numeroEcheance} Financement ${df.financement_type.toUpperCase()} (${m?.nom || 'Membre'})`,
      agent: currentUser?.username || 'caisse',
    };

    setCaisseMouvements(prev => [mvRemboursement, ...prev]);
    syncOrEnqueue(() => dbSaveCaisseMouvement(mvRemboursement), {
      entityType: 'caisse_mouvement',
      actionLabel: 'Retour échéance',
      summary: `${m?.nom || df.member_id} · #${numeroEcheance} (${ech.montant.toLocaleString()} F)`,
      endpoint: '/api/db/caisse-mouvements',
      method: 'POST',
      payload: mvRemboursement,
    });
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mvRemboursement));

    setTransactions(prev => [tx, ...prev]);
    syncOrEnqueue(() => dbSaveTransaction(tx), {
      entityType: 'transaction',
      actionLabel: 'Remboursement échéance',
      summary: `${m?.nom || df.member_id} · ${ech.montant.toLocaleString()} F`,
      endpoint: '/api/db/transactions',
      method: 'POST',
      payload: tx,
    });
    syncOrEnqueue(() => dbUpdateFinancement(demandeId, { echeances: updatedEcheances, montant_rembourse: newRembourse }), {
      entityType: 'financement_decision',
      actionLabel: 'Échéancier financement',
      summary: `${m?.nom || df.member_id} · Remboursé ${newRembourse.toLocaleString()} F`,
      endpoint: `/api/db/financements/${encodeURIComponent(demandeId)}`,
      method: 'PATCH',
      payload: { echeances: updatedEcheances, montant_rembourse: newRembourse },
    });
    bgSyncFirestore(() =>
      fsUpdate(
        'financements',
        demandeId,
        { echeances: updatedEcheances, montant_rembourse: newRembourse },
        { ...df, echeances: updatedEcheances, montant_rembourse: newRembourse }
      )
    );
    bgSyncFirestore(() => {
      if (m) {
        return fsUpsert('members', m.id, m).then(() => fsInsert('transactions', tx));
      }
      return fsInsert('transactions', tx);
    });

    // SMS Notification
    if (m) {
      sendSMS({
        to: m.telephone,
        message: SMSTemplates.echeancePayee(m.nom, ech.montant, (df.montant_total || 0) - newRembourse),
        type: 'transaction'
      });
    }

    showToast(`Échéance #${numeroEcheance} de ${ech.montant.toLocaleString()} F CFA encaissée et reversée à la Caisse Financement 💵`);
  };

  const handleAddCorporation = (nom: string, emoji: string, categorie: string, fraisAdhesion: number = 5000) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const newC: Corporation = {
      id: `c_${Date.now()}`,
      nom,
      emoji,
      categorie,
      membres: 0,
      frais_adhesion: fraisAdhesion,
    };
    setCorporations(prev => [...prev, newC]);
    dbSaveCorporation(newC);
    bgSyncFirestore(() => fsInsert('corporations', newC));
    showToast(`Corporation ${nom} créée avec frais d'adhésion planifiés à ${fraisAdhesion.toLocaleString()} F CFA.`);
  };

  const handleUpdateCorporationFrais = (corpoId: string, fraisAdhesion: number) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const targetCorpo = corporations.find(c => c.id === corpoId);
    setCorporations(prev => prev.map(c => c.id === corpoId ? { ...c, frais_adhesion: fraisAdhesion } : c));
    dbUpdateCorporation(corpoId, { frais_adhesion: fraisAdhesion });
    bgSyncFirestore(() =>
      fsUpdate(
        'corporations',
        corpoId,
        { frais_adhesion: fraisAdhesion },
        targetCorpo ? { ...targetCorpo, frais_adhesion: fraisAdhesion } : undefined
      )
    );
    showToast(`Barème des frais d'adhésion mis à jour : ${fraisAdhesion.toLocaleString()} F CFA.`);
  };

  const handleUpdateCorporationEmoji = (corpoId: string, emoji: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const targetCorpo = corporations.find(c => c.id === corpoId);
    setCorporations(prev => prev.map(c => c.id === corpoId ? { ...c, emoji } : c));
    dbUpdateCorporation(corpoId, { emoji });
    bgSyncFirestore(() =>
      fsUpdate(
        'corporations',
        corpoId,
        { emoji },
        targetCorpo ? { ...targetCorpo, emoji } : undefined
      )
    );
    showToast('Icône de corporation mise à jour.');
  };

  const handleAddZone = (nom: string, description: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const newZ: ZoneItem = {
      id: `z_${Date.now()}`,
      nom,
      description,
      agent_principal: currentUser?.username,
      created_at: new Date().toISOString(),
    };
    setZones(prev => [...prev, newZ]);
    dbSaveZone(newZ);
    bgSyncFirestore(() => fsInsert('zones', newZ));
    showToast(`Zone ${nom} ajoutée avec succès.`);
  };

  const handleUpdatePassword = async (userId: string, currentPass: string, newPass: string): Promise<boolean> => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    const isMatch = await compareData(currentPass, user.password || '');
    if (!isMatch) return false;

    const hashedNewPass = await hashData(newPass);

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: hashedNewPass } : u));
    bgSyncFirestore(() => fsUpdate('users', userId, { password: hashedNewPass }, { ...user, password: hashedNewPass }));
    addAuditLog('Changement Mot de Passe', `L'utilisateur a modifié son mot de passe personnel.`, user.nom, 'securite');
    showToast('Mot de passe mis à jour avec succès ✅');
    return true;
  };

  const handleSaveUser = async (userData: Partial<User>) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }

    const finalUserData = { ...userData };
    if (userData.password) {
      finalUserData.password = await hashData(userData.password);
    }

    if (userData.id) {
      // Check username if changing
      if (userData.username) {
        const duplicate = users.find(u => u.username === userData.username && u.id !== userData.id);
        if (duplicate) {
          showToast(`Erreur : L'identifiant @${userData.username} est déjà utilisé.`);
          return;
        }
      }
      setUsers(prev => prev.map(u => u.id === userData.id ? { ...u, ...finalUserData } as User : u));
      const existingUser = users.find(u => u.id === userData.id);
      bgSyncFirestore(() =>
        fsUpdate(
          'users',
          userData.id!,
          finalUserData,
          existingUser ? { ...existingUser, ...finalUserData } : undefined
        )
      );
      addAuditLog('Modification Utilisateur', `Mise à jour du profil de l'utilisateur @${userData.username}.`, userData.nom, 'securite');
      showToast('Utilisateur modifié avec succès.');
    } else {
      // Check username uniqueness
      const duplicate = users.find(u => u.username === userData.username);
      if (duplicate) {
        showToast(`Erreur : L'identifiant @${userData.username} est déjà utilisé.`);
        return;
      }
      const newUser: User = {
        id: `u_${Date.now()}`,
        username: userData.username || `user_${Date.now().toString().slice(-4)}`,
        nom: userData.nom || 'Agent',
        role: userData.role || 'AGENT',
        zone: userData.zone || 'Dosso Centre',
        telephone: userData.telephone,
        password: finalUserData.password || (await hashData('1234')),
        created_at: new Date().toISOString(),
      };
      setUsers(prev => [...prev, newUser]);
      bgSyncFirestore(() => fsInsert('users', newUser));
      addAuditLog('Création Utilisateur', `Nouveau compte créé pour @${newUser.username} avec le rôle ${newUser.role}.`, newUser.nom, 'securite');
      showToast(`Utilisateur @${newUser.username} créé.`);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (currentUser?.role === 'MAIRE') {
      showToast('Action non autorisée : Le compte Mairie de Dosso est en mode lecture seule strict.');
      return;
    }
    const target = users.find(u => u.id === userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    bgSyncFirestore(() => fsDelete('users', userId));
    addAuditLog('Suppression Utilisateur', `Le compte de l'utilisateur @${target?.username} a été définitivement supprimé.`, target?.nom, 'securite');
    showToast('Utilisateur supprimé.');
  };

  const handleCreateInvestment = (projet: Omit<InvestissementProjet, 'id' | 'created_at' | 'montant_actuel' | 'nb_participants'>) => {
    if (currentUser?.role === 'MAIRE' || currentUser?.role === 'AGENT') {
      showToast('Action non autorisée.');
      return;
    }
    const newInv: InvestissementProjet = {
      ...projet,
      id: `inv_${Date.now()}`,
      created_at: new Date().toISOString(),
      montant_actuel: 0,
      nb_participants: 0,
    };
    setInvestissements(prev => [newInv, ...prev]);
    bgSyncFirestore(() => fsInsert('investissements', newInv));
    addAuditLog('Ouverture Projet Investissement', `Nouveau projet de coffre-fort "${newInv.titre}" ouvert avec une cible de ${newInv.montant_cible} F.`, 'Communauté', 'info');
    showToast(`Projet d'investissement "${newInv.titre}" ouvert aux membres !`);
  };

  const handleJoinInvestment = (projetId: string, montant: number) => {
    if (!currentMember) return;
    
    // Check eligibility (50,000f min)
    if (currentMember.solde < 50000) {
      showToast('Éligibilité insuffisante : Solde minimum de 50 000 F requis pour investir.');
      return;
    }

    if (currentMember.solde < montant) {
      showToast('Solde insuffisant pour cet investissement.');
      return;
    }

    const projet = investissements.find(p => p.id === projetId);
    if (!projet || projet.status !== 'ouvert') {
      showToast('Ce projet n\'est plus ouvert aux participations.');
      return;
    }

    if (montant < projet.participation_min) {
      showToast(`Le montant minimum de participation est de ${projet.participation_min.toLocaleString()} F.`);
      return;
    }

    const newPart: InvestissementParticipation = {
      id: `part_${Date.now()}`,
      projet_id: projetId,
      member_id: currentMember.id,
      member_nom: currentMember.nom,
      member_livret: currentMember.livret,
      montant,
      date: new Date().toISOString(),
      status: 'actif',
    };

    // Update Project
    const updatedProjet = {
      ...projet,
      montant_actuel: (projet.montant_actuel || 0) + montant,
      nb_participants: (projet.nb_participants || 0) + 1,
    };

    // Update Member balance
    const newSolde = currentMember.solde - montant;
    const updatedMember = { ...currentMember, solde: newSolde };

    // Create Transaction Record
    const ref = generateReceiptReference();
    const tx: Transaction = {
      id: `tx_inv_${Date.now()}`,
      ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
      member_id: currentMember.id,
      member_nom: currentMember.nom,
      member_livret: currentMember.livret,
      type: 'investissement',
      montant,
      date: new Date().toISOString(),
      agent: 'system',
      zone: currentMember.zone,
      validated: true,
      solde_avant: currentMember.solde,
      solde_apres: newSolde,
      reference: ref,
      description: `Investissement dans le projet : ${projet.titre}`,
    };

    // Global Movement in Caisse Financement (Investment Flux)
    const mvInv: CaisseMouvement = {
      id: `cm_inv_${Date.now()}`,
      date: new Date().toISOString(),
      type: 'investissement_flux',
      montant,
      member_id: currentMember.id,
      member_nom: currentMember.nom,
      description: `Collecte Investissement - Projet: ${projet.titre}`,
      agent: 'system',
    };

    // Update states
    setParticipations(prev => [newPart, ...prev]);
    setInvestissements(prev => prev.map(p => p.id === projetId ? updatedProjet : p));
    setMembers(prev => prev.map(m => m.id === currentMember.id ? updatedMember : m));
    setCurrentMember(updatedMember);
    setTransactions(prev => [tx, ...prev]);
    setCaisseMouvements(prev => [mvInv, ...prev]);

    // Sync
    syncOrEnqueue(() => dbUpdateMember(currentMember.id, { solde: newSolde }), {
      entityType: 'member_update',
      actionLabel: 'Solde après investissement',
      summary: `${currentMember.nom} → ${newSolde.toLocaleString()} F`,
      endpoint: `/api/db/members/${encodeURIComponent(currentMember.id)}`,
      method: 'PATCH',
      payload: { solde: newSolde },
    });
    syncOrEnqueue(() => dbSaveTransaction(tx), {
      entityType: 'transaction',
      actionLabel: 'Investissement coffre',
      summary: `${currentMember.nom} · ${montant.toLocaleString()} F`,
      endpoint: '/api/db/transactions',
      method: 'POST',
      payload: tx,
    });
    syncOrEnqueue(() => dbSaveCaisseMouvement(mvInv), {
      entityType: 'caisse_mouvement',
      actionLabel: 'Flux investissement',
      summary: `${projet.titre} · ${montant.toLocaleString()} F`,
      endpoint: '/api/db/caisse-mouvements',
      method: 'POST',
      payload: mvInv,
    });
    bgSyncFirestore(() => fsInsert('participations', newPart));
    bgSyncFirestore(() =>
      fsUpdate(
        'investissements',
        projetId,
        {
          montant_actuel: updatedProjet.montant_actuel,
          nb_participants: updatedProjet.nb_participants,
        },
        updatedProjet
      )
    );
    bgSyncFirestore(() =>
      fsUpsert('members', updatedMember.id, updatedMember)
        .then(() => fsInsert('transactions', tx))
    );
    bgSyncFirestore(() => fsInsert('caisse_mouvements', mvInv));

    showToast(`Participation de ${montant.toLocaleString()} F enregistrée pour le projet "${projet.titre}" ! 🚀`);
    
    // Receipt
    setActiveReceipt({
      transactionId: tx.id,
      type: 'investissement',
      reference: ref,
      date: tx.date,
      memberNom: currentMember.nom,
      memberLivret: currentMember.livret,
      memberTelephone: currentMember.telephone,
      zone: currentMember.zone,
      montant,
      soldeAvant: tx.solde_avant,
      soldeApres: newSolde,
      agentNom: 'Automatique',
      motif: `Investissement: ${projet.titre}`,
    });
  };

  const handleUpdateInvestmentStatus = (id: string, status: 'ouvert' | 'ferme' | 'cloture' | 'annule') => {
    if (currentUser?.role === 'MAIRE' || currentUser?.role === 'AGENT') return;
    const targetProjet = investissements.find(p => p.id === id);
    setInvestissements(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    bgSyncFirestore(() =>
      fsUpdate(
        'investissements',
        id,
        { status },
        targetProjet ? { ...targetProjet, status } : undefined
      )
    );
    showToast(`Statut du projet mis à jour : ${status.toUpperCase()}`);
  };

  const handleDistributeProfit = (projetId: string, profitTotal: number) => {
    if (currentUser?.role !== 'ADMIN') return;
    const projet = investissements.find(p => p.id === projetId);
    if (!projet || (projet.status !== 'ferme' && projet.status !== 'ouvert')) return;

    const parts = participations.filter(p => p.projet_id === projetId && p.status === 'actif');
    if (parts.length === 0) return;

    const totalInvesti = projet.montant_actuel;
    if (!totalInvesti || totalInvesti <= 0) return;
    
    // Calculate and update each participant
    const updatedMembers = [...members];
    const newTxs: Transaction[] = [];

    parts.forEach(p => {
      const shareOfProfit = Math.round((p.montant / totalInvesti) * profitTotal);
      const totalRetour = p.montant + shareOfProfit;
      
      const mIdx = updatedMembers.findIndex(m => m.id === p.member_id);
      if (mIdx >= 0) {
        const m = updatedMembers[mIdx];
        const oldSolde = m.solde;
        const newSolde = oldSolde + totalRetour;
        updatedMembers[mIdx] = { ...m, solde: newSolde };

        // Transaction for member
        const tx: Transaction = {
          id: `tx_profit_${Date.now()}_${p.id}`,
          ...(auth.currentUser?.uid ? { uid: auth.currentUser.uid } : {}),
          member_id: m.id,
          member_nom: m.nom,
          member_livret: m.livret,
          type: 'depot',
          montant: totalRetour,
          date: new Date().toISOString(),
          agent: 'admin',
          zone: m.zone,
          validated: true,
          solde_avant: oldSolde,
          solde_apres: newSolde,
          reference: generateReceiptReference(),
          description: `Retour + Profit (${shareOfProfit.toLocaleString()} F) - Projet: ${projet.titre}`,
        };
        newTxs.push(tx);
        
        // Sync to PostgreSQL & Firebase
        dbUpdateMember(m.id, { solde: newSolde });
        dbSaveTransaction(tx);
        const updatedM = updatedMembers[mIdx];
        bgSyncFirestore(() =>
          fsUpsert('members', updatedM.id, updatedM)
            .then(() => fsInsert('transactions', tx))
        );
      }

      // Mark participation as reimbursed
      bgSyncFirestore(() =>
        fsUpdate(
          'participations',
          p.id,
          { status: 'rembourse', gain_reel: shareOfProfit },
          { ...p, status: 'rembourse', gain_reel: shareOfProfit }
        )
      );
    });

    // Update global states
    setMembers(updatedMembers);
    if (currentMember) {
      const refreshed = updatedMembers.find(m => m.id === currentMember.id);
      if (refreshed) setCurrentMember(refreshed);
    }
    setTransactions(prev => [...newTxs, ...prev]);
    setParticipations(prev => prev.map(p => p.projet_id === projetId ? { ...p, status: 'rembourse' } : p));
    setInvestissements(prev => prev.map(p => p.id === projetId ? { ...p, status: 'cloture' } : p));
    bgSyncFirestore(() =>
      fsUpdate(
        'investissements',
        projetId,
        { status: 'cloture' },
        { ...projet, status: 'cloture' }
      )
    );

    addAuditLog('Distribution Profit', `Distribution de ${profitTotal} F de bénéfices pour le projet "${projet.titre}".`, `${projet.nb_participants} participants`, 'critique');

    showToast(`Bénéfices distribués (${profitTotal.toLocaleString()} F) et capital retourné pour le projet "${projet.titre}" ! 🎊`);
  };

  const handleUpdateTransaction = (txId: string, updates: Partial<Transaction>) => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Action réservée à l\'administrateur.');
      return;
    }
    
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const txUpdates: Partial<Transaction> = { ...updates };

    // Special logic for amount change on deposit/withdrawal
    if (updates.montant !== undefined && updates.montant !== tx.montant) {
      if (isNaN(updates.montant) || updates.montant <= 0) {
        showToast('Montant invalide.');
        return;
      }
      const diff = updates.montant - tx.montant;
      const m = members.find(item => item.id === tx.member_id);
      if (m) {
        let newSolde = m.solde;
        if (tx.type === 'depot') newSolde += diff;
        else if (tx.type === 'retrait') newSolde -= diff;
        if (newSolde < 0) {
          showToast('Modification impossible : le solde résulterait négatif.');
          return;
        }
        
        if (tx.solde_avant !== undefined) {
          if (tx.type === 'depot') txUpdates.solde_apres = tx.solde_avant + updates.montant;
          else if (tx.type === 'retrait') txUpdates.solde_apres = tx.solde_avant - updates.montant;
        }

        setMembers(prev => prev.map(item => item.id === m.id ? { ...item, solde: newSolde } : item));
        if (currentMember && currentMember.id === m.id) {
          setCurrentMember({ ...currentMember, solde: newSolde });
        }
        syncOrEnqueue(() => dbUpdateMember(m.id, { solde: newSolde }), {
          entityType: 'member_update',
          actionLabel: 'Ajustement solde transaction',
          summary: `${m.nom} → ${newSolde.toLocaleString()} F`,
          endpoint: `/api/db/members/${encodeURIComponent(m.id)}`,
          method: 'PATCH',
          payload: { solde: newSolde },
        });
        bgSyncFirestore(() => fsUpdate('members', m.id, { solde: newSolde }, { ...m, solde: newSolde }));
      }
    }

    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, ...txUpdates } : t));
    syncOrEnqueue(() => dbUpdateTransaction(txId, txUpdates), {
      entityType: 'transaction',
      actionLabel: 'Modification transaction',
      summary: `${tx.reference || tx.id}`,
      endpoint: `/api/db/transactions/${encodeURIComponent(txId)}`,
      method: 'PATCH',
      payload: txUpdates as Record<string, any>,
    });
    bgSyncFirestore(() => fsUpdate('transactions', txId, txUpdates, { ...tx, ...txUpdates }));
    addAuditLog('Modification Transaction', `La transaction ${tx.reference || tx.id} a été modifiée par l'admin.`, tx.member_nom, 'securite');
    showToast('Transaction mise à jour avec succès.');
  };

  const handleDeleteFinancement = (demandeId: string) => {
    if (currentUser?.role !== 'ADMIN') return;
    setDemandesFinancement(prev => prev.filter(f => f.id !== demandeId));
    syncOrEnqueue(() => dbDeleteFinancement(demandeId), {
      entityType: 'financement_delete',
      actionLabel: 'Suppression financement',
      summary: `Dossier ${demandeId}`,
      endpoint: `/api/db/financements/${encodeURIComponent(demandeId)}`,
      method: 'DELETE',
      payload: {},
    });
    bgSyncFirestore(() => fsDelete('financements', demandeId));
    addAuditLog('Suppression Financement', `Un dossier de financement a été supprimé définitivement.`, demandeId, 'critique');
    showToast('Dossier de financement supprimé.');
  };




  // Metrics for landing
  const totalMembres = members.length;
  const soldeTotal = members.reduce((sum, m) => sum + m.solde, 0);
  const todayStr = new Date().toDateString();
  const collecteAujourdhui = transactions
    .filter(t => {
      if (t.type !== 'depot') return false;
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && d.toDateString() === todayStr;
    })
    .reduce((sum, t) => sum + t.montant, 0);

  return (
    <div className="min-h-screen bg-paper dark:bg-slate-950 text-charcoal dark:text-slate-100 flex flex-col font-body selection:bg-gold selection:text-white transition-colors duration-500">
      {/* 3-ZONE HEADER CONTRACT */}
      <header className="sticky top-0 z-50 glass hairline">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div 
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-4 cursor-pointer group shrink-0"
          >
            <img 
              src={APP_LOGO} 
              alt="PMES-AGR Dosso" 
              className="w-10 h-10 object-contain rounded-full shadow-md bg-white p-1"
            />
            <span className="text-xl font-display font-bold tracking-tight text-charcoal dark:text-white whitespace-nowrap">
              PMES-AGR Dosso
            </span>
          </div>

          {/* Zone 2: Navigation Links (Quiet Typography) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
            <button 
              onClick={() => setCurrentView('landing')}
              className={`hover:text-charcoal dark:hover:text-white transition-colors whitespace-nowrap ${currentView === 'landing' ? 'text-charcoal dark:text-white underline decoration-gold decoration-2 underline-offset-8' : ''}`}
            >
              Accueil
            </button>
            <button 
              onClick={() => { setMemberAuthMode('login'); setShowMemberAuth(true); }}
              className={`hover:text-charcoal dark:hover:text-white transition-colors whitespace-nowrap ${currentView === 'member-space' ? 'text-charcoal dark:text-white underline decoration-gold decoration-2 underline-offset-8' : ''}`}
            >
              Espace Membre
            </button>
            <button 
              onClick={() => setShowAdminAuth(true)}
              className={`hover:text-charcoal dark:hover:text-white transition-colors whitespace-nowrap ${currentView === 'admin-space' ? 'text-charcoal dark:text-white underline decoration-gold decoration-2 underline-offset-8' : ''}`}
            >
              Portail Caisse
            </button>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              {isOnline ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-500">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  Local
                </span>
              )}
            </div>
          </nav>

          {/* Zone 3: Primary Action / Controls */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentView === 'landing' ? (
              <button
                onClick={() => { setMemberAuthMode('login'); setShowMemberAuth(true); }}
                className="px-6 py-2.5 bg-lapis text-white rounded-lg font-display font-semibold text-sm hover:bg-lapis/90 transition-all shadow-lg shadow-lapis/10 whitespace-nowrap"
              >
                Accès Portail
              </button>
            ) : (
              <button
                onClick={() => {
                  setCurrentView('landing');
                  setCurrentMember(null);
                  setCurrentUser(null);
                }}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg font-display font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-xl bg-charcoal dark:bg-white text-white dark:text-charcoal font-display font-bold text-sm shadow-2xl flex items-center gap-3 animate-slide-up border border-white/10 dark:border-charcoal/10">
          <CheckCircle className="w-5 h-5 text-gold shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 relative">
        {currentView === 'landing' && (
          <LandingPage
            totalMembres={totalMembres}
            soldeTotal={soldeTotal}
            collecteAujourdhui={collecteAujourdhui}
            corporations={corporations}
            zones={zones}
            onOpenMemberAuth={(mode) => {
              setMemberAuthMode(mode || 'login');
              setShowMemberAuth(true);
            }}
            onOpenAdminAuth={() => setShowAdminAuth(true)}
          />
        )}

        {currentView === 'member-space' && currentMember && (
          <MemberSpace
            member={currentMember}
            transactions={transactions}
            demandesRetrait={demandesRetrait}
            demandesFinancement={demandesFinancement}
            investissements={investissements}
            participations={participations}
            onDemandeRetrait={handleMemberDemandeRetrait}
            onDemandeFinancement={handleMemberDemandeFinancement}
            onJoinInvestment={handleJoinInvestment}
            onUpdatePin={handleUpdatePin}
            onUpdatePhoto={handleUpdateMemberPhoto}
            onUpdateMember={(id, updates) => {
              setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
              setCurrentMember(prev => prev ? { ...prev, ...updates } : null);
              syncOrEnqueue(() => dbUpdateMember(id, updates), {
                entityType: 'member_update',
                actionLabel: "Objectif d'épargne",
                summary: `${currentMember?.nom || id}`,
                endpoint: `/api/db/members/${encodeURIComponent(id)}`,
                method: 'PATCH',
                payload: updates as Record<string, any>,
              });
              bgSyncFirestore(() =>
                fsUpdate(
                  'members',
                  id,
                  updates,
                  currentMember ? { ...currentMember, ...updates } : undefined
                )
              );
              showToast("Objectif d'épargne mis à jour 🎯");
            }}
            onOpenReceipt={(r) => setActiveReceipt(r)}
            onOpenCard={() => setActiveMemberCard(currentMember)}
            onLogout={() => {
              setCurrentMember(null);
              setCurrentView('landing');
            }}
          />
        )}

        {currentView === 'admin-space' && currentUser && (
          <AdminSpace
            currentUser={currentUser}
            users={users}
            members={members}
            transactions={transactions}
            demandesRetrait={demandesRetrait}
            demandesFinancement={demandesFinancement}
            investissements={investissements}
            participations={participations}
            corporations={corporations}
            zones={zones}
            caisseMouvements={caisseMouvements}
            syncStatus={syncStatus}
            onTestFirebase={() => {
              setSyncStatus('connecting');
              testFirestoreConnection().then(ok => {
                setSyncStatus(ok ? 'connected' : 'error');
                showToast(ok ? 'Connexion Firebase établie avec succès ✅' : 'Impossible de se connecter à Firebase');
              });
            }}
            onPushToFirebase={pushToFirebase}
            onPullFromFirebase={() => pullFromFirebase(true)}
            onValidateMember={handleValidateMember}
            onRejectMember={handleRejectMember}
            onAddMember={handleAddMemberByAdmin}
            onCollecteDepot={handleCollecteDepot}
            onCollecteRetrait={handleCollecteRetrait}
            onValidateRetrait={handleValidateRetrait}
            onRejectRetrait={handleRejectRetrait}
            onValidateFinancement={handleValidateFinancement}
            onRejectFinancement={handleRejectFinancement}
            onPayEcheance={handlePayEcheance}
            onAddCorporation={handleAddCorporation}
            onUpdateCorporationEmoji={handleUpdateCorporationEmoji}
            onUpdateCorporationFrais={handleUpdateCorporationFrais}
            onAddZone={handleAddZone}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteFinancement={handleDeleteFinancement}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onAddHealthContribution={handleAddHealthContribution}
            onAddSocialAssistance={handleAddSocialAssistance}
            onUpdateMemberPhoto={handleUpdateMemberPhoto}
            onCreateInvestment={handleCreateInvestment}
            onUpdateInvestmentStatus={handleUpdateInvestmentStatus}
            onDistributeProfit={handleDistributeProfit}
            onUpdatePassword={handleUpdatePassword}
            auditLogs={auditLogs}
            isOnline={isOnline}
            offlineQueue={offlineQueue}
            offlineStats={offlineStats}
            onFlushOfflineQueue={() => handleFlushOfflineQueue(true)}
            onRefreshOfflineCache={handleRefreshOfflineCache}
            onClearSyncedOfflineOps={handleClearSyncedOfflineOps}
            backupConfig={backupConfig}
            backupHistory={backupHistory}
            onSaveBackupConfig={handleSaveBackupConfig}
            onRunBackupNow={() => executeLocalBackup('manual')}
            onClearBackupHistory={handleClearBackupHistory}
            onRestoreBackupComplete={handleRestoreBackupComplete}
            onOpenReceipt={(r) => setActiveReceipt(r)}
            onOpenMemberCard={(m) => setActiveMemberCard(m)}
            onLogout={() => {
              setCurrentUser(null);
              setCurrentView('landing');
            }}
          />
        )}
      </main>

      {/* POPUP MODALS */}
      {showMemberAuth && (
        <MemberAuthModal
          zones={zones}
          corporations={corporations}
          initialMode={memberAuthMode}
          onLogin={handleMemberLogin}
          onRegister={handleMemberRegister}
          onSendOTP={handleSendOTP}
          onVerifyOTP={handleVerifyOTP}
          onResetPin={handleResetMemberPin}
          onClose={() => setShowMemberAuth(false)}
          members={members}
        />
      )}

      {showAdminAuth && (
        <AdminAuthModal
          onLogin={handleAdminLogin}
          onGoogleLogin={handleGoogleLogin}
          onClose={() => setShowAdminAuth(false)}
        />
      )}

      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {activeMemberCard && (
        <MemberCardModal
          member={activeMemberCard}
          onUpdatePhoto={handleUpdateMemberPhoto}
          onClose={() => setActiveMemberCard(null)}
        />
      )}

      {/* FOOTER */}
      <footer className="no-print py-12 bg-charcoal text-white mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 grid md:grid-cols-3 gap-12 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="PMES-AGR" className="w-10 h-10 rounded-full bg-white p-1" />
              <span className="font-display font-bold text-lg tracking-tight">PMES-AGR Dosso</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
              Plateforme institutionnelle de micro-finance solidaire pour la région de Dosso, République du Niger.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Certification Sécurité</div>
            <div className="flex items-center gap-4">
              <Shield className="w-5 h-5 text-gold" />
              <div className="w-px h-8 bg-white/10" />
              <span className="text-sm font-mono tracking-wider">AES-256 BIT</span>
            </div>
          </div>
          <div className="text-right space-y-2">
            <div className="text-xs text-slate-400">Support & Assistance</div>
            <a href="tel:+22793272000" className="text-lg font-display font-bold text-gold hover:text-white transition-colors tracking-tight">
              +227 93 27 20 00
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
