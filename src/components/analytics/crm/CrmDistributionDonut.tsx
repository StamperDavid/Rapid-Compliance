'use client';

import * as React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * A donut slice. Index signature included so the array is assignable to
 * recharts' `ChartDataInput[]` (Record<string, unknown>[]) without a cast.
 */
export type DonutSlice = {
  name: string;
  value: number;
  color: string;
  [key: string]: unknown;
};

interface CrmDistributionDonutProps {
  data: DonutSlice[];
  /** Accessible height for the chart area */
  height?: number;
}

interface TooltipEntry {
  name: string;
  value: number;
  payload?: { color?: string };
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (active && payload?.length) {
    const entry = payload[0];
    return (
      <div className="rounded-lg border border-border-main bg-surface-elevated px-3 py-2 text-sm shadow-md">
        <span className="font-semibold text-foreground">{entry.name}: </span>
        <span className="text-muted-foreground">{entry.value}</span>
      </div>
    );
  }
  return null;
}

/**
 * Reusable donut for CRM distributions (deal-health, lead-score buckets).
 * Colors are passed per slice so the parent controls semantics.
 */
export function CrmDistributionDonut({ data, height = 260 }: CrmDistributionDonutProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
