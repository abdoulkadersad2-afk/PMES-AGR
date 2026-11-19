import React, { useMemo, useState } from 'react';
import {
  DemandeRetrait,
  DemandeFinancement,
  Member,
} from '../../types';
import {
  AlertTriangle,
  ArrowDownRight,
  Calculator,
  Check,
  X,
  Clock,
  ChevronRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

export type AlertPriority = 1 | 2 | 3; // 1 = Critique, 2 = Haute, 3 = Normale

interface PrioritizedAlertItem {
  id: string;
  kind: 'retrait' | 'financement';
  priority: AlertPriority;
  priorityLabel: 'Critique' | 'Prioritaire' | 'Standard';
  priorityReason: string;
  montant: number;
  date: string;
  ageHours: number;
  motif: string;
  member?: Member;
  subTypeLabel: string;
  insufficientBalance: boolean;
  rawRetrait?: DemandeRetrait;
  rawFinancement?: DemandeFinancement;
}

interface CriticalAlertsProps {
  demandesRetrait: DemandeRetrait[];
  demandesFinancement: DemandeFinancement[];
  members: Member[];
  canValidate: boolean;
  onValidateRetrait: (demandeId: string) => void;
  onRejectRetrait: (demandeId: string) => void;
  onValidateFinancement: (demandeId: string) => void;
  onRejectFinancement: (demandeId: string) => void;
  onNavigateTab: (tab: 'retraits' | 'financements') => void;
}

function formatRelativeAge(dateStr: string): { text: string; hours: number } {
  const parsed = new Date(dateStr).getTime();
  if (Number.isNaN(parsed)) return { text: 'Récent', hours: 0 };
  const diffMs = Math.max(0, Date.now() - parsed);
  const hours = diffMs / (1000 * 60 * 60);

  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return { text: `Il y a ${mins} min`, hours };
  }
  if (hours < 24) {
    return { text: `Il y a ${Math.floor(hours)} h`, hours };
  }
  const days = Math.floor(hours / 24);
  return { text: `Il y a ${days} j`, hours };
}

function getFinancementLabel(type: DemandeFinancement['financement_type']): string {
  switch (type) {
    case 'mourabaha':
      return 'Mourabaha';
    case 'moudaraba':
      return 'Moudaraba';
    case 'qard_al_hassane':
      return 'Qard Al Hassane';
    default:
      return 'Financement';
  }
}

export const CriticalAlerts: React.FC<CriticalAlertsProps> = ({
  demandesRetrait,
  demandesFinancement,
  members,
  canValidate,
  onValidateRetrait,
  onRejectRetrait,
  onValidateFinancement,
  onRejectFinancement,
  onNavigateTab,
}) => {
  const [filter, setFilter] = useState<'all' | 'retrait' | 'financement'>('all');

  const prioritizedAlerts = useMemo<PrioritizedAlertItem[]>(() => {
    const memberMap = new Map<string, Member>();
    members.forEach((m) => memberMap.set(m.id, m));

    const retraitItems: PrioritizedAlertItem[] = demandesRetrait
      .filter((d) => d.status === 'en_attente')
      .map((d) => {
        const member = memberMap.get(d.member_id);
        const { text: ageText, hours } = formatRelativeAge(d.date);
        const solde = member?.solde ?? 0;
        const insufficientBalance = d.montant > solde;
        const highRatio = solde > 0 && d.montant / solde >= 0.8;

        let priority: AlertPriority = 3;
        let priorityLabel: PrioritizedAlertItem['priorityLabel'] = 'Standard';
        let priorityReason = `Retrait standard · ${ageText}`;

        if (insufficientBalance) {
          priority = 1;
          priorityLabel = 'Critique';
          priorityReason = `Solde insuffisant (${solde.toLocaleString('fr-FR')} F dispo)`;
        } else if (d.montant >= 100000 || hours >= 48) {
          priority = 1;
          priorityLabel = 'Critique';
          priorityReason =
            hours >= 48
              ? `En attente depuis +48 h (${ageText})`
              : `Montant élevé (≥ 100 000 F)`;
        } else if (d.montant >= 40000 || highRatio || hours >= 24) {
          priority = 2;
          priorityLabel = 'Prioritaire';
          priorityReason = highRatio
            ? 'Mobilise > 80% de l’épargne'
            : `Traitement prioritaire · ${ageText}`;
        }

        return {
          id: d.id,
          kind: 'retrait',
          priority,
          priorityLabel,
          priorityReason,
          montant: d.montant,
          date: d.date,
          ageHours: hours,
          motif: d.motif,
          member,
          subTypeLabel: 'Demande de retrait',
          insufficientBalance,
          rawRetrait: d,
        };
      });

    const financementItems: PrioritizedAlertItem[] = demandesFinancement
      .filter((f) => f.status === 'en_attente')
      .map((f) => {
        const member = memberMap.get(f.member_id);
        const { text: ageText, hours } = formatRelativeAge(f.date);

        let priority: AlertPriority = 3;
        let priorityLabel: PrioritizedAlertItem['priorityLabel'] = 'Standard';
        let priorityReason = `Dossier récent · ${ageText}`;

        if (f.montant >= 250000 || hours >= 48) {
          priority = 1;
          priorityLabel = 'Critique';
          priorityReason =
            hours >= 48
              ? `Dossier en attente +48 h (${ageText})`
              : `Engagement élevé (≥ 250 000 F)`;
        } else if (f.montant >= 100000 || hours >= 24) {
          priority = 2;
          priorityLabel = 'Prioritaire';
          priorityReason = `Comité requis · ${ageText}`;
        }

        return {
          id: f.id,
          kind: 'financement',
          priority,
          priorityLabel,
          priorityReason,
          montant: f.montant,
          date: f.date,
          ageHours: hours,
          motif: f.motif,
          member,
          subTypeLabel: `Financement · ${getFinancementLabel(f.financement_type)} (${f.duree_mois} mois)`,
          insufficientBalance: false,
          rawFinancement: f,
        };
      });

    return [...retraitItems, ...financementItems].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (Math.abs(b.ageHours - a.ageHours) > 1) return b.ageHours - a.ageHours;
      return b.montant - a.montant;
    });
  }, [demandesRetrait, demandesFinancement, members]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return prioritizedAlerts;
    return prioritizedAlerts.filter((item) => item.kind === filter);
  }, [prioritizedAlerts, filter]);

  const pendingRetraitsCount = prioritizedAlerts.filter((i) => i.kind === 'retrait').length;
  const pendingFinancementsCount = prioritizedAlerts.filter((i) => i.kind === 'financement').length;
  const criticalCount = prioritizedAlerts.filter((i) => i.priority === 1).length;

  return (
    <section
      aria-labelledby="critical-alerts-heading"
      className="bg-white dark:bg-slate-900 hairline rounded-[2rem] shadow-sm overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-neutral-200/60 dark:border-slate-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <ShieldAlert
              size={20}
              className={criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gold'}
            />
            <h2
              id="critical-alerts-heading"
              className="text-xl font-display font-bold text-charcoal dark:text-white"
            >
              Alertes Critiques
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular">
            <span>{prioritizedAlerts.length} demande{prioritizedAlerts.length > 1 ? 's' : ''} en attente</span>
            <span aria-hidden="true">·</span>
            <span className={criticalCount > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
              {criticalCount} critique{criticalCount > 1 ? 's' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>Classées par niveau d&apos;urgence</span>
          </div>
        </div>

        {/* Interactive Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filtrer les alertes en attente"
          className="inline-flex items-center gap-1 p-1 bg-paper dark:bg-slate-800/80 rounded-xl self-start lg:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-charcoal dark:hover:text-white'
            }`}
          >
            Toutes ({prioritizedAlerts.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'retrait'}
            onClick={() => setFilter('retrait')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              filter === 'retrait'
                ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-charcoal dark:hover:text-white'
            }`}
          >
            Retraits ({pendingRetraitsCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'financement'}
            onClick={() => setFilter('financement')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              filter === 'financement'
                ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-charcoal dark:hover:text-white'
            }`}
          >
            Financements ({pendingFinancementsCount})
          </button>
        </div>
      </div>

      {/* Prioritized List */}
      {filteredItems.length === 0 ? (
        <div className="px-6 py-12 sm:px-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-charcoal dark:text-white">
              Aucune alerte en attente dans cette catégorie
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toutes les demandes de retrait et de financement ont été traitées.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200/60 dark:divide-slate-800/60">
          {filteredItems.map((item, idx) => {
            const formattedDate = new Date(item.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            const priorityColorClass =
              item.priority === 1
                ? 'text-rose-600 dark:text-rose-400'
                : item.priority === 2
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-300';

            const PriorityIcon = item.priority === 1 ? AlertTriangle : Clock;

            return (
              <div
                key={`${item.kind}-${item.id}`}
                className="px-6 py-4 sm:px-8 sm:py-5 hover:bg-paper/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Priority rank + Member & Request context */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-paper dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    {item.kind === 'retrait' ? (
                      <ArrowDownRight size={16} className="text-rose-600 dark:text-rose-400" />
                    ) : (
                      <Calculator size={16} className="text-lapis dark:text-blue-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-xs font-mono tabular text-slate-400">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-display font-bold text-sm text-charcoal dark:text-white truncate">
                        {item.member?.nom || 'Adhérent inconnu'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${priorityColorClass}`}>
                        <PriorityIcon size={13} />
                        {item.priorityLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{item.subTypeLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.member?.livret || 'N/A'}</span>
                      {item.member?.zone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.member.zone}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="tabular">{formattedDate}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-2xl">
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {item.priorityReason}
                      </span>
                      {item.motif ? ` — « ${item.motif} »` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Amount + Action buttons */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-slate-800/50">
                  <div className="text-left md:text-right">
                    <div className="text-base font-display font-bold text-charcoal dark:text-white tabular">
                      {item.montant.toLocaleString('fr-FR')} F
                    </div>
                    {item.member && (
                      <div className="text-[11px] text-slate-400 tabular">
                        Épargne : {item.member.solde.toLocaleString('fr-FR')} F
                      </div>
                    )}
                  </div>

                  {canValidate ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={item.insufficientBalance}
                        title={
                          item.insufficientBalance
                            ? 'Solde adhérent insuffisant pour approuver'
                            : 'Approuver la demande'
                        }
                        onClick={() =>
                          item.kind === 'retrait'
                            ? onValidateRetrait(item.id)
                            : onValidateFinancement(item.id)
                        }
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check size={14} />
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          item.kind === 'retrait'
                            ? onRejectRetrait(item.id)
                            : onRejectFinancement(item.id)
                        }
                        className="px-3 py-2 rounded-xl bg-paper dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <X size={14} />
                        Rejeter
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateTab(item.kind === 'retrait' ? 'retraits' : 'financements')
                      }
                      className="px-3.5 py-2 rounded-xl bg-paper dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-charcoal dark:text-white text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Consulter
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Quick Links */}
      {prioritizedAlerts.length > 0 && (
        <div className="px-6 py-3.5 sm:px-8 bg-paper/60 dark:bg-slate-950/40 border-t border-neutral-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Accès rapide aux files complètes de traitement
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateTab('retraits')}
              className="font-semibold text-lapis dark:text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              File retraits ({pendingRetraitsCount})
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('financements')}
              className="font-semibold text-lapis dark:text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Comité crédit ({pendingFinancementsCount})
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
