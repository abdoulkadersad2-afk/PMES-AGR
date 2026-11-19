import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
} from 'recharts';
import { CaisseMouvement, Corporation } from '../../types';
import { TrendingUp } from 'lucide-react';

interface CaisseFinancementChartProps {
  caisseMouvements: CaisseMouvement[];
  corporations?: Corporation[];
  className?: string;
  onNavigateToCorporations?: () => void;
}

const formatAxisFcfa = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
};

export const CaisseFinancementChart: React.FC<CaisseFinancementChartProps> = ({
  caisseMouvements = [],
  className = '',
}) => {
  const chartData = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const sorted = [...caisseMouvements]
      .filter(
        (m) =>
          m.type !== 'cotisation_sante' &&
          m.type !== 'assistance_sociale' &&
          !Number.isNaN(new Date(m.date).getTime())
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    const pointsWithBalance = sorted.map((m) => {
      const amount = Number(m.montant) || 0;
      if (m.type === 'decaissement') balance -= amount;
      else balance += amount;
      const d = new Date(m.date);
      return {
        ts: d.getTime(),
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        solde: balance,
      };
    });

    const recent = pointsWithBalance.filter((p) => p.ts >= cutoff);
    const displayPoints = recent.length > 0 ? recent : pointsWithBalance;
    return displayPoints.slice(-10).map(({ date, solde }) => ({ date, solde }));
  }, [caisseMouvements]);

  return (
    <div className={`p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-500" />
          Caisse Financement
        </h3>
      </div>

      <div className="h-64 w-full -ml-4">
        {chartData.length === 0 ? (
          <div className="h-full pl-4 flex items-center justify-center text-slate-400 text-xs italic">
            Aucun mouvement de caisse enregistré
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="colorCaisse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8', fontWeight: 600}} />
              <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#94a3b8'}} tickFormatter={formatAxisFcfa} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(value: unknown) => [`${Number(value || 0).toLocaleString('fr-FR')} F CFA`, 'Solde']}
              />
              <Area type="monotone" dataKey="solde" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCaisse)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
