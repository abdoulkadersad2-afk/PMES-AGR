import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
} from 'recharts';
import { Transaction, ZoneItem } from '../../types';
import { MapPin } from 'lucide-react';

interface ZoneActivityChartProps {
  transactions: Transaction[];
  zones: ZoneItem[];
  className?: string;
}

export const ZoneActivityChart: React.FC<ZoneActivityChartProps> = ({
  transactions,
  zones,
  className = '',
}) => {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { zone: string; depots: number; retraits: number }>();
    zones.forEach(z => dataMap.set(z.nom, { zone: z.nom, depots: 0, retraits: 0 }));

    transactions.forEach(t => {
      const zoneName = t.zone || 'Autre';
      const existing = dataMap.get(zoneName) || { zone: zoneName, depots: 0, retraits: 0 };
      if (t.type === 'depot') existing.depots += t.montant;
      else if (t.type === 'retrait') existing.retraits += t.montant;
      dataMap.set(zoneName, existing);
    });

    return Array.from(dataMap.values())
      .sort((a, b) => (b.depots + b.retraits) - (a.depots + a.retraits))
      .slice(0, 5); // Top 5 zones
  }, [transactions, zones]);

  const hasActivity = chartData.some((d) => d.depots > 0 || d.retraits > 0);

  return (
    <div className={`p-8 rounded-3xl bg-white dark:bg-slate-900 hairline shadow-sm space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-charcoal dark:text-white flex items-center gap-2">
          <MapPin size={18} className="text-gold" />
          Activité par Zone
        </h3>
      </div>

      <div className="h-64 w-full -ml-4">
        {!hasActivity ? (
          <div className="h-full pl-4 flex items-center justify-center text-slate-400 text-xs italic">
            Aucune activité enregistrée par zone
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="zone" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                fontSize={10} 
                tick={{fill: '#94a3b8', fontWeight: 600}}
                width={80}
              />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(v: unknown) => [`${Number(v || 0).toLocaleString('fr-FR')} F CFA`, 'Dépôts']}
              />
              <Bar dataKey="depots" fill="#1E3A8A" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
