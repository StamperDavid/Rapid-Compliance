'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface PipelineChartProps {
  data: Array<{
    stage: string;
    value: number;
    deals: number;
    averageDealSize?: number;
  }>;
  showDeals?: boolean;
}

export default function PipelineChart({ data, showDeals = false }: PipelineChartProps) {
  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';
  
  const secondaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#8b5cf6'
    : '#8b5cf6';

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  // Generate color variations for stages
  const colors = [
    primaryColor,
    secondaryColor,
    typeof window !== 'undefined' 
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ec4899'
      : '#ec4899',
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || '#10b981'
      : '#10b981',
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim() || '#f59e0b'
      : '#f59e0b',
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--color-bg-elevated)',
          border: `1px solid ${borderColor}`,
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color, marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: '600' }}>{entry.name}: </span>
              <span>${entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} opacity={0.3} />
          <XAxis 
            dataKey="stage" 
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis 
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: textColor }}
          />
          <Bar dataKey="value" name="Pipeline Value" fill={primaryColor} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
          {showDeals && (
            <Bar dataKey="deals" name="Deals" fill={secondaryColor} radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
















