'use client';

import Tooltip from '@/components/Tooltip';

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  icon?: string;
  tooltip?: string;
}

export function MetricCard({ label, value, change, icon, tooltip }: MetricCardProps) {
  const card = (
    <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6 cursor-default hover:border-[var(--color-primary)] transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{label}</p>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
        {icon && <div className="text-4xl opacity-30">{icon}</div>}
      </div>
      {change && <div className="text-sm text-[var(--color-text-secondary)]">{change}</div>}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{card}</Tooltip>;
  }

  return card;
}
