import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Transaction } from '../../types';

interface SavingsEvolutionChartProps {
  transactions: Transaction[];
}

export const SavingsEvolutionChart: React.FC<SavingsEvolutionChartProps> = ({ transactions }) => {
  const chartData = useMemo(() => {
    const deposits = transactions.filter(t => t.type === 'depot');
    const monthlyGroups: Record<string, { label: string, total: number, timestamp: number }> = {};
    
    deposits.forEach(t => {
      const date = new Date(t.date);
      if (Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date);
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          label: monthLabel,
          total: 0,
          timestamp: new Date(date.getFullYear(), date.getMonth(), 1).getTime()
        };
      }
      monthlyGroups[monthKey].total += t.montant;
    });

    return Object.values(monthlyGroups)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6); // Last 6 months for clean dashboard
  }, [transactions]);

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
        Données insuffisantes
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
        <XAxis 
          dataKey="label" 
          axisLine={false} 
          tickLine={false} 
          fontSize={10} 
          tick={{fill: '#94a3b8', fontWeight: 600}} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          fontSize={10} 
          tick={{fill: '#94a3b8'}} 
          tickFormatter={(v) => {
            const abs = Math.abs(v);
            if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
            return `${Math.round(v)}`;
          }}
        />
        <Tooltip 
          contentStyle={{ 
            borderRadius: '12px', 
            border: 'none', 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            backgroundColor: '#1C1917',
            color: '#fff'
          }}
          itemStyle={{ color: '#fbbf24' }}
          labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
          formatter={(value: unknown) => [`${Number(value || 0).toLocaleString('fr-FR')} F CFA`, 'Épargne']}
        />
        <Area 
          type="monotone" 
          dataKey="total" 
          stroke="#1E3A8A" 
          strokeWidth={3} 
          fillOpacity={1} 
          fill="url(#colorSavings)" 
          animationDuration={1500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
