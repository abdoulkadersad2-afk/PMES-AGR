import React, { useState, useMemo } from 'react';
import { 
  User, Member, Transaction, DemandeRetrait, DemandeFinancement, 
  Corporation, ZoneItem, ReceiptData, SyncStatus, MemberStatus, CaisseMouvement,
  InvestissementProjet, InvestissementParticipation, AuditLog
} from '../../types';
import { generateReceiptReference, APP_LOGO } from '../../data/initialData';
import { 
  LayoutDashboard, Users, Banknote, ArrowDownRight, Calculator, 
  Building2, MapPin, Receipt, BarChart3, UserCog, Cloud, Search, 
  Plus, Check, X, Printer, Shield, ArrowUpRight, CheckCircle2, 
  AlertCircle, Download, RefreshCw, Eye, EyeOff, Trash2, Edit2, 
  Smartphone, Share2, HelpCircle, Camera, Upload, Clock, CreditCard, Loader2, FileDown, QrCode, Phone, Lock, Info, Database,
  TrendingUp, ShieldCheck, ChevronRight, Landmark, Filter, ArrowRightLeft, PieChart, History, ExternalLink, HardDrive, WifiOff, Wifi, Archive, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaisseFinancementChart } from './CaisseFinancementChart';
import { ZoneActivityChart } from './ZoneActivityChart';
import { SavingsEvolutionChart } from './SavingsEvolutionChart';
import { FinancialTrendsChart } from './FinancialTrendsChart';
import { CriticalAlerts } from './CriticalAlerts';
import { BackupConfigSection } from './BackupConfigSection';
import { AdminSettingsSection } from './AdminSettingsSection';
import { QRScanner } from '../common/QRScanner';
import {
  exportTransactionsToCSV,
  exportMembersToCSV,
  filterTransactions,
  resolveTransactionCorporation,
} from '../../utils/exportUtils';
import { decodeMemberQRPayload, decodeReceiptQRPayload } from '../../utils/qrUtils';
import { downloadReceiptPDF } from '../../utils/receiptPdfUtils';
import { OfflineSyncItem, OfflineCacheStats } from '../../services/offlineDb';
import { BackupScheduleConfig, BackupHistoryEntry } from '../../services/backupService';
import confetti from 'canvas-confetti';

interface AdminSpaceProps {
  currentUser: User;
  users: User[];
  members: Member[];
  transactions: Transaction[];
  demandesRetrait: DemandeRetrait[];
  demandesFinancement: DemandeFinancement[];
  corporations: Corporation[];
  zones: ZoneItem[];
  caisseMouvements: CaisseMouvement[];
  syncStatus: SyncStatus;
  onTestFirebase: () => void;
  onPushToFirebase: () => void;
  onPullFromFirebase: () => void;
  onValidateMember: (memberId: string) => void;
  onRejectMember: (memberId: string) => void;
  onAddMember: (member: Omit<Member, 'id' | 'created_at'>) => Promise<boolean> | boolean;
  onUpdateMemberPhoto?: (memberId: string, photoSource: string | File) => Promise<string | void> | void;
  onCollecteDepot: (memberId: string, montant: number, note?: string) => boolean;
  onCollecteRetrait: (memberId: string, montant: number, note?: string) => boolean;
  onValidateRetrait: (demandeId: string) => void;
  onRejectRetrait: (demandeId: string) => void;
  onValidateFinancement: (demandeId: string) => void;
  onRejectFinancement: (demandeId: string) => void;
  onPayEcheance: (demandeId: string, numeroEcheance: number) => void;
  onAddCorporation: (nom: string, emoji: string, categorie: string, fraisAdhesion?: number) => void;
  onUpdateCorporationEmoji: (corpoId: string, emoji: string) => void;
  onUpdateCorporationFrais: (corpoId: string, fraisAdhesion: number) => void;
  onAddZone: (nom: string, description: string) => void;
  onSaveUser: (userData: Partial<User>) => Promise<void>;
  onDeleteUser: (userId: string) => void;
  onUpdateTransaction: (txId: string, updates: Partial<Transaction>) => void;
  onDeleteFinancement: (demandeId: string) => void;
  onUpdateMember: (memberId: string, updates: Partial<Member>) => boolean;
  onDeleteMember: (memberId: string) => boolean;
  onAddHealthContribution: (memberId: string, montant: number, note?: string) => void;
  onAddSocialAssistance: (memberId: string, montant: number, motif: 'accident' | 'maladie' | 'accouchement' | 'deces', note?: string) => void;
  investissements: InvestissementProjet[];
  participations: InvestissementParticipation[];
  onOpenReceipt: (receipt: ReceiptData) => void;
  onOpenMemberCard: (member: Member) => void;
  onCreateInvestment: (projet: Omit<InvestissementProjet, 'id' | 'created_at' | 'montant_actuel' | 'nb_participants'>) => void;
  onUpdateInvestmentStatus: (id: string, status: 'ouvert' | 'ferme' | 'cloture' | 'annule') => void;
  onDistributeProfit: (projetId: string, profit: number) => void;
  onUpdatePassword: (userId: string, currentPass: string, newPass: string) => Promise<boolean>;
  auditLogs: AuditLog[];
  isOnline: boolean;
  offlineQueue: OfflineSyncItem[];
  offlineStats: OfflineCacheStats | null;
  onFlushOfflineQueue: () => void | Promise<void>;
  onRefreshOfflineCache: () => void | Promise<void>;
  onClearSyncedOfflineOps: () => void | Promise<void>;
  backupConfig: BackupScheduleConfig;
  backupHistory: BackupHistoryEntry[];
  onSaveBackupConfig: (nextConfig: BackupScheduleConfig) => void;
  onRunBackupNow: () => Promise<void>;
  onClearBackupHistory: () => void;
  onRestoreBackupComplete: () => Promise<void>;
  onLogout: () => void;
}

export const AdminSpace: React.FC<AdminSpaceProps> = (props) => {
  const { 
    currentUser, users, members, transactions, demandesRetrait, demandesFinancement, 
    corporations, zones, caisseMouvements, syncStatus, investissements, 
    auditLogs, isOnline, offlineQueue, offlineStats,
    onFlushOfflineQueue, onRefreshOfflineCache, onClearSyncedOfflineOps,
    backupConfig, backupHistory, onSaveBackupConfig, onRunBackupNow, onClearBackupHistory, onRestoreBackupComplete,
    onTestFirebase, onPushToFirebase, onPullFromFirebase,
    onAddMember, onValidateMember, onRejectMember, onUpdateMember, onDeleteMember,
    onOpenMemberCard, onOpenReceipt, onValidateRetrait, onRejectRetrait, 
    onValidateFinancement, onRejectFinancement, onPayEcheance, onDeleteFinancement,
    onCollecteDepot, onCollecteRetrait,
    onAddCorporation, onUpdateCorporationFrais, onAddZone,
    onSaveUser, onDeleteUser, onUpdatePassword,
    onAddHealthContribution, onAddSocialAssistance,
    onCreateInvestment, onUpdateInvestmentStatus, onDistributeProfit
  } = props;

  const isAdmin = currentUser.role === 'ADMIN';
  const isMaire = currentUser.role === 'MAIRE';
  const isAgent = currentUser.role === 'AGENT';
  const isTresorier = currentUser.role === 'TRESORIER';

  const [activeTab, setActiveTab] = useState<string>(isAgent ? 'collecte' : 'dashboard');
  const [showLauncher, setShowLauncher] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editMemberNom, setEditMemberNom] = useState('');
  const [editMemberTel, setEditMemberTel] = useState('');
  const [editMemberZone, setEditMemberZone] = useState('');
  const [editMemberError, setEditMemberError] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanMode, setQrScanMode] = useState<'auto' | 'member' | 'receipt'>('auto');
  const [qrScanError, setQrScanError] = useState('');
  const [checkedInMember, setCheckedInMember] = useState<Member | null>(null);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);
  const [financementFilter, setFinancementFilter] = useState<'en_attente' | 'valide' | 'historique'>('en_attente');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [profitProjectTarget, setProfitProjectTarget] = useState<InvestissementProjet | null>(null);
  const [profitAmountInput, setProfitAmountInput] = useState('');

  const pendingSyncItemsCount = offlineQueue.filter(i => i.status !== 'synced').length;
  const syncedQueueItemsCount = offlineQueue.filter(i => i.status === 'synced').length;
  const pendingMembersList = useMemo(
    () => members.filter(m => m.status === 'en_attente'),
    [members]
  );
  
  // Member Search & Filters
  const [memberSearch, setMemberSearch] = useState('');
  const [memberZoneFilter, setMemberZoneFilter] = useState('All');
  const [memberStatusFilter, setMemberStatusFilter] = useState('All');

  // Collecte Form
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [collecteAmount, setCollecteAmount] = useState('');
  const [collecteType, setCollecteType] = useState<'depot' | 'retrait'>('depot');

  // Audit Transaction Filters & CSV Export
  const [auditDateStart, setAuditDateStart] = useState('');
  const [auditDateEnd, setAuditDateEnd] = useState('');
  const [auditCorporationFilter, setAuditCorporationFilter] = useState('All');
  const [showAllAuditTransactions, setShowAllAuditTransactions] = useState(false);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const q = memberSearch.toLowerCase();
      const matchesSearch = (m.nom || '').toLowerCase().includes(q) || 
                           (m.livret || '').toLowerCase().includes(q) ||
                           (m.id || '').toLowerCase().includes(q) ||
                           (m.telephone || '').includes(memberSearch);
      const matchesZone = memberZoneFilter === 'All' || m.zone === memberZoneFilter;
      const matchesStatus = memberStatusFilter === 'All' || m.status === memberStatusFilter;
      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [members, memberSearch, memberZoneFilter, memberStatusFilter]);

  const hasAuditFilters = Boolean(
    auditDateStart || auditDateEnd || auditCorporationFilter !== 'All'
  );

  const filteredAuditTransactions = useMemo(() => {
    return filterTransactions(transactions, {
      members,
      corporations,
      dateStart: auditDateStart,
      dateEnd: auditDateEnd,
      corporationId: auditCorporationFilter,
    });
  }, [transactions, members, corporations, auditDateStart, auditDateEnd, auditCorporationFilter]);

  const visibleAuditTransactions = showAllAuditTransactions
    ? filteredAuditTransactions
    : filteredAuditTransactions.slice(0, 25);

  // Stats
  const membresValides = members.filter(m => m.status === 'valide').length;
  const membresEnAttente = members.filter(m => m.status === 'en_attente').length;
  const soldeTotal = members.reduce((sum, m) => sum + m.solde, 0);
  const soldeCaisseFinancement = (caisseMouvements || [])
    .filter(m => m.type !== 'cotisation_sante' && m.type !== 'assistance_sociale')
    .reduce((acc, m) => m.type === 'decaissement' ? acc - m.montant : acc + m.montant, 0);
  const soldeSocial = (caisseMouvements || []).filter(m => m.type === 'cotisation_sante' || m.type === 'assistance_sociale').reduce((sum, m) => sum + (m.type === 'cotisation_sante' ? m.montant : -m.montant), 0);
  const soldeGlobalSysteme = soldeTotal + soldeCaisseFinancement + soldeSocial;
  const todayStr = new Date().toDateString();
  const collecteAujourdhui = transactions
    .filter(t => {
      if (t.type !== 'depot') return false;
      const d = new Date(t.date);
      return !Number.isNaN(d.getTime()) && d.toDateString() === todayStr;
    })
    .reduce((sum, t) => sum + t.montant, 0);
  const retraitsEnAttente = demandesRetrait.filter(d => d.status === 'en_attente').length;
  const financementsEnAttente = demandesFinancement.filter(f => f.status === 'en_attente').length;
  const totalActionsEnAttente = membresEnAttente + retraitsEnAttente + financementsEnAttente;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TRESORIER', 'MAIRE', 'AGENT'] },
    { id: 'membres', label: 'Adhérents', icon: Users, badge: membresEnAttente },
    { id: 'collecte', label: 'Caisse Directe', icon: Banknote },
    { id: 'retraits', label: 'Retraits', icon: ArrowDownRight, badge: retraitsEnAttente, roles: ['ADMIN', 'TRESORIER', 'MAIRE'] },
    { id: 'financements', label: 'Financements', icon: Calculator, badge: financementsEnAttente, roles: ['ADMIN', 'TRESORIER', 'MAIRE'] },
    { id: 'coffre-fort', label: 'Investissements', icon: Landmark, roles: ['ADMIN', 'TRESORIER', 'MAIRE'] },
    { id: 'audit', label: 'Audit & Flux', icon: ShieldCheck, roles: ['ADMIN', 'MAIRE'] },
    { id: 'parametres', label: 'Administration', icon: Settings, roles: ['ADMIN', 'TRESORIER'] },
    { id: 'sauvegardes', label: 'Sauvegardes', icon: Archive, roles: ['ADMIN'] },
  ];

  const handleQRScan = (decodedText: string) => {
    if (qrScanMode === 'receipt' || qrScanMode === 'auto') {
      const receipt = decodeReceiptQRPayload(decodedText, transactions, members);
      if (receipt) {
        setQrScanError('');
        setShowQRScanner(false);
        onOpenReceipt(receipt);
        confetti({ particleCount: 25, spread: 35, origin: { y: 0.7 } });
        return;
      }
    }

    if (qrScanMode === 'member' || qrScanMode === 'auto') {
      const found = decodeMemberQRPayload(decodedText, members);
      if (found) {
        setSelectedMemberId(found.id);
        setCheckedInMember(found);
        setQrScanError('');
        setActiveTab('collecte');
        setShowQRScanner(false);
        confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
        return;
      }
    }

    setQrScanError(
      qrScanMode === 'receipt'
        ? 'Aucun reçu ou transaction trouvé pour ce QR code ou cette référence.'
        : 'Aucun adhérent ou reçu reconnu pour ce QR code. Vérifiez la carte ou la référence du reçu.'
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-paper dark:bg-slate-950 transition-colors duration-500 font-body">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-72 flex-col border-r hairline bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
        <div className="p-6 space-y-8">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lapis text-white flex items-center justify-center font-display font-bold text-lg shadow-lg shadow-lapis/20">{(currentUser.nom || 'A').charAt(0)}</div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-charcoal dark:text-white truncate">{currentUser.nom}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentUser.role}</div>
              </div>
            </div>
            <div className="pt-3 border-t hairline flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Secteur :</span>
              <span className="text-[10px] font-bold text-charcoal dark:text-slate-200">{currentUser.zone}</span>
            </div>
          </div>

          <nav className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">Navigation</div>
            {navItems.filter(item => !item.roles || item.roles.includes(currentUser.role)).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-lapis text-white shadow-xl shadow-lapis/10' 
                    : 'text-slate-500 hover:bg-white dark:hover:bg-slate-900 hover:text-charcoal dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-gold transition-colors'} />
                  <span>{item.label}</span>
                </div>
                {(item.badge ?? 0) > 0 && <span className="w-5 h-5 rounded-full bg-gold text-white text-[10px] flex items-center justify-center font-bold shadow-sm">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b hairline bg-white/30 dark:bg-slate-950/30 flex items-center justify-between px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Admin</span>
            <ChevronRight size={12} />
            <span className="text-charcoal dark:text-white font-bold">{navItems.find(n => n.id === activeTab)?.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowOfflineModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                !isOnline || pendingSyncItemsCount > 0
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:border-lapis/40'
              }`}
              title="Cache IndexedDB & File de synchronisation hors-ligne"
            >
              {isOnline ? <HardDrive size={13} /> : <WifiOff size={13} />}
              <span>{isOnline ? 'Cache IDB' : 'Hors-Ligne'}</span>
              {pendingSyncItemsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold tabular">
                  {pendingSyncItemsCount}
                </span>
              )}
            </button>
            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${syncStatus === 'connected' && isOnline ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-amber-500 border-amber-500/20 bg-amber-500/5'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'connected' && isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isOnline ? (syncStatus === 'connected' ? 'Synced' : 'Local') : 'Offline'}
            </div>
            <button className="lg:hidden p-2 text-charcoal dark:text-white" onClick={() => setShowLauncher(true)}><LayoutDashboard size={20} /></button>
          </div>
        </div>

        {(!isOnline || pendingSyncItemsCount > 0) && (
          <div className="px-8 py-3 border-b hairline bg-amber-50/80 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
              {isOnline ? <HardDrive size={15} className="shrink-0" /> : <WifiOff size={15} className="shrink-0" />}
              <span>
                {!isOnline
                  ? `Mode hors-ligne actif · ${offlineStats?.cachedMembersCount ?? members.length} adhérents et ${offlineStats?.cachedTransactionsCount ?? transactions.length} transactions disponibles depuis IndexedDB.`
                  : `${pendingSyncItemsCount} opération(s) enregistrée(s) hors-ligne en attente de synchronisation.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOfflineModal(true)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 text-xs font-bold hover:bg-amber-100/50 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Voir cache & file ({pendingSyncItemsCount})
              </button>
              {isOnline && pendingSyncItemsCount > 0 && (
                <button
                  type="button"
                  disabled={isFlushingQueue}
                  onClick={async () => {
                    setIsFlushingQueue(true);
                    try {
                      await onFlushOfflineQueue();
                    } finally {
                      setIsFlushingQueue(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-lapis text-white text-xs font-bold flex items-center gap-1.5 hover:bg-lapis/90 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={12} className={isFlushingQueue ? 'animate-spin' : ''} />
                  Synchroniser
                </button>
              )}
            </div>
          </div>
        )}

        <main className="p-8 lg:p-12 overflow-y-auto custom-scrollbar">
          {activeTab === 'dashboard' && (
            <div className="space-y-12 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-display font-bold text-charcoal dark:text-white leading-tight">Bonjour, {currentUser.nom.split(' ')[0]}</h1>
                  <p className="text-slate-500 text-lg mt-1">État actuel de la micro-finance régionale.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQrScanMode('receipt');
                      setQrScanError('');
                      setShowQRScanner(true);
                    }}
                    className="px-4 py-3 bg-white dark:bg-slate-900 border hairline text-lapis dark:text-blue-300 rounded-xl font-display font-bold text-sm hover:border-lapis/50 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <QrCode size={16} /> Scanner Reçu QR
                  </button>
                  {!isMaire && (
                    <button type="button" onClick={() => setActiveTab('collecte')} className="px-6 py-3 bg-lapis text-white rounded-xl font-display font-bold text-sm shadow-xl shadow-lapis/20 hover:scale-[1.02] transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
                      <Banknote size={16} /> Nouveau Versement
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Adhérents" value={membresValides} sub={`+${membresEnAttente} en attente`} icon={Users} color="lapis" />
                <KPICard title="Trésorerie" value={soldeGlobalSysteme} sub="Consolidé" icon={Landmark} color="gold" isCurrency />
                <KPICard title="Collecte Jour" value={collecteAujourdhui} sub="Temps réel" icon={TrendingUp} color="emerald" isCurrency />
                <KPICard title="Actions" value={totalActionsEnAttente} sub={totalActionsEnAttente > 0 ? "Urgent" : "À jour"} icon={AlertCircle} color={totalActionsEnAttente > 0 ? "rose" : "slate"} onClick={() => setActiveTab('membres')} />
              </div>

              {!isAgent && (
                <CriticalAlerts
                  demandesRetrait={demandesRetrait}
                  demandesFinancement={demandesFinancement}
                  members={members}
                  canValidate={isAdmin || isTresorier}
                  onValidateRetrait={onValidateRetrait}
                  onRejectRetrait={onRejectRetrait}
                  onValidateFinancement={onValidateFinancement}
                  onRejectFinancement={onRejectFinancement}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              <FinancialTrendsChart
                transactions={transactions}
                caisseMouvements={caisseMouvements}
                onNavigateToCollecte={!isMaire ? () => setActiveTab('collecte') : undefined}
              />

              <div className="grid lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 p-8 rounded-[2rem] bg-white dark:bg-slate-900 hairline shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-display font-bold">Évolution Épargne</h3>
                  </div>
                  <div className="h-80 w-full"><SavingsEvolutionChart transactions={transactions} /></div>
                </div>
                <div className="space-y-8">
                  <div className="p-8 rounded-[2rem] bg-white dark:bg-slate-900 hairline shadow-sm space-y-8">
                    <h3 className="font-display font-bold flex items-center gap-2 text-gold"><Shield size={18} /> Répartition des Fonds</h3>
                    <div className="space-y-6">
                      <ProgressStat label="Épargne Adhérents" val={soldeTotal} total={soldeGlobalSysteme} color="bg-lapis" />
                      <ProgressStat label="Fonds Financement" val={soldeCaisseFinancement} total={soldeGlobalSysteme} color="bg-gold" />
                      <ProgressStat label="Fonds Social & Santé" val={soldeSocial} total={soldeGlobalSysteme} color="bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <ZoneActivityChart transactions={transactions} zones={zones} />
                <CaisseFinancementChart caisseMouvements={caisseMouvements} corporations={corporations} />
              </div>
            </div>
          )}

          {activeTab === 'membres' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-display font-bold">Base Adhérents</h1>
                  <p className="text-slate-500 text-sm mt-1">Gérez la communauté PMES-AGR.</p>
                </div>
                <div className="flex items-center gap-3">
                  {!isMaire && (
                    <button
                      type="button"
                      onClick={() => {
                        setQrScanMode('auto');
                        setQrScanError('');
                        setShowQRScanner(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-lapis/10 text-lapis text-xs font-bold flex items-center gap-2 hover:bg-lapis hover:text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <QrCode size={14} /> Check-in QR
                    </button>
                  )}
                  <button type="button" onClick={() => exportMembersToCSV(members)} className="px-4 py-2.5 rounded-xl bg-paper dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-2 hover:bg-white transition-all hairline whitespace-nowrap shrink-0 cursor-pointer">
                    <Download size={14} /> CSV
                  </button>
                  {!isMaire && <button type="button" onClick={() => { setAddMemberError(''); setShowAddMember(true); }} className="px-5 py-2.5 bg-lapis text-white rounded-xl text-xs font-bold shadow-lg shadow-lapis/20 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer">+ Inscrire</button>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Rechercher un nom, livret ou téléphone..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-paper dark:bg-slate-800 text-sm outline-none"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <select 
                  className="px-4 py-3 rounded-xl bg-paper dark:bg-slate-800 text-sm outline-none font-semibold appearance-none cursor-pointer"
                  value={memberZoneFilter}
                  onChange={(e) => setMemberZoneFilter(e.target.value)}
                >
                  <option value="All">Toutes les Zones</option>
                  {zones.map(z => <option key={z.id} value={z.nom}>{z.nom}</option>)}
                </select>
                <select 
                  className="px-4 py-3 rounded-xl bg-paper dark:bg-slate-800 text-sm outline-none font-semibold appearance-none cursor-pointer"
                  value={memberStatusFilter}
                  onChange={(e) => setMemberStatusFilter(e.target.value)}
                >
                  <option value="All">Tous les Statuts</option>
                  <option value="valide">Validés</option>
                  <option value="en_attente">En attente</option>
                  <option value="rejete">Rejetés</option>
                </select>
              </div>

              <div className="bg-white dark:bg-slate-900 hairline rounded-3xl overflow-x-auto shadow-sm">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-paper dark:bg-slate-950/50 text-[10px] text-slate-400 uppercase tracking-widest font-bold border-b hairline">
                    <tr><th className="px-8 py-5">Adhérent / Livret</th><th className="px-8 py-5">Localisation</th><th className="px-8 py-5">Épargne</th><th className="px-8 py-5">Statut</th><th className="px-8 py-5 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y hairline">
                    {filteredMembers.map(m => (
                      <tr key={m.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-paper dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-lapis overflow-hidden">
                              {m.photo ? <img src={m.photo} alt={m.nom} className="w-full h-full object-cover" /> : (m.nom || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-charcoal dark:text-white text-sm">{m.nom}</div>
                              <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{m.livret}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin size={12} className="text-slate-300" />
                            <span>{m.zone}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="font-display font-bold tabular text-sm">{m.solde.toLocaleString()} <span className="text-[10px] opacity-40">F</span></div>
                        </td>
                        <td className="px-8 py-5">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            m.status === 'valide' ? 'bg-emerald-500/5 text-emerald-500 border border-emerald-500/20' : 
                            m.status === 'en_attente' ? 'bg-amber-500/5 text-amber-500 border border-amber-500/20' : 
                            'bg-rose-500/5 text-rose-500 border border-rose-500/20'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${m.status === 'valide' ? 'bg-emerald-500' : m.status === 'en_attente' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                            {m.status}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {m.status === 'en_attente' && (isAdmin || isTresorier) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onValidateMember(m.id)}
                                  className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                  title="Valider l'adhésion"
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectMember(m.id)}
                                  className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                  title="Rejeter l'adhésion"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMember(m);
                                  setEditMemberNom(m.nom);
                                  setEditMemberTel(m.telephone);
                                  setEditMemberZone(m.zone);
                                  setEditMemberError('');
                                }}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-gold transition-all cursor-pointer"
                                title="Modifier l'adhérent"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            <button type="button" onClick={() => onOpenMemberCard(m)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-lapis transition-all cursor-pointer" title="Voir la carte membre">
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredMembers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-sm text-slate-400 italic">
                          Aucun adhérent ne correspond à vos critères de recherche.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'collecte' && (
            <div className="max-w-xl mx-auto space-y-12 animate-fadeIn pt-8">
              <div className="text-center space-y-3">
                <h1 className="text-4xl font-display font-bold text-charcoal dark:text-white">Opération de Guichet</h1>
                <p className="text-slate-500 text-lg">Encaissement et décaissement en temps réel.</p>
              </div>
              
              <div className="p-10 rounded-[3rem] bg-white dark:bg-slate-900 hairline shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-bl-full -mr-10 -mt-10" />
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedMemberId || !collecteAmount) return;
                  const amt = parseFloat(collecteAmount);
                  if (!amt || isNaN(amt) || amt <= 0) return;
                  const ok = collecteType === 'depot'
                    ? onCollecteDepot(selectedMemberId, amt)
                    : onCollecteRetrait(selectedMemberId, amt);
                  if (ok) {
                    setCollecteAmount('');
                    setSelectedMemberId('');
                    setCheckedInMember(null);
                    confetti({particleCount: 100, spread: 70, origin: {y: 0.6}});
                  }
                }} className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">Sélection Adhérent</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          setQrScanMode('auto');
                          setQrScanError('');
                          setShowQRScanner(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-lapis/5 text-lapis text-[10px] font-bold hover:bg-lapis hover:text-white transition-all cursor-pointer"
                      >
                        <QrCode size={14} /> Scanner QR
                      </button>
                    </div>
                    {checkedInMember && checkedInMember.id === selectedMemberId && (
                      <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-3 text-xs">
                        <div className="text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                          Check-in QR : {checkedInMember.nom} · {checkedInMember.livret} ({checkedInMember.id})
                        </div>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0 tabular">
                          {checkedInMember.solde.toLocaleString()} F
                        </span>
                      </div>
                    )}
                    <select 
                      value={selectedMemberId}
                      onChange={(e) => {
                        setSelectedMemberId(e.target.value);
                        if (checkedInMember && checkedInMember.id !== e.target.value) {
                          setCheckedInMember(null);
                        }
                      }}
                      className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none text-sm font-semibold focus:ring-2 ring-lapis/20 transition-all" 
                      required
                    >
                      <option value="">Chercher un livret ou un nom...</option>
                      {members.filter(m => m.status === 'valide').map(m => (
                        <option key={m.id} value={m.id}>{m.livret} - {m.nom} ({m.solde.toLocaleString()} F)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button"
                      onClick={() => setCollecteType('depot')}
                      className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex flex-col items-center gap-2 transition-all border ${
                        collecteType === 'depot' 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                          : 'bg-paper dark:bg-slate-800 text-slate-400 border-transparent'
                      }`}
                    >
                      <ArrowUpRight size={18} /> Versement
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCollecteType('retrait')}
                      className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex flex-col items-center gap-2 transition-all border ${
                        collecteType === 'retrait' 
                          ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                          : 'bg-paper dark:bg-slate-800 text-slate-400 border-transparent'
                      }`}
                    >
                      <ArrowDownRight size={18} /> Retrait
                    </button>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Montant"
                        value={collecteAmount}
                        onChange={(e) => setCollecteAmount(e.target.value)}
                        className="w-full h-full rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none font-display font-bold text-center text-lg px-2"
                        required 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">F</span>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-5 bg-lapis text-white rounded-2xl font-display font-bold text-base shadow-2xl shadow-lapis/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Confirmer l'opération
                    <ArrowRightLeft size={18} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'retraits' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-display font-bold">Validations de Retrait</h1>
                  <p className="text-slate-500 text-sm mt-1">Autorisez les décaissements importants.</p>
                </div>
              </div>
              
              {demandesRetrait.filter(d => d.status === 'en_attente').length === 0 ? (
                <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 hairline text-center text-sm text-slate-500">
                  Aucun retrait en attente de validation.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {demandesRetrait.filter(d => d.status === 'en_attente').map(d => {
                    const m = members.find(item => item.id === d.member_id);
                    const soldeInsuffisant = !m || m.solde < d.montant;
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={d.id} 
                        className="p-8 rounded-[2rem] bg-white dark:bg-slate-900 hairline shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <Users size={12} className="text-gold shrink-0" />
                            <span className="truncate">{m?.nom || 'Inconnu'} · Solde: {(m?.solde ?? 0).toLocaleString()} F</span>
                          </div>
                          <div className="text-3xl font-display font-bold tabular">{d.montant.toLocaleString()} <span className="text-sm font-normal opacity-40">F</span></div>
                          <div className="text-xs text-slate-500 font-medium bg-paper dark:bg-slate-800 px-3 py-1 rounded-full inline-block mt-2 italic">"{d.motif}"</div>
                          {soldeInsuffisant && (
                            <div className="text-[11px] font-bold text-rose-500 pt-1">
                              Solde insuffisant pour approuver ce retrait
                            </div>
                          )}
                        </div>
                        {(isAdmin || isTresorier) && (
                          <div className="flex gap-3 shrink-0">
                            <button
                              type="button"
                              disabled={soldeInsuffisant}
                              onClick={() => onValidateRetrait(d.id)}
                              title={soldeInsuffisant ? 'Solde disponible insuffisant' : 'Valider le retrait'}
                              className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20 hover:scale-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                              <Check size={24} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectRetrait(d.id)}
                              title="Rejeter le retrait"
                              className="w-14 h-14 rounded-full bg-paper dark:bg-slate-800 text-slate-400 flex items-center justify-center border hairline hover:text-rose-500 transition-all cursor-pointer"
                            >
                              <X size={24} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'financements' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-display font-bold">Comité de Crédit</h1>
                  <p className="text-slate-500 text-sm mt-1">Validation des dossiers et suivi des échéanciers.</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFinancementFilter('en_attente')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      financementFilter === 'en_attente' ? 'bg-lapis text-white' : 'text-slate-500'
                    }`}
                  >
                    En attente ({financementsEnAttente})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancementFilter('valide')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      financementFilter === 'valide' ? 'bg-lapis text-white' : 'text-slate-500'
                    }`}
                  >
                    Actifs & Échéanciers ({demandesFinancement.filter(f => f.status === 'valide').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancementFilter('historique')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      financementFilter === 'historique' ? 'bg-lapis text-white' : 'text-slate-500'
                    }`}
                  >
                    Rejetés ({demandesFinancement.filter(f => f.status === 'rejete').length})
                  </button>
                </div>
              </div>

              {financementFilter === 'en_attente' && (
                demandesFinancement.filter(f => f.status === 'en_attente').length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 hairline text-center text-sm text-slate-500">
                    Aucun dossier de financement en attente d&apos;examen.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    {demandesFinancement.filter(f => f.status === 'en_attente').map(f => {
                      const m = members.find(item => item.id === f.member_id);
                      return (
                        <motion.div layout key={f.id} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 hairline shadow-sm space-y-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 px-4 py-1 bg-lapis text-white text-[10px] font-bold uppercase tracking-widest rounded-bl-2xl">{f.financement_type.replace('_', ' ')}</div>
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{m?.nom}</div>
                            <div className="text-3xl font-display font-bold tabular-nums">{f.montant.toLocaleString()} F</div>
                            <div className="text-xs text-slate-500 font-bold mt-1">Durée : {f.duree_mois} mois</div>
                          </div>
                          <div className="p-5 rounded-2xl bg-paper dark:bg-slate-800/50 border hairline"><p className="text-sm italic">&quot;{f.motif}&quot;</p></div>
                          {(isAdmin || isTresorier) && (
                            <div className="flex gap-4">
                              <button onClick={() => onValidateFinancement(f.id)} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all cursor-pointer">Approuver</button>
                              <button onClick={() => onRejectFinancement(f.id)} className="flex-1 py-4 bg-paper dark:bg-slate-800 text-slate-400 rounded-2xl font-bold text-xs hairline hover:text-rose-500 transition-all cursor-pointer">Rejeter</button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )
              )}

              {financementFilter === 'valide' && (
                demandesFinancement.filter(f => f.status === 'valide').length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 hairline text-center text-sm text-slate-500">
                    Aucun financement actif en cours.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    {demandesFinancement.filter(f => f.status === 'valide').map(f => {
                      const m = members.find(item => item.id === f.member_id);
                      const totalDu = f.montant_total || f.montant;
                      const rembourse = f.montant_rembourse || 0;
                      const pct = totalDu > 0 ? Math.min(100, Math.round((rembourse / totalDu) * 100)) : 0;
                      return (
                        <div key={f.id} className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-slate-500 font-semibold">{m?.nom || 'Adhérent'} · {f.financement_type.toUpperCase()}</div>
                              <div className="text-2xl font-display font-bold tabular-nums mt-0.5">{totalDu.toLocaleString()} F</div>
                              <div className="text-xs text-emerald-600 font-semibold tabular-nums mt-0.5">
                                Remboursé : {rembourse.toLocaleString()} F ({pct}%)
                              </div>
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => onDeleteFinancement(f.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="Supprimer ce dossier"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                          <div className="w-full h-2 bg-paper dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          {f.echeances && f.echeances.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 pt-3">
                              {f.echeances.map((ech) => (
                                <div key={ech.numero} className="pt-2 flex items-center justify-between gap-3 text-xs">
                                  <div className="tabular-nums">
                                    <span className="font-semibold text-charcoal dark:text-white">Échéance #{ech.numero}</span>
                                    <span className="text-slate-400"> · {ech.date}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold tabular-nums">{ech.montant.toLocaleString()} F</span>
                                    {ech.paye ? (
                                      <span className="text-emerald-600 font-semibold">Payée</span>
                                    ) : !isMaire ? (
                                      <button
                                        type="button"
                                        onClick={() => onPayEcheance(f.id, ech.numero)}
                                        className="px-2.5 py-1 rounded-lg bg-lapis text-white font-bold hover:bg-lapis/90 transition cursor-pointer whitespace-nowrap"
                                      >
                                        Encaisser
                                      </button>
                                    ) : (
                                      <span className="text-slate-400">À échoir</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {financementFilter === 'historique' && (
                demandesFinancement.filter(f => f.status === 'rejete').length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 hairline text-center text-sm text-slate-500">
                    Aucun dossier rejeté.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    {demandesFinancement.filter(f => f.status === 'rejete').map(f => {
                      const m = members.find(item => item.id === f.member_id);
                      return (
                        <div key={f.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 hairline flex items-center justify-between gap-4 text-xs">
                          <div>
                            <div className="font-bold text-charcoal dark:text-white">{m?.nom || 'Adhérent'}</div>
                            <div className="text-slate-500 mt-0.5 tabular-nums">{f.montant.toLocaleString()} F · {f.motif}</div>
                          </div>
                          <span className="text-rose-500 font-semibold">Rejeté</span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-display font-bold">Audit & Transparence</h1>
                  <p className="text-slate-500 text-sm mt-1">Journal complet des opérations, filtrage multicritère et exportation CSV.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQrScanMode('receipt');
                      setQrScanError('');
                      setShowQRScanner(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-lapis text-white text-xs font-bold flex items-center gap-2 hover:bg-lapis/90 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-md shadow-lapis/15"
                  >
                    <QrCode size={14} /> Scanner Reçu QR
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('sauvegardes')}
                      className="px-4 py-2.5 rounded-xl bg-lapis/10 text-lapis text-xs font-bold flex items-center gap-2 hover:bg-lapis hover:text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Archive size={14} /> Sauvegardes JSON
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={filteredAuditTransactions.length === 0}
                    onClick={() =>
                      exportTransactionsToCSV(filteredAuditTransactions, {
                        members,
                        corporations,
                        dateStart: auditDateStart || undefined,
                        dateEnd: auditDateEnd || undefined,
                        corporationId: auditCorporationFilter,
                        applyFilters: false,
                      })
                    }
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
                  >
                    <Download size={14} />
                    <span>
                      {hasAuditFilters
                        ? `Exporter CSV filtré (${filteredAuditTransactions.length})`
                        : `Exporter Historique CSV (${filteredAuditTransactions.length})`}
                    </span>
                  </button>
                  {hasAuditFilters && (
                    <button
                      type="button"
                      disabled={transactions.length === 0}
                      onClick={() =>
                        exportTransactionsToCSV(transactions, {
                          members,
                          corporations,
                          applyFilters: false,
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-paper dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-2 hover:bg-white transition-all hairline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download size={14} /> Tout exporter ({transactions.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Barre de filtres Date & Corporation pour Audit et Export CSV */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={auditDateStart}
                      max={auditDateEnd || undefined}
                      onChange={(e) => setAuditDateStart(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-paper dark:bg-slate-800 text-xs font-semibold text-charcoal dark:text-white outline-none border border-transparent focus:border-lapis"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={auditDateEnd}
                      min={auditDateStart || undefined}
                      onChange={(e) => setAuditDateEnd(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-paper dark:bg-slate-800 text-xs font-semibold text-charcoal dark:text-white outline-none border border-transparent focus:border-lapis"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
                      Corporation
                    </label>
                    <select
                      value={auditCorporationFilter}
                      onChange={(e) => setAuditCorporationFilter(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-paper dark:bg-slate-800 text-xs font-semibold text-charcoal dark:text-white outline-none cursor-pointer"
                    >
                      <option value="All">Toutes les corporations</option>
                      {corporations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 h-11">
                    {hasAuditFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuditDateStart('');
                          setAuditDateEnd('');
                          setAuditCorporationFilter('All');
                        }}
                        className="h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 border hairline text-slate-600 dark:text-slate-300 hover:text-rose-500 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <X size={14} /> Réinitialiser
                      </button>
                    )}
                    <div className="text-right text-xs text-slate-500 tabular-nums px-2">
                      <span className="font-bold text-charcoal dark:text-white">
                        {filteredAuditTransactions.length}
                      </span>{' '}
                      / {transactions.length} op.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-slate-900 hairline rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b hairline flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-display font-bold text-sm">
                        {hasAuditFilters ? 'Opérations filtrées' : 'Historique des Opérations'}
                      </h3>
                      <span className="text-xs font-semibold text-slate-400 tabular-nums">
                        Volume :{' '}
                        {filteredAuditTransactions
                          .reduce((sum, tx) => sum + tx.montant, 0)
                          .toLocaleString()}{' '}
                        F CFA
                      </span>
                    </div>
                    <div className="divide-y hairline overflow-x-auto">
                      {visibleAuditTransactions.length === 0 ? (
                        <div className="p-10 text-center text-sm text-slate-400">
                          Aucune transaction ne correspond aux critères sélectionnés.
                        </div>
                      ) : (
                        visibleAuditTransactions.map(t => {
                        const txMember = members.find(m => m.id === t.member_id);
                        const txCorp = resolveTransactionCorporation(t, members, corporations);
                        const receiptPayload: ReceiptData = {
                          transactionId: t.id,
                          type: t.type,
                          reference: t.reference || `PMES-${t.id.slice(-6).toUpperCase()}`,
                          date: t.date,
                          memberNom: t.member_nom || txMember?.nom || 'Adhérent',
                          memberLivret: t.member_livret || txMember?.livret || '---',
                          memberTelephone: txMember?.telephone || '---',
                          zone: t.zone || txMember?.zone || 'Dosso',
                          montant: t.montant,
                          soldeAvant: t.solde_avant,
                          soldeApres: t.solde_apres,
                          agentNom: t.agent,
                          motif: t.description,
                        };
                        const isPositiveTx = t.type === 'depot' || t.type === 'financement';
                        return (
                          <div key={t.id} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-w-[600px]">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPositiveTx ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {isPositiveTx ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-charcoal dark:text-white truncate">{receiptPayload.memberNom}</div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  {receiptPayload.reference} · @{t.agent} · {txCorp.nom}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <div className={`text-sm font-display font-bold tabular ${isPositiveTx ? 'text-emerald-500' : 'text-rose-500'}`}>{isPositiveTx ? '+' : '-'}{t.montant.toLocaleString()} F</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-tighter tabular">
                                  {Number.isNaN(new Date(t.date).getTime()) ? '---' : new Date(t.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenReceipt(receiptPayload)}
                                  className="px-2.5 py-1.5 rounded-lg bg-paper dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-lapis text-[11px] font-bold hairline transition cursor-pointer whitespace-nowrap shrink-0"
                                  title="Afficher le reçu"
                                >
                                  Reçu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadReceiptPDF(receiptPayload, { format: 'a4' })}
                                  className="p-1.5 rounded-lg bg-lapis/10 text-lapis hover:bg-lapis hover:text-white transition cursor-pointer shrink-0"
                                  title="Télécharger le reçu PDF"
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                      )}
                    </div>
                    {filteredAuditTransactions.length > 25 && (
                      <div className="p-4 border-t hairline text-center">
                        <button
                          type="button"
                          onClick={() => setShowAllAuditTransactions((prev) => !prev)}
                          className="text-xs font-bold text-lapis hover:underline cursor-pointer"
                        >
                          {showAllAuditTransactions
                            ? 'Réduire aux 25 plus récentes'
                            : `Afficher toutes les ${filteredAuditTransactions.length} opérations`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="p-8 rounded-[2.5rem] bg-charcoal text-white shadow-xl space-y-8">
                    <div className="flex items-center justify-between"><h3 className="font-display font-bold text-lg">Journal de Sécurité</h3><ShieldCheck size={20} className="text-emerald-500" /></div>
                    <div className="space-y-6">
                      {auditLogs.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-4">Aucun événement de sécurité enregistré.</div>
                      ) : (
                        auditLogs.slice(0, 8).map(log => {
                          const logDate = new Date(log.date);
                          const timeStr = Number.isNaN(logDate.getTime()) ? '---' : logDate.toLocaleTimeString('fr-FR');
                          return (
                            <div key={log.id} className="relative pl-6 border-l border-white/10 space-y-1">
                              <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-emerald-500" />
                              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{log.action}</div>
                              <div className="text-[11px] text-slate-400 leading-relaxed">{log.details}</div>
                              <div className="text-[9px] text-slate-500 font-bold mt-1 uppercase">{timeStr} • {log.acteur}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coffre-fort' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-display font-bold">Coffre-fort & Investissements</h1>
                  <p className="text-slate-500 text-sm mt-1">Projets communautaires à fort impact.</p>
                </div>
                {(isAdmin || isTresorier) && (
                  <button
                    type="button"
                    onClick={() => setShowCreateProject(true)}
                    className="px-5 py-2.5 bg-gold text-white rounded-xl text-xs font-bold shadow-lg shadow-gold/20 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Landmark size={14} /> Créer un Projet
                  </button>
                )}
              </div>
              {investissements.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 hairline text-center space-y-3">
                  <p className="text-sm text-slate-500">Aucun projet d&apos;investissement collectif ouvert.</p>
                  {(isAdmin || isTresorier) && (
                    <button
                      type="button"
                      onClick={() => setShowCreateProject(true)}
                      className="px-4 py-2 rounded-xl bg-gold text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={14} /> Lancer le premier projet
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {investissements.map(p => (
                    <div key={p.id} className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 hairline shadow-sm hover:shadow-xl transition-all flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-14 h-14 rounded-2xl bg-gold/10 text-gold flex items-center justify-center"><Building2 size={28} /></div>
                          <span className={`text-xs font-bold uppercase tracking-wider ${p.status === 'ouvert' ? 'text-emerald-500' : 'text-slate-500'}`}>{p.status}</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-display font-bold">{p.titre}</h3>
                          <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-3">{p.description}</p>
                        </div>
                      </div>
                      <div className="mt-8 space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span className="text-slate-400 tabular-nums">Objectif: {p.montant_cible.toLocaleString()} F</span><span className="text-gold tabular-nums">{p.montant_cible > 0 ? Math.round((p.montant_actuel / p.montant_cible) * 100) : 0}%</span></div>
                          <div className="w-full h-2 bg-paper dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: `${p.montant_cible > 0 ? Math.min(100, (p.montant_actuel / p.montant_cible) * 100) : 0}%` }} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t hairline pt-6">
                          <div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Participants</div><div className="text-sm font-display font-bold tabular-nums">{p.nb_participants} Adhérents</div></div>
                          <div className="text-right"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Profit Est.</div><div className="text-sm font-display font-bold text-emerald-500 tabular-nums">+{p.profit_estime_pct}%</div></div>
                        </div>
                        {(isAdmin || isTresorier) && p.status !== 'cloture' && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t hairline">
                            {p.status === 'ouvert' ? (
                              <button
                                type="button"
                                onClick={() => onUpdateInvestmentStatus(p.id, 'ferme')}
                                className="px-3 py-1.5 rounded-lg bg-paper dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border hairline cursor-pointer"
                              >
                                Fermer souscriptions
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpdateInvestmentStatus(p.id, 'ouvert')}
                                className="px-3 py-1.5 rounded-lg bg-paper dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border hairline cursor-pointer"
                              >
                                Réouvrir
                              </button>
                            )}
                            {isAdmin && p.nb_participants > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProfitProjectTarget(p);
                                  setProfitAmountInput('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Distribuer profits
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'parametres' && (isAdmin || isTresorier) && (
            <AdminSettingsSection
              currentUser={currentUser}
              users={users}
              members={members}
              corporations={corporations}
              zones={zones}
              caisseMouvements={caisseMouvements}
              syncStatus={syncStatus}
              isOnline={isOnline}
              onTestFirebase={onTestFirebase}
              onPushToFirebase={onPushToFirebase}
              onPullFromFirebase={onPullFromFirebase}
              onAddCorporation={onAddCorporation}
              onUpdateCorporationFrais={onUpdateCorporationFrais}
              onAddZone={onAddZone}
              onSaveUser={onSaveUser}
              onDeleteUser={onDeleteUser}
              onUpdatePassword={onUpdatePassword}
              onAddHealthContribution={onAddHealthContribution}
              onAddSocialAssistance={onAddSocialAssistance}
            />
          )}

          {activeTab === 'sauvegardes' && isAdmin && (
            <BackupConfigSection
              config={backupConfig}
              history={backupHistory}
              liveCounts={{
                members: members.length,
                transactions: transactions.length,
                retraits: demandesRetrait.length,
                financements: demandesFinancement.length,
                caisseMouvements: caisseMouvements.length,
                auditLogs: auditLogs.length,
                pendingQueue: pendingSyncItemsCount,
              }}
              onSaveConfig={onSaveBackupConfig}
              onRunBackupNow={onRunBackupNow}
              onClearHistory={onClearBackupHistory}
              onRestoreComplete={onRestoreBackupComplete}
            />
          )}
        </main>
      </div>

      <AnimatePresence>
        {showAddMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowAddMember(false)} className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95, y: 20}} animate={{opacity:1, scale:1, y: 0}} exit={{opacity:0, scale:0.95, y: 20}} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl p-10 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold">Inscription Membre</h2>
                <button type="button" onClick={() => setShowAddMember(false)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={18} /></button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setAddMemberError('');
                const form = e.target as any;
                const cleanNom = String(form.nom.value || '').trim();
                if (cleanNom.length < 2) {
                  setAddMemberError('Veuillez saisir le nom complet de l’adhérent.');
                  return;
                }
                const rawTel = String(form.tel.value || '').replace(/\D/g, '');
                const cleanTel = rawTel.length >= 8 ? rawTel.slice(-8) : rawTel;
                if (cleanTel.length !== 8) {
                  setAddMemberError('Numéro de téléphone invalide (8 chiffres requis).');
                  return;
                }
                const selectedCorpo = corporations.find(c => c.id === form.corpo.value) || corporations[0];
                let uniqueLivret = `PMES-${Math.floor(100000 + Math.random() * 900000)}`;
                while (members.some(m => m.livret === uniqueLivret)) {
                  uniqueLivret = `PMES-${Math.floor(100000 + Math.random() * 900000)}`;
                }
                const ok = await onAddMember({
                  nom: cleanNom,
                  telephone: cleanTel,
                  pin: '1234',
                  livret: uniqueLivret,
                  zone: form.zone.value,
                  corporationId: selectedCorpo?.id,
                  corporationNom: selectedCorpo?.nom || 'Commerce',
                  corporationEmoji: selectedCorpo?.emoji || '🛍️',
                  solde: 0,
                  status: 'valide'
                });
                if (ok) {
                  setShowAddMember(false);
                  confetti({particleCount: 50, spread: 60, origin: {y: 0.6}});
                } else {
                  setAddMemberError('Impossible d’inscrire cet adhérent (numéro peut-être déjà utilisé).');
                }
              }} className="space-y-4">
                {addMemberError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    {addMemberError}
                  </div>
                )}
                <input name="nom" className="w-full h-12 px-5 rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none font-semibold text-sm" placeholder="Nom Complet" required />
                <input name="tel" type="tel" className="w-full h-12 px-5 rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none font-semibold text-sm" placeholder="Téléphone (8 chiffres)" required />
                <select name="zone" className="w-full h-12 px-5 rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none font-semibold text-sm">
                  {zones.map(z => <option key={z.id} value={z.nom}>{z.nom}</option>)}
                </select>
                <select name="corpo" className="w-full h-12 px-5 rounded-2xl bg-paper dark:bg-slate-800 border-none outline-none font-semibold text-sm">
                  {corporations.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
                </select>
                <button type="submit" className="w-full py-4 bg-lapis text-white rounded-2xl font-display font-bold text-base shadow-xl shadow-lapis/20 hover:scale-[1.02] transition-all mt-2 cursor-pointer">Valider l'Inscription</button>
              </form>
            </motion.div>
          </div>
        )}

        {editingMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setEditingMember(null)} className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95, y: 16}} animate={{opacity:1, scale:1, y: 0}} exit={{opacity:0, scale:0.95, y: 16}} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-5 border hairline">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold">Modifier l'adhérent</h2>
                <button type="button" onClick={() => setEditingMember(null)} className="p-1.5 text-slate-400 cursor-pointer"><X size={18} /></button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditMemberError('');
                  const cleanNom = editMemberNom.trim();
                  if (cleanNom.length < 2) {
                    setEditMemberError('Nom complet invalide.');
                    return;
                  }
                  const cleanTel = editMemberTel.replace(/\D/g, '').slice(-8);
                  if (cleanTel.length !== 8) {
                    setEditMemberError('Numéro de téléphone invalide (8 chiffres requis).');
                    return;
                  }
                  const ok = onUpdateMember(editingMember.id, {
                    nom: cleanNom,
                    telephone: cleanTel,
                    zone: editMemberZone,
                  });
                  if (ok) setEditingMember(null);
                  else setEditMemberError('Mise à jour refusée (numéro déjà utilisé par un autre membre).');
                }}
                className="space-y-4"
              >
                {editMemberError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    {editMemberError}
                  </div>
                )}
                <input value={editMemberNom} onChange={(e) => { setEditMemberNom(e.target.value); setEditMemberError(''); }} required className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-medium" placeholder="Nom" />
                <input value={editMemberTel} onChange={(e) => { setEditMemberTel(e.target.value); setEditMemberError(''); }} required className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono" placeholder="Téléphone (8 chiffres)" />
                <select value={editMemberZone} onChange={(e) => setEditMemberZone(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-medium">
                  {zones.map(z => <option key={z.id} value={z.nom}>{z.nom}</option>)}
                </select>
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteMember(editingMember.id)) setEditingMember(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500 hover:text-white transition cursor-pointer"
                  >
                    Supprimer
                  </button>
                  <button type="submit" className="px-5 py-2.5 rounded-xl bg-lapis text-white text-xs font-bold cursor-pointer">
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showCreateProject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setShowCreateProject(false)} className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95, y: 16}} animate={{opacity:1, scale:1, y: 0}} exit={{opacity:0, scale:0.95, y: 16}} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-5 border hairline">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold">Nouveau Projet Coffre-fort</h2>
                <button type="button" onClick={() => setShowCreateProject(false)} className="p-1.5 text-slate-400 cursor-pointer"><X size={18} /></button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as any;
                  const dureeMois = Number(form.duree.value) || 6;
                  onCreateInvestment({
                    titre: form.titre.value,
                    description: form.description.value,
                    montant_cible: Number(form.cible.value) || 500000,
                    participation_min: Number(form.minPart.value) || 10000,
                    date_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    date_echeance: new Date(Date.now() + dureeMois * 30 * 86400000).toISOString().slice(0, 10),
                    profit_estime_pct: Number(form.profitPct.value) || 15,
                    status: 'ouvert',
                    createur: currentUser.nom,
                  });
                  setShowCreateProject(false);
                }}
                className="space-y-4"
              >
                <input name="titre" required placeholder="Titre du projet (ex: Magasin Céréales Dosso)" className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-medium" />
                <textarea name="description" required rows={3} placeholder="Description et impact communautaire..." className="w-full p-4 rounded-xl bg-paper dark:bg-slate-800 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="cible" type="number" required defaultValue={1000000} placeholder="Montant cible (F)" className="h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono tabular-nums" />
                  <input name="minPart" type="number" required defaultValue={25000} placeholder="Ticket min (F)" className="h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono tabular-nums" />
                  <input name="duree" type="number" required defaultValue={6} placeholder="Durée (mois)" className="h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono tabular-nums" />
                  <input name="profitPct" type="number" required defaultValue={15} placeholder="Profit estimé (%)" className="h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono tabular-nums" />
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl bg-gold text-white text-sm font-bold cursor-pointer">
                  Ouvrir aux participations
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {profitProjectTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setProfitProjectTarget(null)} className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95, y: 16}} animate={{opacity:1, scale:1, y: 0}} exit={{opacity:0, scale:0.95, y: 16}} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-5 border hairline">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold">Distribuer les bénéfices</h2>
                <button type="button" onClick={() => setProfitProjectTarget(null)} className="p-1.5 text-slate-400 cursor-pointer"><X size={18} /></button>
              </div>
              <p className="text-xs text-slate-500">
                Projet : <strong>{profitProjectTarget.titre}</strong> ({profitProjectTarget.nb_participants} participants, {profitProjectTarget.montant_actuel.toLocaleString()} F investis)
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amt = Number(profitAmountInput);
                  if (!amt || amt <= 0) return;
                  onDistributeProfit(profitProjectTarget.id, amt);
                  setProfitProjectTarget(null);
                }}
                className="space-y-4"
              >
                <input
                  type="number"
                  min="100"
                  required
                  value={profitAmountInput}
                  onChange={(e) => setProfitAmountInput(e.target.value)}
                  placeholder="Bénéfice net total à distribuer (F CFA)"
                  className="w-full h-11 px-4 rounded-xl bg-paper dark:bg-slate-800 text-sm font-mono tabular-nums"
                />
                <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
                  Clôturer et créditer les adhérents
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showQRScanner && (
          <QRScanner
            title={qrScanMode === 'receipt' ? 'Vérifier un Reçu QR' : 'Scanner QR Code'}
            subtitle={
              qrScanMode === 'receipt'
                ? 'Scannez un reçu imprimé ou PDF pour afficher la transaction'
                : 'Carte adhérent (check-in) ou Reçu QR de transaction'
            }
            helperText={
              qrScanMode === 'receipt'
                ? 'Placez le code QR du reçu dans le cadre ou saisissez sa référence (REC-DOSSO-...) pour ouvrir le reçu officiel.'
                : 'Scannez une carte membre pour préparer un versement ou un reçu QR pour consulter ses détails.'
            }
            manualPlaceholder={
              qrScanMode === 'receipt'
                ? 'Ex: REC-DOSSO-2026-0042 ou PMES|...'
                : 'Ex: PMES-2026-1042 ou REC-DOSSO-2026-0042'
            }
            onScan={handleQRScan}
            errorMessage={qrScanError}
            onClose={() => {
              setShowQRScanner(false);
              setQrScanError('');
            }}
          />
        )}

        {showOfflineModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOfflineModal(false)}
              className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border hairline p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-4 border-b hairline pb-4">
                <div>
                  <h2 className="text-xl font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
                    <HardDrive size={20} className="text-lapis" />
                    Cache Hors-Ligne & File IndexedDB
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {isOnline ? 'Connexion active' : 'Hors-ligne — Consultation & saisie depuis IndexedDB'}
                    {' · '}
                    Dernier snapshot :{' '}
                    {offlineStats?.lastCachedAt
                      ? new Date(offlineStats.lastCachedAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'En cours'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOfflineModal(false)}
                  className="p-2 rounded-xl hover:bg-paper dark:hover:bg-slate-800 text-slate-400 hover:text-charcoal dark:hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Résumé des enregistrements en cache IndexedDB */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-paper dark:bg-slate-800/60 border hairline">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adhérents cache</div>
                  <div className="text-2xl font-display font-bold tabular mt-1">{offlineStats?.cachedMembersCount ?? members.length}</div>
                  <div className="text-[11px] text-amber-500 font-semibold mt-0.5 tabular">
                    {pendingMembersList.length} en attente
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-paper dark:bg-slate-800/60 border hairline">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transactions</div>
                  <div className="text-2xl font-display font-bold tabular mt-1">{offlineStats?.cachedTransactionsCount ?? transactions.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Persistées IDB</div>
                </div>
                <div className="p-4 rounded-2xl bg-paper dark:bg-slate-800/60 border hairline">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Demandes en attente</div>
                  <div className="text-2xl font-display font-bold tabular mt-1">{retraitsEnAttente + financementsEnAttente}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 tabular">
                    {retraitsEnAttente} ret. · {financementsEnAttente} fin.
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-paper dark:bg-slate-800/60 border hairline">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">File à synchro</div>
                  <div className="text-2xl font-display font-bold tabular mt-1 text-lapis">{pendingSyncItemsCount}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 tabular">
                    {offlineStats?.failedOpsCount ? `${offlineStats.failedOpsCount} échec(s)` : 'Prêt pour sync'}
                  </div>
                </div>
              </div>

              {/* Actions Cache & Sync */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRefreshOfflineCache()}
                    className="px-3.5 py-2 rounded-xl bg-paper dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border hairline hover:border-lapis/40 transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Database size={14} /> Actualiser cache
                  </button>
                  {syncedQueueItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onClearSyncedOfflineOps()}
                      className="px-3.5 py-2 rounded-xl bg-paper dark:bg-slate-800 text-slate-500 text-xs font-bold flex items-center gap-1.5 border hairline hover:text-rose-500 transition whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Trash2 size={14} /> Purger synchronisés ({syncedQueueItemsCount})
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!isOnline || isFlushingQueue || pendingSyncItemsCount === 0}
                  onClick={async () => {
                    setIsFlushingQueue(true);
                    try {
                      await onFlushOfflineQueue();
                    } finally {
                      setIsFlushingQueue(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-lapis text-white text-xs font-bold flex items-center gap-2 hover:bg-lapis/90 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isFlushingQueue ? 'animate-spin' : ''} />
                  Synchroniser maintenant
                </button>
              </div>

              {/* Dossiers en attente en cache */}
              {(pendingMembersList.length > 0 || retraitsEnAttente > 0 || financementsEnAttente > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Dossiers en attente consultables hors-ligne
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      {retraitsEnAttente > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('retraits');
                            setShowOfflineModal(false);
                          }}
                          className="text-lapis font-bold hover:underline cursor-pointer"
                        >
                          Retraits ({retraitsEnAttente})
                        </button>
                      )}
                      {financementsEnAttente > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('financements');
                            setShowOfflineModal(false);
                          }}
                          className="text-lapis font-bold hover:underline cursor-pointer"
                        >
                          Financements ({financementsEnAttente})
                        </button>
                      )}
                    </div>
                  </div>
                  {pendingMembersList.length > 0 && (
                    <div className="divide-y hairline border hairline rounded-2xl overflow-hidden">
                      {pendingMembersList.slice(0, 6).map((pm) => (
                        <div key={pm.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-charcoal dark:text-white truncate">{pm.nom}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {pm.livret} · {pm.zone} · {pm.telephone}
                            </div>
                          </div>
                          {(isAdmin || isTresorier) && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onValidateMember(pm.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[11px] hover:bg-emerald-600 transition cursor-pointer"
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectMember(pm.id)}
                                className="px-2.5 py-1 rounded-lg bg-paper dark:bg-slate-800 text-slate-500 font-bold text-[11px] border hairline hover:text-rose-500 transition cursor-pointer"
                              >
                                Rejeter
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* File des mutations hors-ligne */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  File de synchronisation IndexedDB ({offlineQueue.length})
                </h3>
                {offlineQueue.length === 0 ? (
                  <div className="p-6 rounded-2xl border hairline text-center text-xs text-slate-400">
                    Aucune opération en attente dans la file IndexedDB.
                  </div>
                ) : (
                  <div className="divide-y hairline border hairline rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    {offlineQueue.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-charcoal dark:text-white truncate">{item.actionLabel}</div>
                          <div className="text-[11px] text-slate-500 truncate">{item.summary}</div>
                          {item.lastError && (
                            <div className="text-[10px] text-rose-500 truncate mt-0.5">{item.lastError}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.status === 'synced'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : item.status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {item.status === 'synced'
                              ? 'Synchronisé'
                              : item.status === 'failed'
                                ? 'Échec'
                                : 'En attente'}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono tabular">
                            {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showLauncher && (
          <div className="fixed inset-0 z-[100] flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLauncher(false)}
              className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r hairline p-6 space-y-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b hairline pb-4">
                <div>
                  <div className="text-sm font-bold text-charcoal dark:text-white">{currentUser.nom}</div>
                  <div className="text-xs text-slate-500">{currentUser.role} · {currentUser.zone}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLauncher(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-charcoal dark:hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems
                  .filter(item => !item.roles || item.roles.includes(currentUser.role))
                  .map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setShowLauncher(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        activeTab === item.id
                          ? 'bg-lapis text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-paper dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon size={17} />
                        <span>{item.label}</span>
                      </span>
                      {(item.badge ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-gold text-white text-[10px] font-bold tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const KPICard = ({ title, value, sub, icon: Icon, color, isCurrency, onClick }: any) => {
  const colors: any = { lapis: 'bg-lapis text-white', gold: 'bg-gold text-white', emerald: 'bg-emerald-500 text-white', rose: 'bg-rose-500 text-white', slate: 'bg-white dark:bg-slate-900 hairline shadow-sm' };
  return (
    <div onClick={onClick} className={`p-8 rounded-[2.5rem] ${colors[color] || colors.slate} group hover:shadow-xl hover:translate-y-[-4px] transition-all cursor-pointer`}>
      <div className={`w-12 h-12 rounded-2xl ${color === 'slate' ? 'bg-paper dark:bg-slate-800 text-lapis' : 'bg-white/20 text-white'} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}><Icon size={20} /></div>
      <div className="mt-6">
        <div className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${color === 'slate' ? 'text-slate-400' : 'opacity-70'}`}>{title}</div>
        <div className="text-3xl font-display font-bold tabular leading-tight">{value.toLocaleString()}{isCurrency && <span className="text-sm font-normal opacity-70 ml-1">F</span>}</div>
        <div className={`text-xs font-semibold mt-3 ${color === 'slate' ? 'text-emerald-500' : 'opacity-80'}`}>{sub}</div>
      </div>
    </div>
  );
};

const ProgressStat = ({ label, val, total, color }: any) => {
  const pct = total > 0 ? Math.min(100, Math.round((val / total) * 100)) : 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.1em]"><span className="opacity-60">{label}</span><span className="opacity-100 tabular">{pct}%</span></div>
      <div className="w-full h-1.5 bg-white/10 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
};
