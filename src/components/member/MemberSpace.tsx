import React, { useState, useEffect } from 'react';
import { Member, Transaction, DemandeRetrait, DemandeFinancement, ReceiptData, FinancementType, InvestissementProjet } from '../../types';
import { APP_LOGO } from '../../data/initialData';
import { 
  Wallet, ArrowDownRight, ArrowUpRight, Clock, FileText, FileDown,
  CreditCard, Calculator, CheckCircle2, AlertCircle, Eye, 
  EyeOff, Shield, RefreshCw, Printer, LogOut, ChevronRight,
  Camera, Upload, User, Target, Flag, TrendingUp, Landmark, ShieldCheck, X, QrCode, Calendar, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageFile } from '../../utils/imageUtils';
import { downloadReceiptPDF } from '../../utils/receiptPdfUtils';
import { decodeReceiptQRPayload } from '../../utils/qrUtils';
import { QRScanner } from '../common/QRScanner';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import { MemberMonthlySavingsChart } from './MemberMonthlySavingsChart';
import { MemberSavingsHeatmap } from './MemberSavingsHeatmap';
import { GoalProgressRing } from './GoalProgressRing';

function getMemberTxMeta(type: Transaction['type']) {
  switch (type) {
    case 'depot':
      return { label: 'Dépôt / Versement', sign: '+', positive: true };
    case 'financement':
      return { label: 'Crédit AGR reçu', sign: '+', positive: true };
    case 'remboursement':
      return { label: 'Remboursement crédit', sign: '-', positive: false };
    case 'investissement':
      return { label: 'Investissement coffre', sign: '-', positive: false };
    case 'adhesion':
      return { label: 'Frais adhésion', sign: '-', positive: false };
    case 'frais':
      return { label: 'Frais de dossier', sign: '-', positive: false };
    case 'retrait':
    default:
      return { label: 'Retrait', sign: '-', positive: false };
  }
}

function formatDateOnlyFR(dateStr?: string): string {
  if (!dateStr) return '---';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('fr-FR');
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? '---' : parsed.toLocaleDateString('fr-FR');
}

function formatSafeDate(dateStr?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '---';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '---';
  return options ? parsed.toLocaleDateString('fr-FR', options) : parsed.toLocaleString('fr-FR');
}

interface MemberSpaceProps {
  member: Member;
  transactions: Transaction[];
  demandesRetrait: DemandeRetrait[];
  demandesFinancement: DemandeFinancement[];
  onDemandeRetrait: (montant: number, motif: string) => void;
  onDemandeFinancement: (
    montant: number, 
    dureeMois: number, 
    motif: string, 
    financementType: FinancementType,
    frequence: 'hebdomadaire' | 'mensuel',
    margeOuProfit?: number
  ) => void;
  onUpdatePin: (currentPin: string, newPin: string) => Promise<boolean> | boolean;
  onUpdatePhoto?: (memberId: string, photoSource: string | File) => Promise<string | void> | void;
  onUpdateMember?: (memberId: string, updates: Partial<Member>) => void;
  onOpenReceipt: (receipt: ReceiptData) => void;
  onOpenCard: () => void;
  investissements: InvestissementProjet[];
  participations: import('../../types').InvestissementParticipation[];
  onJoinInvestment: (projetId: string, montant: number) => void;
  onLogout: () => void;
}

export const MemberSpace: React.FC<MemberSpaceProps> = ({
  member,
  transactions,
  demandesRetrait,
  demandesFinancement,
  onDemandeRetrait,
  onDemandeFinancement,
  onUpdatePin,
  onUpdatePhoto,
  onUpdateMember,
  onOpenReceipt,
  onOpenCard,
  investissements,
  participations,
  onJoinInvestment,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'accueil' | 'retrait' | 'financement' | 'investissements' | 'historique' | 'objectif' | 'profil'>('accueil');

  // Forms state
  const [retraitMontant, setRetraitMontant] = useState('');
  const [retraitMotif, setRetraitMotif] = useState('');
  const [retraitError, setRetraitError] = useState('');

  const [fType, setFType] = useState<FinancementType>('qard_al_hassane');
  const [fMontant, setFMontant] = useState('200000');
  const [fDuree, setFDuree] = useState('6');
  const [fFrequence, setFFrequence] = useState<'mensuel' | 'hebdomadaire'>('mensuel');
  const [fMotif, setFMotif] = useState('');
  const [fMargePct] = useState('5');
  const [fProfitPct] = useState('20');
  const [financeError, setFinanceError] = useState('');

  const [goalMontant, setGoalMontant] = useState(String(member.objectif_montant || ''));
  const [goalDate, setGoalDate] = useState(member.objectif_date || '');
  const [goalLabel, setGoalLabel] = useState(member.objectif_label || '');
  const [goalError, setGoalError] = useState('');

  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const [investTargetProjet, setInvestTargetProjet] = useState<InvestissementProjet | null>(null);
  const [investAmountInput, setInvestAmountInput] = useState('');
  const [investError, setInvestError] = useState('');
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [receiptScanError, setReceiptScanError] = useState('');

  useEffect(() => {
    setGoalMontant(String(member.objectif_montant || ''));
    setGoalDate(member.objectif_date || '');
    setGoalLabel(member.objectif_label || '');
  }, [member.id, member.objectif_montant, member.objectif_date, member.objectif_label]);

  const memberTxs = transactions.filter(t => t.member_id === member.id);
  const memberRetraits = demandesRetrait.filter(d => d.member_id === member.id);
  const memberFinancements = demandesFinancement.filter(f => f.member_id === member.id);

  const handleReceiptQRScan = (decodedText: string) => {
    const receipt = decodeReceiptQRPayload(decodedText, memberTxs, [member]);
    if (receipt) {
      setReceiptScanError('');
      setShowReceiptScanner(false);
      onOpenReceipt(receipt);
    } else {
      setReceiptScanError(
        'Reçu introuvable dans votre historique personnel. Vérifiez que ce QR code correspond à l’une de vos opérations.'
      );
    }
  };

  // Stats
  const simAmount = Math.max(0, parseInt(fMontant) || 0);
  const simMonths = Math.max(1, parseInt(fDuree) || 1);
  let extraFinancement = 0;
  if (fType === 'mourabaha') {
    extraFinancement = Math.round(simAmount * ((parseFloat(fMargePct) || 0) / 100));
  }
  const totalRembourser = simAmount + extraFinancement;
  const nbEcheances = fFrequence === 'hebdomadaire' ? simMonths * 4 : simMonths;
  const montantParEcheance = nbEcheances > 0 ? Math.round(totalRembourser / nbEcheances) : 0;

  // Chart Data
  const sortedTxs = [...memberTxs]
    .filter(tx => typeof tx.solde_apres === 'number' && !Number.isNaN(new Date(tx.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const chartData = sortedTxs.map(tx => ({
    date: new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    solde: tx.solde_apres as number,
  }));
  if (sortedTxs.length > 0) {
    chartData.unshift({ date: 'Début', solde: sortedTxs[0].solde_avant ?? 0 });
  } else {
    chartData.push({ date: "Aujourd'hui", solde: member.solde });
  }

  const handleRetraitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(retraitMontant);
    if (isNaN(amount) || amount <= 0 || amount > member.solde || !retraitMotif.trim()) {
      setRetraitError('Montant ou motif invalide');
      return;
    }
    onDemandeRetrait(amount, retraitMotif.trim());
    setRetraitMontant('');
    setRetraitMotif('');
    setRetraitError('');
  };

  const handleFinanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(fMontant);
    if (isNaN(amount) || amount <= 0) {
      setFinanceError('Veuillez saisir un montant de financement valide.');
      return;
    }
    if (!fMotif.trim()) {
      setFinanceError('Veuillez décrire le projet à financer.');
      return;
    }
    const duree = Math.max(1, parseInt(fDuree, 10) || 6);
    const margeOuProfit = fType === 'mourabaha' ? extraFinancement : (fType === 'moudaraba' ? (parseFloat(fProfitPct) || 20) : 0);
    onDemandeFinancement(amount, duree, fMotif.trim(), fType, fFrequence, margeOuProfit);
    setFMotif('');
    setFinanceError('');
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cible = parseFloat(goalMontant);
    if (isNaN(cible) || cible < 1000) {
      setGoalError('Veuillez saisir un montant cible valide (minimum 1 000 F CFA).');
      return;
    }
    if (!goalLabel.trim()) {
      setGoalError('Veuillez préciser le libellé de votre projet.');
      return;
    }
    setGoalError('');
    onUpdateMember?.(member.id, {
      objectif_montant: cible,
      objectif_date: goalDate,
      objectif_label: goalLabel.trim(),
    });
    setActiveTab('accueil');
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage('');
    if (!/^\d{4}$/.test(currentPinInput)) {
      setPinMessage('Veuillez saisir votre code PIN actuel à 4 chiffres.');
      return;
    }
    if (!/^\d{4}$/.test(newPinInput)) {
      setPinMessage('Le nouveau code PIN doit comporter exactement 4 chiffres.');
      return;
    }
    setIsUpdatingPin(true);
    try {
      const ok = await onUpdatePin(currentPinInput, newPinInput);
      if (ok) {
        setPinMessage('Code PIN mis à jour avec succès ✅');
        setCurrentPinInput('');
        setNewPinInput('');
      } else {
        setPinMessage('Code PIN actuel incorrect.');
      }
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const navItems = [
    { id: 'accueil', label: 'Vue d\'ensemble', icon:TrendingUp },
    { id: 'retrait', label: 'Retrait', icon: ArrowDownRight },
    { id: 'financement', label: 'Crédit AGR', icon: Calculator },
    { id: 'investissements', label: 'Coffre', icon: Landmark },
    { id: 'historique', label: 'Historique', icon: Clock },
    { id: 'objectif', label: 'Objectif', icon: Target },
    { id: 'profil', label: 'Profil', icon: User },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 grid lg:grid-cols-[280px_1fr] gap-10">
      {/* SIDEBAR NAVIGATION */}
      <aside className="space-y-8">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative group">
              <div className="w-20 h-24 rounded-2xl overflow-hidden border-2 border-gold/20 bg-paper dark:bg-slate-800">
                {member.photo ? (
                  <img src={member.photo} alt={member.nom} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User size={32} />
                  </div>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-2 bg-gold text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                <Camera size={14} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const b64 = await compressImageFile(file, 600, 600, 0.85);
                      await onUpdatePhoto?.(member.id, b64);
                    }
                    e.target.value = '';
                  }} 
                />
              </label>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-charcoal dark:text-white leading-tight">{member.nom}</h2>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                {member.corporationNom} · {member.livret}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Solde Épargne</div>
              <div className="text-2xl font-display font-bold text-lapis dark:text-blue-400 tabular-nums">
                {member.solde.toLocaleString()} <span className="text-xs text-slate-400">F CFA</span>
              </div>
            </div>

            {/* Compact Objective Progress Indicator */}
            {member.objectif_montant && member.objectif_montant > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('objectif')}
                className="w-full p-3 rounded-xl bg-paper dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 hover:border-gold/40 transition-colors text-left flex items-center gap-3 cursor-pointer"
                title="Modifier mon objectif d'épargne"
              >
                <GoalProgressRing
                  current={member.solde}
                  target={member.objectif_montant}
                  size={48}
                  strokeWidth={5}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-charcoal dark:text-white truncate">
                      {member.objectif_label || 'Objectif'}
                    </span>
                    <Target size={11} className="text-gold shrink-0" />
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        member.solde >= member.objectif_montant ? 'bg-emerald-500' : 'bg-gold'
                      }`}
                      style={{ width: `${Math.min(100, (member.solde / member.objectif_montant) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    {member.solde >= member.objectif_montant
                      ? 'Objectif atteint'
                      : `Cible : ${member.objectif_montant.toLocaleString()} F`}
                  </div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('objectif')}
                className="w-full px-3 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 hover:border-gold text-[11px] font-semibold text-slate-500 hover:text-gold transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Target size={13} className="text-gold" />
                  Définir un objectif
                </span>
                <ChevronRight size={13} />
              </button>
            )}

            <button 
              type="button"
              onClick={onOpenCard}
              className="w-full mt-2 py-2.5 bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-charcoal dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <CreditCard size={14} className="text-gold" />
              Ma Carte de Membre
            </button>
            <button
              type="button"
              onClick={() => {
                setReceiptScanError('');
                setShowReceiptScanner(true);
              }}
              className="w-full py-2.5 bg-lapis/10 dark:bg-lapis/20 border border-lapis/20 rounded-xl text-xs font-bold text-lapis dark:text-blue-300 hover:bg-lapis hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <QrCode size={14} />
              Scanner un Reçu QR
            </button>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === item.id 
                  ? 'bg-lapis text-white shadow-md shadow-lapis/10' 
                  : 'text-slate-500 hover:bg-white dark:hover:bg-slate-900 hover:text-charcoal dark:hover:text-white'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-slate-400'} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'accueil' && (
            <motion.div 
              key="accueil"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Vue d'ensemble</h1>
                  <p className="text-slate-500 text-sm mt-1">Gérez votre épargne et suivez vos projets en temps réel.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Clock size={14} />
                  Dernière synchro : {new Date().toLocaleTimeString()}
                </div>
              </div>

              {/* Chart & Stats Grid */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-display font-bold text-charcoal dark:text-white">Historique de Solde</h3>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1 text-emerald-500">
                        <ArrowDownRight size={12} />
                        Croissance
                      </span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="memberSolde" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8'}} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          fontSize={10}
                          tick={{ fill: '#94a3b8' }}
                          width={46}
                          tickFormatter={(v) => {
                            const n = Number(v) || 0;
                            if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                            if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
                            return `${n}`;
                          }}
                        />
                        <Tooltip 
                          formatter={(value: any) => [`${Number(value || 0).toLocaleString('fr-FR')} F CFA`, 'Solde']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Area type="monotone" dataKey="solde" stroke="#1E3A8A" strokeWidth={3} fillOpacity={1} fill="url(#memberSolde)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Goal Progress */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
                        <Target size={18} className="text-gold" />
                        Objectif d&apos;Épargne
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('objectif')}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-lapis dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <Pencil size={12} />
                        {member.objectif_montant ? 'Modifier' : 'Définir'}
                      </button>
                    </div>
                    {member.objectif_montant && member.objectif_montant > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <GoalProgressRing
                            current={member.solde}
                            target={member.objectif_montant}
                            size={72}
                            strokeWidth={7}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="text-sm font-bold text-charcoal dark:text-white truncate">
                              {member.objectif_label || 'Épargne personnelle'}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              <span className="font-bold text-charcoal dark:text-slate-200">
                                {member.solde.toLocaleString()} F
                              </span>{' '}
                              / {member.objectif_montant.toLocaleString()} F
                            </div>
                            {member.objectif_date && (
                              <div className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium tabular-nums">
                                <Calendar size={11} />
                                Échéance : {formatDateOnlyFR(member.objectif_date)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                member.solde >= member.objectif_montant ? 'bg-emerald-500' : 'bg-gold'
                              }`}
                              style={{ width: `${Math.min(100, (member.solde / member.objectif_montant) * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {member.solde >= member.objectif_montant ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Objectif atteint ! Surplus de {(member.solde - member.objectif_montant).toLocaleString()} F CFA.
                            </span>
                          ) : (
                            <>
                              Il vous reste{' '}
                              <span className="font-bold text-charcoal dark:text-slate-200 tabular-nums">
                                {(member.objectif_montant - member.solde).toLocaleString()} F CFA
                              </span>{' '}
                              à épargner pour atteindre votre cible.
                            </>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-4">
                        <p className="text-xs text-slate-400">Définissez un objectif d&apos;épargne pour suivre visuellement votre progression.</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('objectif')}
                          className="px-4 py-2 rounded-xl bg-gold/10 text-gold text-xs font-bold hover:bg-gold hover:text-white transition-colors cursor-pointer"
                        >
                          Définir maintenant
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status Card */}
                  <div className="p-6 rounded-2xl bg-lapis text-white space-y-4 shadow-xl shadow-lapis/20">
                    <ShieldCheck size={24} className="text-gold" />
                    <div>
                      <h3 className="font-display font-bold">Compte Sécurisé</h3>
                      <p className="text-xs text-blue-200/80 mt-1 leading-relaxed">
                        Vos fonds sont protégés par le Programme Municipal de Dosso. Toutes les transactions sont auditées.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Savings Contributions Activity Graph */}
              <MemberMonthlySavingsChart transactions={memberTxs} />

              {/* Daily Savings Consistency Calendar Heatmap (Past Year) */}
              <MemberSavingsHeatmap transactions={memberTxs} />

              {/* Recent Activity Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-bold text-charcoal dark:text-white">Transactions Récentes</h3>
                  <button type="button" onClick={() => setActiveTab('historique')} className="text-xs font-bold text-gold hover:underline cursor-pointer">Voir tout</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] text-slate-400 uppercase tracking-widest font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="pb-4">Type</th>
                        <th className="pb-4">Date</th>
                        <th className="pb-4">Référence</th>
                        <th className="pb-4 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {memberTxs.slice(0, 5).map(tx => {
                        const meta = getMemberTxMeta(tx.type);
                        return (
                        <tr 
                          key={tx.id} 
                          className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => onOpenReceipt({
                            transactionId: tx.id,
                            type: tx.type,
                            reference: tx.reference || 'REF',
                            date: tx.date,
                            memberNom: member.nom,
                            memberLivret: member.livret,
                            memberTelephone: member.telephone,
                            zone: tx.zone || member.zone,
                            montant: tx.montant,
                            soldeAvant: tx.solde_avant,
                            soldeApres: tx.solde_apres,
                            agentNom: tx.agent,
                            motif: tx.description,
                          })}
                        >
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${meta.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {meta.positive ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                              </div>
                              <span className="font-semibold">{meta.label}</span>
                            </div>
                          </td>
                          <td className="py-4 text-slate-500 font-mono text-[11px]">
                            {formatSafeDate(tx.date, { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-4 text-slate-400 text-xs">{tx.reference || 'N/A'}</td>
                          <td className="py-4 text-right">
                            <span className={`font-bold tabular ${meta.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {meta.sign}{tx.montant.toLocaleString()} F
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                      {memberTxs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 italic">Aucune transaction</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'retrait' && (
            <motion.div 
              key="retrait"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Demander un Retrait</h1>
                <p className="text-slate-500 text-sm">Récupérez vos fonds en toute simplicité après validation.</p>
              </div>

              <form onSubmit={handleRetraitSubmit} className="p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-xl space-y-6">
                <div className="p-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">Solde disponible</span>
                  <span className="text-xl font-display font-bold text-gold tabular">{member.solde.toLocaleString()} F CFA</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Montant (F CFA)</label>
                  <input 
                    type="number"
                    value={retraitMontant}
                    onChange={e => setRetraitMontant(e.target.value)}
                    className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-display font-bold text-2xl text-charcoal dark:text-white focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none transition-all tabular"
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Motif du retrait</label>
                  <textarea 
                    value={retraitMotif}
                    onChange={e => setRetraitMotif(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm text-charcoal dark:text-white focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none transition-all resize-none"
                    placeholder="Pourquoi avez-vous besoin de ce retrait ?"
                    rows={3}
                    required
                  />
                </div>

                {retraitError && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
                    <AlertCircle size={16} />
                    {retraitError}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-4 bg-gold hover:bg-gold/90 text-white rounded-2xl font-display font-bold shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
                >
                  Soumettre la demande
                </button>
              </form>

              {/* History of requests */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Demandes en cours</h3>
                <div className="space-y-3">
                  {memberRetraits.map(dr => (
                    <div key={dr.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 hairline flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2.5 rounded-full shrink-0 ${
                          dr.status === 'valide'
                            ? 'bg-emerald-50 text-emerald-600'
                            : dr.status === 'rejete'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-amber-50 text-amber-600'
                        }`}>
                          <Clock size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-charcoal dark:text-white">{dr.montant.toLocaleString()} F</div>
                          <div className="text-xs text-slate-400 truncate">{formatSafeDate(dr.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} · {dr.motif}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${
                        dr.status === 'valide'
                          ? 'text-emerald-500'
                          : dr.status === 'rejete'
                            ? 'text-rose-500'
                            : 'text-amber-500'
                      }`}>
                        {dr.status === 'valide' ? 'Approuvé' : dr.status === 'rejete' ? 'Rejeté' : 'En attente'}
                      </span>
                    </div>
                  ))}
                  {memberRetraits.length === 0 && (
                    <div className="text-center py-10 text-slate-400 italic text-sm">Aucune demande en cours</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'financement' && (
            <motion.div 
              key="financement"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Financement AGR</h1>
                <p className="text-slate-500 text-sm">Micro-crédit participatif sans usure pour vos projets économiques.</p>
              </div>

              {member.solde < 50000 ? (
                <div className="p-12 rounded-[2rem] bg-white dark:bg-slate-900 hairline text-center space-y-6 shadow-xl">
                  <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                    <Shield size={32} />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-charcoal dark:text-white">Éligibilité Insuffisante</h2>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Vous devez disposer d'un solde d'épargne d'au moins <span className="font-bold text-gold">50 000 F CFA</span> pour pouvoir prétendre à un financement.
                  </p>
                  <div className="flex justify-center">
                    <div className="w-64 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, Math.max(0, (member.solde / 50000) * 100))}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {/* Form */}
                  <form onSubmit={handleFinanceSubmit} className="p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-xl space-y-6">
                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Type de Financement</label>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: 'qard_al_hassane', label: 'Qard Al Hassane', desc: 'Prêt d\'honneur solidaire (0%)', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                          { id: 'mourabaha', label: 'Mourabaha', desc: 'Achat et revente à tempérament', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                          { id: 'moudaraba', label: 'Moudaraba', desc: 'Investissement en partenariat', color: 'bg-blue-50 text-blue-600 border-blue-100' }
                        ].map(type => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setFType(type.id as any)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              fType === type.id 
                                ? `${type.color} ring-2 ring-current ring-offset-2 dark:ring-offset-slate-900` 
                                : 'bg-paper dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
                            }`}
                          >
                            <div className="font-bold text-sm">{type.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{type.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Montant souhaité</label>
                      <input 
                        type="number" 
                        value={fMontant}
                        onChange={e => { setFMontant(e.target.value); setFinanceError(''); }}
                        className="w-full h-12 px-5 rounded-xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-display font-bold text-xl tabular outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Durée (Mois)</label>
                        <select 
                          value={fDuree}
                          onChange={e => setFDuree(e.target.value)}
                          className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none"
                        >
                          {[3, 6, 9, 12].map(m => <option key={m} value={m}>{m} mois</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Périodicité</label>
                        <select 
                          value={fFrequence}
                          onChange={e => setFFrequence(e.target.value as any)}
                          className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none"
                        >
                          <option value="mensuel">Mensuel</option>
                          <option value="hebdomadaire">Hebdo</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Projet à financer</label>
                      <input 
                        type="text" 
                        value={fMotif}
                        onChange={e => { setFMotif(e.target.value); setFinanceError(''); }}
                        placeholder="Ex: Achat de bétail pour embouche"
                        className="w-full h-12 px-5 rounded-xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none"
                        required
                      />
                    </div>

                    {financeError && (
                      <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
                        <AlertCircle size={16} />
                        {financeError}
                      </div>
                    )}

                    <button type="submit" className="w-full py-4 bg-lapis text-white rounded-2xl font-display font-bold shadow-lg shadow-lapis/20 transition-all active:scale-[0.98] cursor-pointer">
                      Soumettre le dossier
                    </button>
                  </form>

                  {/* Simulator Details */}
                  <div className="p-8 rounded-3xl bg-paper dark:bg-slate-900 hairline space-y-8 sticky top-28">
                    <h3 className="font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
                      <Calculator size={18} className="text-lapis" />
                      Simulation du remboursement
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-sm text-slate-500">Montant Principal</span>
                        <span className="font-bold tabular">{simAmount.toLocaleString()} F</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-sm text-slate-500">Type</span>
                        <span className="font-bold text-lapis uppercase text-xs">{fType.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-sm text-slate-500">Profit / Marge</span>
                        <span className="font-bold text-emerald-500 tabular">{extraFinancement.toLocaleString()} F</span>
                      </div>
                      <div className="flex justify-between items-center py-6">
                        <span className="font-display font-bold">Total à rembourser</span>
                        <span className="text-2xl font-display font-bold text-charcoal dark:text-white tabular">{totalRembourser.toLocaleString()} F</span>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 hairline text-center">
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Traite {fFrequence}</div>
                      <div className="text-3xl font-display font-bold text-gold tabular">{montantParEcheance.toLocaleString()} F</div>
                      <div className="text-[11px] text-slate-500 mt-2">Pendant {nbEcheances} {fFrequence === 'hebdomadaire' ? 'semaines' : 'mois'}</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'investissements' && (
            <motion.div 
              key="investissements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Le Coffre à Projets</h1>
                  <p className="text-slate-500 text-sm mt-1">Investissez dans des projets communautaires et partagez les bénéfices.</p>
                </div>
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-900/40">
                  {participations.filter(p => p.member_id === member.id && p.status === 'actif').length} Investissements Actifs
                </div>
              </div>

              {investissements.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 hairline text-center text-sm text-slate-400 italic">
                  Aucun projet d&apos;investissement disponible pour le moment.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {investissements.map(projet => {
                    const myPart = participations.find(p => p.projet_id === projet.id && p.member_id === member.id);
                    const rawProgress = projet.montant_cible > 0 ? (projet.montant_actuel / projet.montant_cible) * 100 : 0;
                    const progress = Math.min(100, Math.max(0, rawProgress));
                    
                    return (
                      <div key={projet.id} className="p-6 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 flex flex-col group hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h3 className="font-display font-bold text-charcoal dark:text-white group-hover:text-gold transition-colors">{projet.titre}</h3>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Investissement Communautaire</div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            projet.status === 'ouvert' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {projet.status === 'ouvert' ? 'Ouvert' : projet.status === 'cloture' ? 'Clôturé' : 'Fermé'}
                          </span>
                        </div>

                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{projet.description}</p>

                        <div className="space-y-2 mt-auto">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-400">{Math.round(progress)}% récolté</span>
                            <span className="text-charcoal dark:text-slate-200 tabular">{projet.montant_actuel.toLocaleString()} / {projet.montant_cible.toLocaleString()} F</span>
                          </div>
                          <div className="w-full h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-lapis transition-all duration-1000" style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        {myPart ? (
                          <div className="p-4 rounded-xl bg-lapis text-white flex justify-between items-center">
                            <div className="space-y-0.5">
                              <div className="text-[10px] uppercase tracking-widest opacity-70">Votre part</div>
                              <div className="font-display font-bold tabular">{myPart.montant.toLocaleString()} F</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-widest opacity-70">Gain estimé</div>
                              <div className="font-display font-bold text-gold tabular">~{Math.round(myPart.montant * ((projet.profit_estime_pct || 0) / 100)).toLocaleString()} F</div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                setInvestError('');
                                setInvestAmountInput(String(projet.participation_min || 10000));
                                setInvestTargetProjet(projet);
                              }}
                              disabled={projet.status !== 'ouvert' || member.solde < 50000}
                              className="w-full py-3 bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold text-charcoal dark:text-slate-200 hover:bg-gold hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Investir maintenant
                            </button>
                            {member.solde < 50000 && (
                              <p className="text-[11px] text-slate-400 text-center">
                                Solde minimum requis : 50 000 F CFA
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {investTargetProjet && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <div
                    onClick={() => setInvestTargetProjet(null)}
                    className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm"
                  />
                  <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border hairline p-8 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-display font-bold text-charcoal dark:text-white">
                          Participer au projet
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{investTargetProjet.titre}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvestTargetProjet(null)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-charcoal dark:hover:text-white cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-paper dark:bg-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Ticket min : <strong className="text-charcoal dark:text-white">{investTargetProjet.participation_min.toLocaleString()} F</strong></span>
                      <span className="text-slate-500">Votre solde : <strong className="text-gold">{member.solde.toLocaleString()} F</strong></span>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const amt = Number(investAmountInput);
                        if (!amt || isNaN(amt) || amt <= 0) {
                          setInvestError('Veuillez saisir un montant valide.');
                          return;
                        }
                        if (amt < investTargetProjet.participation_min) {
                          setInvestError(`Montant minimum : ${investTargetProjet.participation_min.toLocaleString()} F CFA.`);
                          return;
                        }
                        if (amt > member.solde) {
                          setInvestError('Solde insuffisant pour cet investissement.');
                          return;
                        }
                        onJoinInvestment(investTargetProjet.id, amt);
                        setInvestTargetProjet(null);
                        setInvestAmountInput('');
                        setInvestError('');
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Montant à investir (F CFA)
                        </label>
                        <input
                          type="number"
                          min={investTargetProjet.participation_min}
                          max={member.solde}
                          value={investAmountInput}
                          onChange={(e) => {
                            setInvestAmountInput(e.target.value);
                            setInvestError('');
                          }}
                          required
                          className="w-full h-12 px-4 rounded-xl bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-display font-bold text-lg tabular outline-none"
                          autoFocus
                        />
                      </div>

                      {investError && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                          {investError}
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setInvestTargetProjet(null)}
                          className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 rounded-xl bg-gold text-white text-xs font-bold shadow-lg shadow-gold/20 cursor-pointer"
                        >
                          Confirmer l&apos;investissement
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'historique' && (
            <motion.div 
              key="historique"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Carnet de Bord</h1>
              
              <div className="bg-white dark:bg-slate-900 hairline rounded-[2rem] overflow-hidden shadow-xl">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-bold text-charcoal dark:text-white">Historique Complet</h3>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold tabular mt-0.5">{memberTxs.length} Transactions</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptScanError('');
                      setShowReceiptScanner(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-lapis/10 text-lapis dark:text-blue-300 hover:bg-lapis hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <QrCode size={14} />
                    <span>Scanner un Reçu QR</span>
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-paper dark:bg-slate-950/50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                      <tr>
                        <th className="px-8 py-5">Type de Mouvement</th>
                        <th className="px-8 py-5">Date & Heure</th>
                        <th className="px-8 py-5">Référence de Reçu</th>
                        <th className="px-8 py-5 text-right">Montant Transaction</th>
                        <th className="px-8 py-5 text-right">Reçu PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {memberTxs.map(tx => {
                        const meta = getMemberTxMeta(tx.type);
                        const receiptPayload: ReceiptData = {
                          transactionId: tx.id,
                          type: tx.type,
                          reference: tx.reference || 'REF',
                          date: tx.date,
                          memberNom: member.nom,
                          memberLivret: member.livret,
                          memberTelephone: member.telephone,
                          zone: tx.zone || member.zone,
                          montant: tx.montant,
                          soldeAvant: tx.solde_avant,
                          soldeApres: tx.solde_apres,
                          agentNom: tx.agent,
                          motif: tx.description,
                        };
                        return (
                        <tr 
                          key={tx.id} 
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                          onClick={() => onOpenReceipt(receiptPayload)}
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${meta.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {meta.positive ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-sm font-bold text-charcoal dark:text-white">{meta.label}</div>
                                <div className="text-[10px] text-slate-400">Via Agent @{tx.agent}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-sm text-slate-500 font-mono">
                            {formatSafeDate(tx.date)}
                          </td>
                          <td className="px-8 py-6 text-xs text-slate-400 font-mono tracking-wider">{tx.reference}</td>
                          <td className="px-8 py-6 text-right font-display font-bold text-lg tabular">
                            <span className={meta.positive ? 'text-emerald-600' : 'text-rose-600'}>
                              {meta.sign}{tx.montant.toLocaleString()} F
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadReceiptPDF(receiptPayload, { format: 'a4' });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lapis/10 text-lapis dark:text-blue-300 hover:bg-lapis hover:text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              title="Télécharger le reçu PDF"
                            >
                              <FileDown size={14} />
                              <span>PDF</span>
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                      {memberTxs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic text-sm">
                            Aucune transaction enregistrée pour le moment.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'objectif' && (
            <motion.div 
              key="objectif"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Objectif d'Épargne</h1>
                <p className="text-slate-500 text-sm">Visualisez vos progrès et restez motivé pour vos projets futurs.</p>
              </div>

              {/* Aperçu visuel en direct de la progression */}
              {(() => {
                const previewTarget = Math.max(0, parseFloat(goalMontant) || 0);
                const previewRemaining = Math.max(0, previewTarget - member.solde);
                const previewPct = previewTarget > 0 ? Math.min(100, (member.solde / previewTarget) * 100) : 0;
                const previewCompleted = previewTarget > 0 && member.solde >= previewTarget;

                return (
                  <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                      <GoalProgressRing
                        current={member.solde}
                        target={previewTarget}
                        size={88}
                        strokeWidth={8}
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gold">
                          Progression vers votre objectif
                        </div>
                        <h3 className="text-xl font-display font-bold text-charcoal dark:text-white truncate">
                          {goalLabel.trim() || 'Mon objectif d’épargne'}
                        </h3>
                        <div className="text-xs text-slate-500 tabular-nums">
                          Épargne actuelle :{' '}
                          <span className="font-bold text-charcoal dark:text-white">
                            {member.solde.toLocaleString()} F CFA
                          </span>
                          {previewTarget > 0 && (
                            <>
                              {' '}sur{' '}
                              <span className="font-bold text-gold">
                                {previewTarget.toLocaleString()} F CFA
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            previewCompleted ? 'bg-emerald-500' : 'bg-gold'
                          }`}
                          style={{ width: `${previewPct}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                        <span>
                          {previewTarget > 0
                            ? previewCompleted
                              ? `Objectif atteint (+${(member.solde - previewTarget).toLocaleString()} F CFA)`
                              : `Reste ${previewRemaining.toLocaleString()} F CFA à épargner`
                            : 'Saisissez un montant cible ci-dessous'}
                        </span>
                        {goalDate && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Calendar size={12} />
                            Échéance : {formatDateOnlyFR(goalDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleGoalSubmit} className="p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-xl space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Quel est votre projet ?</label>
                  <input 
                    type="text" 
                    value={goalLabel}
                    onChange={e => setGoalLabel(e.target.value)}
                    placeholder="Ex: Mariage, Achat Terrain, Scolarité..."
                    className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-lg font-bold outline-none"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Montant Cible (F CFA)</label>
                    <input 
                      type="number" 
                      min="1000"
                      value={goalMontant}
                      onChange={e => setGoalMontant(e.target.value)}
                      placeholder="Ex: 500000"
                      className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-lg font-bold tabular outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Date Échéance</label>
                    <input 
                      type="date" 
                      value={goalDate}
                      onChange={e => setGoalDate(e.target.value)}
                      className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm outline-none"
                    />
                  </div>
                </div>

                {goalError && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
                    <AlertCircle size={16} />
                    {goalError}
                  </div>
                )}

                <button type="submit" className="w-full py-4 bg-lapis text-white rounded-2xl font-display font-bold shadow-lg shadow-lapis/20 transition-all active:scale-[0.98] cursor-pointer">
                  Enregistrer l'objectif
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'profil' && (
            <motion.div 
              key="profil"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-display font-bold text-charcoal dark:text-white">Sécurité du Compte</h1>
                <p className="text-slate-500 text-sm">Gérez votre code PIN et vos paramètres de sécurité.</p>
              </div>

              <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-xl space-y-8">
                <div className="flex items-center gap-4 p-4 bg-paper dark:bg-slate-800 rounded-2xl">
                  <div className="p-3 bg-gold text-white rounded-xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-charcoal dark:text-white">Code PIN Personnel</h3>
                    <p className="text-xs text-slate-500">Utilisé pour valider vos retraits et demandes de financement.</p>
                  </div>
                </div>

                <form onSubmit={handlePinChange} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Code PIN Actuel</label>
                    <div className="relative">
                      <input 
                        type="password"
                        value={currentPinInput}
                        onChange={e => setCurrentPinInput(e.target.value)}
                        maxLength={4}
                        className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-xl tracking-[1em] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Nouveau Code PIN (4 chiffres)</label>
                    <input 
                      type="password"
                      value={newPinInput}
                      onChange={e => setNewPinInput(e.target.value)}
                      maxLength={4}
                      className="w-full h-14 px-6 rounded-2xl bg-paper dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-xl tracking-[1em] outline-none"
                    />
                  </div>

                  {pinMessage && (
                    <p className={`text-xs font-bold ${pinMessage.includes('✅') ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pinMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isUpdatingPin}
                    className="w-full py-4 bg-paper dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-charcoal dark:text-white rounded-2xl font-display font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {isUpdatingPin ? 'Mise à jour...' : 'Changer le code PIN'}
                  </button>
                </form>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={onLogout}
                    className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-display font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <LogOut size={18} />
                    Se déconnecter de l'espace membre
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showReceiptScanner && (
        <QRScanner
          title="Vérifier un Reçu QR"
          subtitle="Scannez le QR code d'un reçu imprimé ou PDF"
          helperText="Placez le QR code du reçu PMES-AGR dans le cadre ou saisissez sa référence pour afficher le reçu officiel."
          manualPlaceholder="Ex: REC-DOSSO-2026-0042 ou PMES|..."
          onScan={handleReceiptQRScan}
          errorMessage={receiptScanError}
          onClose={() => {
            setShowReceiptScanner(false);
            setReceiptScanError('');
          }}
        />
      )}
    </div>
  );
};
