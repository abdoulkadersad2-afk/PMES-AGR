import React, { useMemo, useState } from 'react';
import { CalendarDays, Flame, Award, CheckCircle2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Transaction } from '../../types';

export interface MemberSavingsHeatmapProps {
  transactions: Transaction[];
  className?: string;
}

interface DayAggregate {
  depots: number;
  retraits: number;
  depotCount: number;
  retraitCount: number;
}

interface HeatmapCell {
  key: string;
  date: Date;
  inRange: boolean;
  isToday: boolean;
  depots: number;
  retraits: number;
  depotCount: number;
  retraitCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface MonthLabel {
  colIndex: number;
  label: string;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFCFA(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} F CFA`;
}

function getLevelClasses(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 1:
      return 'bg-emerald-200 dark:bg-emerald-950/90 border-emerald-300/80 dark:border-emerald-800/80';
    case 2:
      return 'bg-emerald-300 dark:bg-emerald-800 border-emerald-400/80 dark:border-emerald-700';
    case 3:
      return 'bg-emerald-500 dark:bg-emerald-600 border-emerald-600/70 dark:border-emerald-500';
    case 4:
      return 'bg-emerald-700 dark:bg-emerald-400 border-emerald-800/70 dark:border-emerald-300';
    case 0:
    default:
      return 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/70';
  }
}

const WEEKDAY_ROWS = [
  { index: 0, label: 'Lun' },
  { index: 1, label: '' },
  { index: 2, label: 'Mer' },
  { index: 3, label: '' },
  { index: 4, label: 'Ven' },
  { index: 5, label: '' },
  { index: 6, label: '' },
];

export const MemberSavingsHeatmap: React.FC<MemberSavingsHeatmapProps> = ({
  transactions = [],
  className = '',
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const {
    weeks,
    monthLabels,
    cellMap,
    activeDays,
    totalDeposited,
    totalDepositCount,
    currentStreak,
    bestStreak,
    consistencyPct,
    latestActiveKey,
    todayKey,
    windowLabel,
  } = useMemo(() => {
    const dailyMap = new Map<string, DayAggregate>();

    transactions.forEach((tx) => {
      if (tx.type !== 'depot' && tx.type !== 'retrait') return;
      const parsed = new Date(tx.date);
      if (Number.isNaN(parsed.getTime())) return;

      const localDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      const key = toLocalDateKey(localDay);
      const current = dailyMap.get(key) || {
        depots: 0,
        retraits: 0,
        depotCount: 0,
        retraitCount: 0,
      };
      const amount = Math.max(0, Number(tx.montant) || 0);

      if (tx.type === 'depot') {
        current.depots += amount;
        current.depotCount += 1;
      } else {
        current.retraits += amount;
        current.retraitCount += 1;
      }

      dailyMap.set(key, current);
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = toLocalDateKey(today);

    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 364);
    const windowStartTs = windowStart.getTime();
    const todayTs = today.getTime();

    // Collect positive daily deposit values in the past 365 days for quantile scaling
    const positiveDeposits: number[] = [];
    let daysWithDeposits = 0;
    let sumDeposited = 0;
    let sumDepositCount = 0;
    let runningStreak = 0;
    let maxStreak = 0;
    let mostRecentActiveKey: string | null = null;

    const scanCursor = new Date(windowStart);
    while (scanCursor.getTime() <= todayTs) {
      const k = toLocalDateKey(scanCursor);
      const agg = dailyMap.get(k);
      const depots = agg?.depots || 0;

      if (depots > 0) {
        positiveDeposits.push(depots);
        daysWithDeposits += 1;
        sumDeposited += depots;
        sumDepositCount += agg?.depotCount || 0;
        runningStreak += 1;
        if (runningStreak > maxStreak) {
          maxStreak = runningStreak;
        }
        mostRecentActiveKey = k;
      } else {
        runningStreak = 0;
      }

      scanCursor.setDate(scanCursor.getDate() + 1);
    }

    // Current streak: count backwards from today (or yesterday if no deposit yet today)
    let activeCurrentStreak = 0;
    const streakCursor = new Date(today);
    const todayDepots = dailyMap.get(todayStr)?.depots || 0;
    if (todayDepots <= 0) {
      streakCursor.setDate(streakCursor.getDate() - 1);
    }
    while (streakCursor.getTime() >= windowStartTs) {
      const k = toLocalDateKey(streakCursor);
      if ((dailyMap.get(k)?.depots || 0) > 0) {
        activeCurrentStreak += 1;
        streakCursor.setDate(streakCursor.getDate() - 1);
      } else {
        break;
      }
    }

    positiveDeposits.sort((a, b) => a - b);
    const getQuantile = (arr: number[], q: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((arr.length - 1) * q)));
      return arr[idx];
    };

    const q25 = getQuantile(positiveDeposits, 0.25);
    const q50 = getQuantile(positiveDeposits, 0.5);
    const q75 = getQuantile(positiveDeposits, 0.75);
    const allEqualPositive =
      positiveDeposits.length > 0 &&
      positiveDeposits[0] === positiveDeposits[positiveDeposits.length - 1];

    const resolveLevel = (depots: number): 0 | 1 | 2 | 3 | 4 => {
      if (depots <= 0) return 0;
      if (allEqualPositive) return 3;
      if (depots <= q25) return 1;
      if (depots <= q50) return 2;
      if (depots <= q75) return 3;
      return 4;
    };

    // Align grid start to Monday and grid end to Sunday
    const startDow = (windowStart.getDay() + 6) % 7;
    const gridStart = new Date(windowStart);
    gridStart.setDate(gridStart.getDate() - startDow);

    const endDow = (today.getDay() + 6) % 7;
    const gridEnd = new Date(today);
    gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

    const builtWeeks: HeatmapCell[][] = [];
    const mapByKey = new Map<string, HeatmapCell>();
    const monthShortFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const labels: MonthLabel[] = [];
    let lastLabeledMonth = -1;
    let lastLabeledCol = -4;

    const cursor = new Date(gridStart);
    let currentWeek: HeatmapCell[] = [];

    while (cursor.getTime() <= gridEnd.getTime()) {
      const cellDate = new Date(cursor);
      const key = toLocalDateKey(cellDate);
      const ts = cellDate.getTime();
      const inRange = ts >= windowStartTs && ts <= todayTs;
      const agg = inRange ? dailyMap.get(key) : undefined;
      const depots = agg?.depots || 0;

      const cell: HeatmapCell = {
        key,
        date: cellDate,
        inRange,
        isToday: key === todayStr,
        depots,
        retraits: agg?.retraits || 0,
        depotCount: agg?.depotCount || 0,
        retraitCount: agg?.retraitCount || 0,
        level: inRange ? resolveLevel(depots) : 0,
      };

      currentWeek.push(cell);
      if (inRange) {
        mapByKey.set(key, cell);
      }

      if (currentWeek.length === 7) {
        const colIdx = builtWeeks.length;
        // Find first in-range day of month=1 or first in-range day in column
        const firstDayInMonth = currentWeek.find((c) => c.inRange && c.date.getDate() === 1);
        const anchorCell = firstDayInMonth || currentWeek.find((c) => c.inRange);

        if (anchorCell) {
          const monthIdx = anchorCell.date.getMonth();
          const shouldPlaceLabel =
            monthIdx !== lastLabeledMonth &&
            (firstDayInMonth !== undefined || colIdx === 0) &&
            colIdx - lastLabeledCol >= 2;

          if (shouldPlaceLabel) {
            const raw = monthShortFmt.format(anchorCell.date).replace('.', '');
            const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
            labels.push({ colIndex: colIdx, label: capitalized });
            lastLabeledMonth = monthIdx;
            lastLabeledCol = colIdx;
          }
        }

        builtWeeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const rangeFmt = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return {
      weeks: builtWeeks,
      monthLabels: labels,
      cellMap: mapByKey,
      activeDays: daysWithDeposits,
      totalDeposited: sumDeposited,
      totalDepositCount: sumDepositCount,
      currentStreak: activeCurrentStreak,
      bestStreak: maxStreak,
      consistencyPct: Math.round((daysWithDeposits / 365) * 100),
      latestActiveKey: mostRecentActiveKey,
      todayKey: todayStr,
      windowLabel: `${rangeFmt.format(windowStart)} – ${rangeFmt.format(today)}`,
    };
  }, [transactions]);

  const activeInspectKey = hoveredKey || pinnedKey || latestActiveKey || todayKey;
  const inspectedCell = cellMap.get(activeInspectKey) || cellMap.get(todayKey) || null;

  const fullDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const monthLabelByCol = useMemo(() => {
    const map = new Map<number, string>();
    monthLabels.forEach((m) => map.set(m.colIndex, m.label));
    return map;
  }, [monthLabels]);

  return (
    <section
      aria-label="Calendrier de régularité de l'épargne sur un an"
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="font-display font-bold text-lg text-charcoal dark:text-white">
              Régularité Quotidienne (12 derniers mois)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualisez la constance de vos dépôts jour après jour sur l&apos;année écoulée ({windowLabel}).
          </p>
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-xl bg-paper dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Moins</span>
          <div className="flex items-center gap-1" aria-hidden="true">
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`w-3 h-3 rounded-[3px] border ${getLevelClasses(lvl)}`}
              />
            ))}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Plus</span>
        </div>
      </div>

      {/* Consistency KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-slate-100 dark:border-slate-800 lg:divide-x lg:divide-slate-100 dark:lg:divide-slate-800">
        <div className="pr-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Jours épargnés</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-display font-bold font-mono tabular text-charcoal dark:text-white">
              {activeDays} j
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular">
              ({consistencyPct}% / 365j)
            </span>
          </div>
        </div>

        <div className="lg:px-5 pr-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Flame size={13} className="text-gold" />
            <span>Série actuelle</span>
          </div>
          <div className="text-lg font-display font-bold font-mono tabular text-charcoal dark:text-white">
            {currentStreak} {currentStreak > 1 ? 'jours' : 'jour'}
          </div>
        </div>

        <div className="lg:px-5 pr-4 pt-2 lg:pt-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Award size={13} className="text-lapis dark:text-blue-400" />
            <span>Meilleure série</span>
          </div>
          <div className="text-lg font-display font-bold font-mono tabular text-charcoal dark:text-white">
            {bestStreak} {bestStreak > 1 ? 'jours' : 'jour'}
          </div>
        </div>

        <div className="lg:pl-5 pt-2 lg:pt-0 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total déposé (1 an)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-display font-bold font-mono tabular text-emerald-600 dark:text-emerald-400">
              {formatFCFA(totalDeposited)}
            </span>
            {totalDepositCount > 0 && (
              <span className="text-[11px] font-mono text-slate-400 tabular">
                ({totalDepositCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Matrix */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col min-w-max">
          {/* Month Headers */}
          <div className="flex items-center mb-1.5">
            <div className="w-8 shrink-0" aria-hidden="true" />
            <div className="flex gap-[3px]">
              {weeks.map((_, colIdx) => {
                const label = monthLabelByCol.get(colIdx);
                return (
                  <div
                    key={colIdx}
                    className="w-3 text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-none overflow-visible whitespace-nowrap"
                  >
                    {label || ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekday Labels + 7-row Week Columns */}
          <div className="flex items-start">
            <div className="w-8 shrink-0 flex flex-col gap-[3px] pr-2" aria-hidden="true">
              {WEEKDAY_ROWS.map((row) => (
                <div
                  key={row.index}
                  className="h-3 flex items-center text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-none"
                >
                  {row.label}
                </div>
              ))}
            </div>

            <div className="flex gap-[3px]" role="grid" aria-label="Grille quotidienne d'épargne">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-[3px]" role="row">
                  {week.map((cell) => {
                    if (!cell.inRange) {
                      return (
                        <div
                          key={cell.key}
                          className="w-3 h-3 rounded-[3px] opacity-0 pointer-events-none"
                          aria-hidden="true"
                        />
                      );
                    }

                    const isSelected = inspectedCell?.key === cell.key;
                    const formattedDate = fullDateFmt.format(cell.date);
                    const ariaText =
                      cell.depots > 0
                        ? `${formattedDate} : ${formatFCFA(cell.depots)} déposés (${cell.depotCount} dépôt${cell.depotCount > 1 ? 's' : ''})`
                        : `${formattedDate} : Aucun dépôt`;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        role="gridcell"
                        aria-label={ariaText}
                        aria-pressed={pinnedKey === cell.key}
                        onMouseEnter={() => setHoveredKey(cell.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        onFocus={() => setHoveredKey(cell.key)}
                        onBlur={() => setHoveredKey(null)}
                        onClick={() =>
                          setPinnedKey((prev) => (prev === cell.key ? null : cell.key))
                        }
                        className={`w-3 h-3 rounded-[3px] border transition-transform duration-150 cursor-pointer focus:outline-none ${getLevelClasses(
                          cell.level
                        )} ${
                          isSelected
                            ? 'ring-2 ring-lapis dark:ring-gold ring-offset-1 ring-offset-white dark:ring-offset-slate-900 scale-110 z-10'
                            : cell.isToday
                            ? 'ring-1 ring-lapis/60 dark:ring-blue-400/70'
                            : 'hover:scale-110'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected / Hovered Day Detail Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-paper dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
        {inspectedCell ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-3 h-3 rounded-[3px] border shrink-0 ${getLevelClasses(
                  inspectedCell.level
                )}`}
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-charcoal dark:text-white capitalize truncate">
                {fullDateFmt.format(inspectedCell.date)}
                {inspectedCell.isToday ? ' (Aujourd’hui)' : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              {inspectedCell.depots > 0 ? (
                <div className="inline-flex items-center gap-1.5 font-mono font-bold tabular text-emerald-600 dark:text-emerald-400">
                  <ArrowDownRight size={14} />
                  <span>+{formatFCFA(inspectedCell.depots)}</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    ({inspectedCell.depotCount} dépôt{inspectedCell.depotCount > 1 ? 's' : ''})
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Aucun dépôt enregistré ce jour
                </span>
              )}

              {inspectedCell.retraits > 0 && (
                <div className="inline-flex items-center gap-1 font-mono font-semibold tabular text-rose-600 dark:text-rose-400">
                  <ArrowUpRight size={14} />
                  <span>-{formatFCFA(inspectedCell.retraits)}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Survolez ou sélectionnez une journée pour inspecter vos dépôts.
          </span>
        )}
      </div>
    </section>
  );
};
