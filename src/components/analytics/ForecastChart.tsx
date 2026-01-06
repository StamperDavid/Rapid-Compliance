'use client';

import React from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ForecastChartProps {
  data: Array<{
    date: string;
    forecasted: number;
    bestCase?: number;
    worstCase?: number;
    actual?: number;
  }>;
  showConfidence?: boolean;
}

export default function ForecastChart({ data, showConfidence = true }: ForecastChartProps) {
  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';
  
  const successColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || '#10b981'
    : '#10b981';

  const errorColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-error').trim() || '#ef4444'
    : '#ef4444';

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  const ChartComponent = showConfidence ? AreaChart : LineChart;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
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
        <ChartComponent data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
            {showConfidence && (
              <>
                <linearGradient id="colorBestCase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={successColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={successColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWorstCase" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={errorColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={errorColor} stopOpacity={0} />
                </linearGradient>
              </>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
          />
          <YAxis 
            stroke={textColor}
            style={{ fontSize: '0.875rem' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: textColor }}
            iconType="line"
          />
          {showConfidence && data.some(d => d.worstCase) && (
            <Area
              type="monotone"
              dataKey="worstCase"
              stroke={errorColor}
              fillOpacity={0.1}
              fill="url(#colorWorstCase)"
              name="Worst Case"
            />
          )}
          {showConfidence && data.some(d => d.bestCase) && (
            <Area
              type="monotone"
              dataKey="bestCase"
              stroke={successColor}
              fillOpacity={0.1}
              fill="url(#colorBestCase)"
              name="Best Case"
            />
          )}
          <Area
            type="monotone"
            dataKey="forecasted"
            stroke={primaryColor}
            strokeWidth={2}
            fillOpacity={0.3}
            fill="url(#colorForecast)"
            name="Forecast"
          />
          {data.some(d => d.actual) && (
            <Line
              type="monotone"
              dataKey="actual"
              stroke={textColor}
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Actual"
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

