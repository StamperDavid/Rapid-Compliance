'use client';

import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    deals?: number;
    averageDealSize?: number;
  }>;
  type?: 'line' | 'bar';
  showDeals?: boolean;
  showAverage?: boolean;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload?: Record<string, unknown>;
}

export default function RevenueChart({ data, type = 'line', showDeals = false, showAverage = false }: RevenueChartProps) {
  // Get theme colors from CSS variables
  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';
  
  const secondaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#8b5cf6'
    : '#8b5cf6';
  
  const accentColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ec4899'
    : '#ec4899';

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  const ChartComponent = type === 'line' ? LineChart : BarChart;
  const DataComponent = type === 'line' ? Line : Bar;

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
        <ChartComponent data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
          />
          <YAxis
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
            tickFormatter={(value: number) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: textColor }}
            iconType="line"
          />
          <DataComponent 
            type="monotone" 
            dataKey="revenue" 
            stroke={primaryColor}
            fill={primaryColor}
            name="Revenue"
            strokeWidth={2}
          />
          {showDeals && (
            <DataComponent
              type="monotone"
              dataKey="deals"
              stroke={secondaryColor}
              fill={secondaryColor}
              name="Deals"
              strokeWidth={2}
            />
          )}
          {showAverage && (
            <DataComponent
              type="monotone"
              dataKey="averageDealSize"
              stroke={accentColor}
              fill={accentColor}
              name="Avg Deal Size"
              strokeWidth={2}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

























