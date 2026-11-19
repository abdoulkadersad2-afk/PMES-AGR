import React from 'react';

interface GoalProgressRingProps {
  current: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const GoalProgressRing: React.FC<GoalProgressRingProps> = ({
  current,
  target,
  size = 64,
  strokeWidth = 6,
  className = '',
}) => {
  const safeTarget = Math.max(0, target);
  const rawPct = safeTarget > 0 ? Math.round((current / safeTarget) * 100) : 0;
  const clampedPct = safeTarget > 0 ? Math.min(100, Math.max(0, (current / safeTarget) * 100)) : 0;
  const isCompleted = safeTarget > 0 && current >= safeTarget;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  const fontSizeClass = size >= 80 ? 'text-base' : size >= 56 ? 'text-xs' : 'text-[10px]';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, rawPct))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progression vers l'objectif : ${rawPct}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-700 ease-out ${
            isCompleted ? 'text-emerald-500' : 'text-gold'
          }`}
        />
      </svg>
      <span
        className={`absolute font-display font-bold tabular-nums ${fontSizeClass} ${
          isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-charcoal dark:text-white'
        }`}
      >
        {rawPct}%
      </span>
    </div>
  );
};
