import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Transaction, CaisseMouvement } from '../../types';
import { TrendingUp, TrendingDown, BarChart3, Banknote, ArrowUpRight } from 'lucide-react';

export interface FinancialTrendsChartProps {
  transactions: Transaction[];
  caisseMouvements: CaisseMouvement[];
  className?: string;
  onNavigateToCollecte?: () => void;
}

type TimeRangeOption = '7d' | '14d' | '30d' | 'all';
type ChartViewMode = 'combined' | 'transactions' | 'caisse';

interface DailyDataPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  depots: number;
  retraits: number;
  autresFlux: number;
  fluxNetTx: number;
  txCount: number;
  soldeCaisse: number;
  caisseEntrees: number;
  caisseSorties: number;
  caisseMouvementsCount: number;
}

function toLocalDateKey(input: string | Date): string | null {
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    return `${Math.round(k)}k`;
  }
  return `${Math.round(value)}`;
}

function formatFCFA(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} F`;
}

interface TooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: DailyDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  viewMode: ChartViewMode;
}

const CustomTrendsTooltip: React.FC<CustomTooltipProps> = ({ active, payload, viewMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const caisseDelta = point.caisseEntrees - point.caisseSorties;

  return (
    <div className="min-w-[240px] rounded-2xl bg-charcoal text-white p-4 shadow-xl border border-white/10 text-xs space-y-3">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <span className="font-display font-bold text-white capitalize">{point.fullDate}</span>
        <span className="text-[11px] text-slate-400 font-mono tabular">
          {point.txCount} op{point.txCount > 1 ? 's' : ''}
        </span>
      </div>

      {viewMode !== 'caisse' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-[#3B82F6]" />
              Dépôts
            </span>
            <span className="font-mono font-semibold tabular text-white">
              +{formatFCFA(point.depots)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-[#F43F5E]" />
              Retraits
            </span>
            <span className="font-mono font-semibold tabular text-rose-300">
              -{formatFCFA(point.retraits)}
            </span>
          </div>
          {point.autresFlux > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-sm bg-[#F59E0B]" />
                Remb. / Financements
              </span>
              <span className="font-mono font-semibold tabular text-amber-300">
                {formatFCFA(point.autresFlux)}
              </span>
            </div>
          )}
        </div>
      )}

      {viewMode !== 'transactions' && (
        <div className={viewMode === 'combined' ? 'pt-2 border-t border-white/10 space-y-1.5' : 'space-y-1.5'}>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              Solde Caisse Financement
            </span>
            <span className="font-mono font-bold tabular text-emerald-400">
              {formatFCFA(point.soldeCaisse)}
            </span>
          </div>
          {point.caisseMouvementsCount > 0 && (
            <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
              <span>Variation caisse du jour ({point.caisseMouvementsCount} mvt)</span>
              <span className={`font-mono font-semibold tabular ${caisseDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {caisseDelta >= 0 ? '+' : ''}{formatFCFA(caisseDelta)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FinancialTrendsChart: React.FC<FinancialTrendsChartProps> = ({
  transactions = [],
  caisseMouvements = [],
  className = '',
  onNavigateToCollecte,
}) => {
  const [range, setRange] = useState<TimeRangeOption>('14d');
  const [viewMode, setViewMode] = useState<ChartViewMode>('combined');
  const [visibleSeries, setVisibleSeries] = useState({
    depots: true,
    retraits: true,
    autresFlux: true,
    soldeCaisse: true,
  });

  const {
    chartData,
    totalDepots,
    totalRetraits,
    totalTxCount,
    avgDailyVolume,
    currentCaisseBalance,
    caissePeriodDelta,
    hasAnyRecords,
    hasRecordsInWindow,
  } = useMemo(() => {
    const sortedCaisse = [...caisseMouvements]
      .filter(
        (m) =>
          m.type !== 'cotisation_sante' &&
          m.type !== 'assistance_sociale' &&
          !Number.isNaN(new Date(m.date).getTime())
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const hasRecords = transactions.some((t) => !Number.isNaN(new Date(t.date).getTime())) || sortedCaisse.length > 0;

    // 1. Aggregate transactions by YYYY-MM-DD
    const txByDay = new Map<
      string,
      { depots: number; retraits: number; autresFlux: number; txCount: number }
    >();
    let earliestTimestamp: number | null = null;
    let latestTimestamp: number | null = null;

    const trackTimestamp = (ts: number) => {
      if (earliestTimestamp === null || ts < earliestTimestamp) earliestTimestamp = ts;
      if (latestTimestamp === null || ts > latestTimestamp) latestTimestamp = ts;
    };

    transactions.forEach((tx) => {
      const parsed = new Date(tx.date);
      if (Number.isNaN(parsed.getTime())) return;
      const key = toLocalDateKey(parsed);
      if (!key) return;
      trackTimestamp(parsed.getTime());

      const bucket = txByDay.get(key) || {
        depots: 0,
        retraits: 0,
        autresFlux: 0,
        txCount: 0,
      };
      const amount = Number(tx.montant) || 0;
      if (tx.type === 'depot') {
        bucket.depots += amount;
      } else if (tx.type === 'retrait') {
        bucket.retraits += amount;
      } else {
        bucket.autresFlux += amount;
      }
      bucket.txCount += 1;
      txByDay.set(key, bucket);
    });

    // 2. Aggregate caisseMouvements chronologically by YYYY-MM-DD
    const caisseByDay = new Map<
      string,
      { entrees: number; sorties: number; delta: number; count: number }
    >();

    // sortedCaisse already filtered (excluding Fonds Social) & sorted above

    let globalCaisseBalance = 0;
    sortedCaisse.forEach((m) => {
      const parsed = new Date(m.date);
      const key = toLocalDateKey(parsed);
      if (!key) return;
      trackTimestamp(parsed.getTime());

      const amount = Number(m.montant) || 0;
      const isOutflow = m.type === 'decaissement';
      const signed = isOutflow ? -amount : amount;
      globalCaisseBalance += signed;

      const bucket = caisseByDay.get(key) || {
        entrees: 0,
        sorties: 0,
        delta: 0,
        count: 0,
      };
      if (isOutflow) {
        bucket.sorties += amount;
      } else {
        bucket.entrees += amount;
      }
      bucket.delta += signed;
      bucket.count += 1;
      caisseByDay.set(key, bucket);
    });

    // 3. Determine calendar window [startDate, endDate]
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    if (latestTimestamp !== null) {
      const latestDay = new Date(latestTimestamp);
      latestDay.setHours(0, 0, 0, 0);
      if (latestDay.getTime() > endDate.getTime()) {
        endDate.setTime(latestDay.getTime());
      }
    }

    const startDate = new Date(endDate);
    if (range === '7d') {
      startDate.setDate(endDate.getDate() - 6);
    } else if (range === '14d') {
      startDate.setDate(endDate.getDate() - 13);
    } else if (range === '30d') {
      startDate.setDate(endDate.getDate() - 29);
    } else if (earliestTimestamp !== null) {
      const earliestDay = new Date(earliestTimestamp);
      earliestDay.setHours(0, 0, 0, 0);
      // Cap 'all' daily span to max 120 days to keep daily bars legible
      const maxLookback = new Date(endDate);
      maxLookback.setDate(endDate.getDate() - 119);
      startDate.setTime(
        earliestDay.getTime() < maxLookback.getTime()
          ? maxLookback.getTime()
          : earliestDay.getTime()
      );
    } else {
      startDate.setDate(endDate.getDate() - 13);
    }

    const startKey = toLocalDateKey(startDate) || '';

    // Compute opening Caisse Financement balance prior to startDate
    let runningBalance = 0;
    const sortedDayKeys = Array.from(caisseByDay.keys()).sort();
    for (const dayKey of sortedDayKeys) {
      if (dayKey < startKey) {
        runningBalance += caisseByDay.get(dayKey)!.delta;
      }
    }
    const openingBalance = runningBalance;

    // 4. Build contiguous day-by-day series
    const points: DailyDataPoint[] = [];
    const cursor = new Date(startDate);
    let depotsSum = 0;
    let retraitsSum = 0;
    let txCountSum = 0;
    let totalVolumeSum = 0;
    let windowActivityCount = 0;

    const shortFormatter = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
    const fullFormatter = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    while (cursor.getTime() <= endDate.getTime()) {
      const key = toLocalDateKey(cursor) || '';
      const txBucket = txByDay.get(key);
      const caisseBucket = caisseByDay.get(key);

      if (caisseBucket) {
        runningBalance += caisseBucket.delta;
        windowActivityCount += caisseBucket.count;
      }
      if (txBucket) {
        windowActivityCount += txBucket.txCount;
      }

      const depots = txBucket?.depots || 0;
      const retraits = txBucket?.retraits || 0;
      const autresFlux = txBucket?.autresFlux || 0;
      const txCount = txBucket?.txCount || 0;

      depotsSum += depots;
      retraitsSum += retraits;
      txCountSum += txCount;
      totalVolumeSum += depots + retraits + autresFlux;

      points.push({
        dateKey: key,
        label: shortFormatter.format(cursor),
        fullDate: fullFormatter.format(cursor),
        depots,
        retraits,
        autresFlux,
        fluxNetTx: depots - retraits,
        txCount,
        soldeCaisse: runningBalance,
        caisseEntrees: caisseBucket?.entrees || 0,
        caisseSorties: caisseBucket?.sorties || 0,
        caisseMouvementsCount: caisseBucket?.count || 0,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    const dayCount = Math.max(1, points.length);
    const closingBalance = points.length > 0 ? points[points.length - 1].soldeCaisse : globalCaisseBalance;

    return {
      chartData: points,
      totalDepots: depotsSum,
      totalRetraits: retraitsSum,
      totalTxCount: txCountSum,
      avgDailyVolume: Math.round(totalVolumeSum / dayCount),
      currentCaisseBalance: globalCaisseBalance,
      caissePeriodDelta: closingBalance - openingBalance,
      hasAnyRecords: hasRecords,
      hasRecordsInWindow: windowActivityCount > 0,
    };
  }, [transactions, caisseMouvements, range]);

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const rangeOptions: Array<{ id: TimeRangeOption; label: string }> = [
    { id: '7d', label: '7 jours' },
    { id: '14d', label: '14 jours' },
    { id: '30d', label: '30 jours' },
    { id: 'all', label: 'Tout' },
  ];

  const viewOptions: Array<{ id: ChartViewMode; label: string }> = [
    { id: 'combined', label: 'Combinée' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'caisse', label: 'Caisse' },
  ];

  const showTxBars = viewMode === 'combined' || viewMode === 'transactions';
  const showCaisseLine = viewMode === 'combined' || viewMode === 'caisse';

  return (
    <section
      aria-label="Tendances des transactions quotidiennes et solde de la Caisse Financement"
      className={`p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={18} className="text-lapis dark:text-blue-400 shrink-0" />
            <h2 className="text-lg sm:text-xl font-display font-bold text-charcoal dark:text-white">
              Tendances Quotidiennes &amp; Caisse Financement
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Volumes journaliers des opérations et évolution cumulée du solde de la Caisse Financement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Segmented Control */}
          <div
            role="group"
            aria-label="Mode d'affichage du graphique"
            className="flex items-center gap-1 p-1 bg-paper dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
          >
            {viewOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === opt.id
                    ? 'bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-charcoal dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Timeframe Segmented Control */}
          <div
            role="group"
            aria-label="Période d'analyse"
            className="flex items-center gap-1 p-1 bg-paper dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
          >
            {rangeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === opt.id
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

      {/* Quantitative Summary Strip (Hairline Dividers, Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/70 dark:divide-slate-800 border-y border-slate-200/70 dark:border-slate-800 py-4 gap-y-4">
        <div className="pr-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Dépôts (période)
          </div>
          <div className="text-lg sm:text-xl font-display font-bold font-mono tabular text-lapis dark:text-blue-400">
            +{formatFCFA(totalDepots)}
          </div>
        </div>

        <div className="lg:px-5 pr-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Retraits (période)
          </div>
          <div className="text-lg sm:text-xl font-display font-bold font-mono tabular text-rose-600 dark:text-rose-400">
            -{formatFCFA(totalRetraits)}
          </div>
        </div>

        <div className="lg:px-5 pr-4 pt-3 lg:pt-0 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Moyenne quotidienne
          </div>
          <div className="text-lg sm:text-xl font-display font-bold font-mono tabular text-charcoal dark:text-white">
            {formatFCFA(avgDailyVolume)}
            <span className="text-xs font-body font-normal text-slate-400 ml-1.5">
              / {totalTxCount} ops
            </span>
          </div>
        </div>

        <div className="lg:pl-5 pt-3 lg:pt-0 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Solde Caisse Financement
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg sm:text-xl font-display font-bold font-mono tabular text-emerald-600 dark:text-emerald-400">
              {formatFCFA(currentCaisseBalance)}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-mono font-semibold tabular ${
                caissePeriodDelta >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {caissePeriodDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {caissePeriodDelta >= 0 ? '+' : ''}{formatFCFA(caissePeriodDelta)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart Viewport */}
      {!hasAnyRecords ? (
        <div className="h-72 flex flex-col items-center justify-center text-center px-6 space-y-4 bg-paper/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <Banknote size={28} className="text-slate-400" />
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-semibold text-charcoal dark:text-white">
              Aucune donnée financière disponible
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Les tendances quotidiennes des transactions et le solde de la Caisse Financement apparaîtront dès la première opération enregistrée.
            </p>
          </div>
          {onNavigateToCollecte && (
            <button
              type="button"
              onClick={onNavigateToCollecte}
              className="px-4 py-2 rounded-xl bg-lapis text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-lapis/90 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              Enregistrer une opération <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!hasRecordsInWindow && range !== 'all' && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-paper dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
              <span>
                Aucune transaction sur les {range === '7d' ? '7' : range === '14d' ? '14' : '30'} derniers jours ; la courbe affiche le report continu du solde Caisse Financement.
              </span>
              <button
                type="button"
                onClick={() => setRange('all')}
                className="font-bold text-lapis dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Afficher tout l&apos;historique
              </button>
            </div>
          )}

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: showCaisseLine ? 10 : 8, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="caisseBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.14} />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  minTickGap={16}
                  tick={{ fill: '#94A3B8', fontWeight: 500 }}
                  dy={8}
                />

                {showTxBars && (
                  <YAxis
                    yAxisId="tx"
                    axisLine={false}
                    tickLine={false}
                    fontSize={11}
                    tick={{ fill: '#94A3B8' }}
                    tickFormatter={formatAxisCurrency}
                  />
                )}

                {showCaisseLine && (
                  <YAxis
                    yAxisId="caisse"
                    orientation={showTxBars ? 'right' : 'left'}
                    axisLine={false}
                    tickLine={false}
                    fontSize={11}
                    tick={{ fill: '#10B981', fontWeight: 600 }}
                    tickFormatter={formatAxisCurrency}
                  />
                )}

                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={<CustomTrendsTooltip viewMode={viewMode} />}
                />

                {showTxBars && <ReferenceLine yAxisId="tx" y={0} stroke="#CBD5E1" strokeOpacity={0.4} />}

                {showTxBars && visibleSeries.depots && (
                  <Bar
                    yAxisId="tx"
                    dataKey="depots"
                    name="Dépôts"
                    fill="#1E3A8A"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                )}

                {showTxBars && visibleSeries.retraits && (
                  <Bar
                    yAxisId="tx"
                    dataKey="retraits"
                    name="Retraits"
                    fill="#E11D48"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                )}

                {showTxBars && visibleSeries.autresFlux && (
                  <Bar
                    yAxisId="tx"
                    dataKey="autresFlux"
                    name="Remb. / Financements"
                    fill="#D97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                )}

                {viewMode === 'transactions' && (
                  <Line
                    yAxisId="tx"
                    type="monotone"
                    dataKey="fluxNetTx"
                    name="Flux net quotidien"
                    stroke="#0EA5E9"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}

                {viewMode === 'caisse' && (
                  <>
                    <Bar
                      yAxisId="caisse"
                      dataKey="caisseEntrees"
                      name="Entrées Caisse"
                      fill="#059669"
                      fillOpacity={0.35}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                    />
                    <Bar
                      yAxisId="caisse"
                      dataKey="caisseSorties"
                      name="Décaissements Caisse"
                      fill="#E11D48"
                      fillOpacity={0.4}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                    />
                  </>
                )}

                {showCaisseLine && visibleSeries.soldeCaisse && (
                  <Area
                    yAxisId="caisse"
                    type="monotone"
                    dataKey="soldeCaisse"
                    name="Solde Caisse Financement"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#caisseBalanceGradient)"
                    dot={chartData.length <= 15 ? { r: 2.5, fill: '#10B981', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Series Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {showTxBars && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSeries('depots')}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      visibleSeries.depots
                        ? 'text-charcoal dark:text-slate-200 bg-paper dark:bg-slate-800 font-semibold'
                        : 'text-slate-400 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#1E3A8A]" />
                    Dépôts
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSeries('retraits')}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      visibleSeries.retraits
                        ? 'text-charcoal dark:text-slate-200 bg-paper dark:bg-slate-800 font-semibold'
                        : 'text-slate-400 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#E11D48]" />
                    Retraits
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSeries('autresFlux')}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      visibleSeries.autresFlux
                        ? 'text-charcoal dark:text-slate-200 bg-paper dark:bg-slate-800 font-semibold'
                        : 'text-slate-400 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706]" />
                    Remb. &amp; Financements
                  </button>
                </>
              )}
              {showCaisseLine && (
                <button
                  type="button"
                  onClick={() => toggleSeries('soldeCaisse')}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                    visibleSeries.soldeCaisse
                      ? 'text-charcoal dark:text-slate-200 bg-paper dark:bg-slate-800 font-semibold'
                      : 'text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className="w-3 h-0.5 bg-[#10B981]" />
                  Solde Caisse Financement
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400 tabular">
              {chartData.length} jour{chartData.length > 1 ? 's' : ''} affiché{chartData.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
