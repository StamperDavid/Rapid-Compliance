'use client';

import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WinLossChartProps {
  winLossData: {
    won: number;
    lost: number;
  };
  lossReasons?: Array<{
    reason: string;
    count: number;
    value: number;
  }>;
  type?: 'pie' | 'bar';
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload?: {
    value?: number;
    [key: string]: unknown;
  };
}

export default function WinLossChart({ winLossData, lossReasons, type = 'pie' }: WinLossChartProps) {
  const successColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || 'var(--color-success)'
    : 'var(--color-success)';

  const errorColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-error').trim() || 'var(--color-error)'
    : 'var(--color-error)';

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';

  const pieData = [
    { name: 'Won', value: winLossData.won },
    { name: 'Lost', value: winLossData.lost },
  ];

  const COLORS = [successColor, errorColor];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) => {
    if (active && payload?.length) {
      return (
        <div style={{
          backgroundColor: 'var(--color-bg-elevated)',
          border: `1px solid ${borderColor}`,
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          {payload.map((entry, index) => (
            <div key={index} style={{ color: entry.color, marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: '600' }}>{entry.name}: </span>
              <span>{entry.value}</span>
              {entry.payload?.value && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-secondary)' }}>
                  (${entry.payload.value.toLocaleString()})
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'pie') {
    return (
      <div style={{ width: '100%', height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="var(--color-primary)"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: textColor }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Bar chart for loss reasons
  if (lossReasons && lossReasons.length > 0) {
    return (
      <div style={{ width: '100%', height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lossReasons} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={borderColor} opacity={0.3} />
            <XAxis 
              dataKey="reason" 
              stroke={textColor}
              style={{ fontSize: '0.875rem' }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis 
              stroke={textColor}
              style={{ fontSize: '0.875rem' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ color: textColor }}
            />
            <Bar dataKey="count" name="Count" fill={errorColor} radius={[4, 4, 0, 0]} />
            <Bar dataKey="value" name="Value" fill={successColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

























