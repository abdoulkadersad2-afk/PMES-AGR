import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Transaction } from '../../types';
import { BarChart3, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react';

export interface MemberMonthlySavingsChartProps {
  transactions: Transaction[];
  className?: string;
}

type MonthSpanOption = '6m' | '12m' | 'all';
type SeriesModeOption = 'contributions' | 'net_flow';

interface MonthlyBucket {
  monthKey: string;
  label: string;
  fullMonth: string;
  depots: number;
  retraits: number;
  epargneNette: number;
  depotCount: number;
  isCurrentMonth: boolean;
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatAxisFCFA(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${Math.round(value)}`;
}

function formatFCFA(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} F`;
}

interface TooltipPayloadItem {
  payload?: MonthlyBucket;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  seriesMode: SeriesModeOption;
}

const CustomMonthlyTooltip: React.FC<CustomTooltipProps> = ({ active, payload, seriesMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  return (
    <div className="min-w-[220px] rounded-2xl bg-charcoal text-white p-4 shadow-xl border border-white/10 text-xs space-y-2.5">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <span className="font-display font-bold capitalize text-white">
          {bucket.fullMonth}
        </span>
        <span className="font-mono text-[11px] text-slate-400 tabular">
          {bucket.depotCount} dépôt{bucket.depotCount > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-sm bg-[#3B82F6]" />
            Cotisations épargne
          </span>
          <span className="font-mono font-bold tabular text-white">
            +{formatFCFA(bucket.depots)}
          </span>
        </div>

        {(seriesMode === 'net_flow' || bucket.retraits > 0) && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-[#F43F5E]" />
              Retraits
            </span>
            <span className="font-mono font-semibold tabular text-rose-300">
              -{formatFCFA(bucket.retraits)}
            </span>
          </div>
        )}

        <div className="pt-1.5 border-t border-white/10 flex items-center justify-between gap-4">
          <span className="text-slate-300">Épargne nette du mois</span>
          <span
            className={`font-mono font-bold tabular ${
              bucket.epargneNette >= 0 ? 'text-emerald-400' : 'text-rose-300'
            }`}
          >
            {bucket.epargneNette >= 0 ? '+' : ''}
            {formatFCFA(bucket.epargneNette)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MemberMonthlySavingsChart: React.FC<MemberMonthlySavingsChartProps> = ({
  transactions = [],
  className = '',
}) => {
  const [monthSpan, setMonthSpan] = useState<MonthSpanOption>('6m');
  const [seriesMode, setSeriesMode] = useState<SeriesModeOption>('contributions');

  const {
    chartData,
    totalContributions,
    monthlyAverage,
    bestMonth,
    currentMonthDepots,
    monthDeltaPct,
    hasActivity,
  } = useMemo(() => {
    const monthlyAgg = new Map<
      string,
      { depots: number; retraits: number; depotCount: number }
    >();

    let earliestTimestamp: number | null = null;
    let latestTimestamp: number | null = null;
    let totalActivityCount = 0;

    transactions.forEach((tx) => {
      if (tx.type !== 'depot' && tx.type !== 'retrait') return;
      const parsed = new Date(tx.date);
      if (Number.isNaN(parsed.getTime())) return;

      const monthStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      const monthTs = monthStart.getTime();
      if (earliestTimestamp === null || monthTs < earliestTimestamp) {
        earliestTimestamp = monthTs;
      }
      if (latestTimestamp === null || monthTs > latestTimestamp) {
        latestTimestamp = monthTs;
      }

      const key = toMonthKey(monthStart);
      const current = monthlyAgg.get(key) || { depots: 0, retraits: 0, depotCount: 0 };
      const amount = Math.max(0, Number(tx.montant) || 0);

      if (tx.type === 'depot') {
        current.depots += amount;
        current.depotCount += 1;
      } else if (tx.type === 'retrait') {
        current.retraits += amount;
      }

      totalActivityCount += 1;
      monthlyAgg.set(key, current);
    });

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthKey = toMonthKey(currentMonthStart);

    const endMonth =
      latestTimestamp !== null && latestTimestamp > currentMonthStart.getTime()
        ? new Date(latestTimestamp)
        : new Date(currentMonthStart);

    const startMonth = new Date(endMonth);
    if (monthSpan === '6m') {
      startMonth.setMonth(endMonth.getMonth() - 5);
    } else if (monthSpan === '12m') {
      startMonth.setMonth(endMonth.getMonth() - 11);
    } else if (earliestTimestamp !== null) {
      const capStart = new Date(endMonth);
      capStart.setMonth(endMonth.getMonth() - 23);
      startMonth.setTime(
        earliestTimestamp < capStart.getTime()
          ? capStart.getTime()
          : earliestTimestamp
      );
    } else {
      startMonth.setMonth(endMonth.getMonth() - 5);
    }

    const shortFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const shortWithYearFmt = new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: '2-digit',
    });
    const fullFmt = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    const spanMonthsCount =
      (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
      (endMonth.getMonth() - startMonth.getMonth()) +
      1;
    const includeYearInAxis = spanMonthsCount > 10 || endMonth.getFullYear() !== startMonth.getFullYear();

    const points: MonthlyBucket[] = [];
    const cursor = new Date(startMonth);

    let depotsSum = 0;
    let activeDepositMonths = 0;
    let peakMonth: { label: string; amount: number } | null = null;

    while (cursor.getTime() <= endMonth.getTime()) {
      const key = toMonthKey(cursor);
      const agg = monthlyAgg.get(key) || { depots: 0, retraits: 0, depotCount: 0 };
      const rawShort = (includeYearInAxis ? shortWithYearFmt : shortFmt)
        .format(cursor)
        .replace('.', '');
      const label = rawShort.charAt(0).toUpperCase() + rawShort.slice(1);
      const fullMonth = fullFmt.format(cursor);

      depotsSum += agg.depots;
      if (agg.depots > 0) {
        activeDepositMonths += 1;
      }
      if (!peakMonth || agg.depots > peakMonth.amount) {
        peakMonth = { label: fullMonth, amount: agg.depots };
      }

      points.push({
        monthKey: key,
        label,
        fullMonth,
        depots: agg.depots,
        retraits: agg.retraits,
        epargneNette: agg.depots - agg.retraits,
        depotCount: agg.depotCount,
        isCurrentMonth: key === currentMonthKey,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    const avg =
      activeDepositMonths > 0
        ? Math.round(depotsSum / Math.max(1, points.length))
        : 0;

    const currentPoint = points.find((p) => p.isCurrentMonth) || points[points.length - 1];
    const prevDate = new Date(currentMonthStart);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevKey = toMonthKey(prevDate);
    const prevDepots = monthlyAgg.get(prevKey)?.depots || 0;
    const currDepots = currentPoint ? currentPoint.depots : 0;

    let deltaPct: number | null = null;
    if (prevDepots > 0) {
      deltaPct = Math.round(((currDepots - prevDepots) / prevDepots) * 100);
    }

    return {
      chartData: points,
      totalContributions: depotsSum,
      monthlyAverage: avg,
      bestMonth: peakMonth && peakMonth.amount > 0 ? peakMonth : null,
      currentMonthDepots: currDepots,
      monthDeltaPct: deltaPct,
      hasActivity: totalActivityCount > 0,
    };
  }, [transactions, monthSpan]);

  const spanOptions: Array<{ id: MonthSpanOption; label: string }> = [
    { id: '6m', label: '6 mois' },
    { id: '12m', label: '12 mois' },
    { id: 'all', label: 'Tout' },
  ];

  const modeOptions: Array<{ id: SeriesModeOption; label: string }> = [
    { id: 'contributions', label: 'Cotisations' },
    { id: 'net_flow', label: 'Dépôts & Retraits' },
  ];

  return (
    <section
      aria-label="Activité mensuelle des cotisations d'épargne"
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-lapis dark:text-blue-400 shrink-0" />
            <h3 className="font-display font-bold text-lg text-charcoal dark:text-white">
              Cotisations Mensuelles d&apos;Épargne
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suivi mois par mois de vos versements d&apos;épargne et de votre régularité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Mode d'analyse mensuelle"
            className="flex items-center gap-1 p-1 bg-paper dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
          >
            {modeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeriesMode(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  seriesMode === opt.id
                    ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-charcoal dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Horizon mensuel"
            className="flex items-center gap-1 p-1 bg-paper dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
          >
            {spanOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMonthSpan(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  monthSpan === opt.id
                    ? 'bg-lapis text-white shadow-sm'
                    : 'text-slate-500 hover:text-charcoal dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quantitative Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/70 dark:divide-slate-800 border-y border-slate-200/70 dark:border-slate-800 py-4 gap-y-4">
        <div className="pr-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total cotisé (période)
          </div>
          <div className="text-lg font-display font-bold font-mono tabular text-lapis dark:text-blue-400">
            +{formatFCFA(totalContributions)}
          </div>
        </div>

        <div className="lg:px-5 pr-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Moyenne mensuelle
          </div>
          <div className="text-lg font-display font-bold font-mono tabular text-charcoal dark:text-white">
            {formatFCFA(monthlyAverage)}
          </div>
        </div>

        <div className="lg:px-5 pr-4 pt-3 lg:pt-0 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Mois en cours
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-display font-bold font-mono tabular text-charcoal dark:text-white">
              {formatFCFA(currentMonthDepots)}
            </span>
            {monthDeltaPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold tabular ${
                  monthDeltaPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {monthDeltaPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {monthDeltaPct >= 0 ? '+' : ''}
                {monthDeltaPct}%
              </span>
            )}
          </div>
        </div>

        <div className="lg:pl-5 pt-3 lg:pt-0 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Meilleur mois
          </div>
          {bestMonth ? (
            <div className="space-y-0.5">
              <div className="text-lg font-display font-bold font-mono tabular text-gold">
                {formatFCFA(bestMonth.amount)}
              </div>
              <div className="text-[11px] text-slate-400 capitalize truncate">
                {bestMonth.label}
              </div>
            </div>
          ) : (
            <div className="text-sm font-mono text-slate-400 tabular">—</div>
          )}
        </div>
      </div>

      {/* Chart Area or Empty State */}
      {!hasActivity ? (
        <div className="h-60 flex flex-col items-center justify-center text-center px-6 space-y-3 bg-paper/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <PiggyBank size={28} className="text-slate-400" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-semibold text-charcoal dark:text-white">
              Aucune cotisation d&apos;épargne enregistrée
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vos versements mensuels apparaîtront ici automatiquement dès votre premier dépôt auprès d&apos;un agent PMES-AGR.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 10, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.14} />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  tick={{ fill: '#94A3B8', fontWeight: 500 }}
                  dy={8}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  tick={{ fill: '#94A3B8' }}
                  tickFormatter={formatAxisFCFA}
                />

                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={<CustomMonthlyTooltip seriesMode={seriesMode} />}
                />

                {monthlyAverage > 0 && (
                  <ReferenceLine
                    y={monthlyAverage}
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    strokeOpacity={0.65}
                  />
                )}

                <Bar
                  dataKey="depots"
                  name="Cotisations épargne"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.monthKey}
                      fill={entry.isCurrentMonth ? '#D97706' : '#1E3A8A'}
                    />
                  ))}
                </Bar>

                {seriesMode === 'net_flow' && (
                  <>
                    <Bar
                      dataKey="retraits"
                      name="Retraits"
                      fill="#E11D48"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={26}
                    />
                    <Line
                      type="monotone"
                      dataKey="epargneNette"
                      name="Épargne nette"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1E3A8A]" />
                Cotisations mensuelles
              </span>
              <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
                Mois en cours
              </span>
              {seriesMode === 'net_flow' && (
                <>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#E11D48]" />
                    Retraits
                  </span>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                    <span className="w-3 h-0.5 bg-[#10B981]" />
                    Épargne nette
                  </span>
                </>
              )}
              {monthlyAverage > 0 && (
                <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="w-3 border-t-2 border-dashed border-[#D97706]" />
                  Moyenne ({formatFCFA(monthlyAverage)})
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-400 font-mono tabular">
              {chartData.length} mois affichés
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
