'use client';

/**
 * Performance Trends Chart Component
 * 
 * Displays sequence performance metrics over time:
 * - Reply rate trend line
 * - Open rate trend line
 * - Click rate trend line
 * - Daily/Weekly aggregation
 * 
 * Hunter-Closer compliant - native SVG chart, no third-party libraries (Chart.js, Recharts, etc).
 */

import React, { useState } from 'react';

export interface TrendDataPoint {
  date: Date;
  replyRate: number;
  openRate: number;
  clickRate: number;
  sent: number;
}

interface PerformanceTrendsChartProps {
  data: TrendDataPoint[];
  title?: string;
  height?: number;
}

export function PerformanceTrendsChart({
  data,
  title = 'Performance Trends',
  height = 300,
}: PerformanceTrendsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'reply' | 'open' | 'click' | 'all'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
        <p style={{ color: 'var(--color-text-disabled)' }}>No trend data available for this date range</p>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate chart dimensions
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxRate = Math.max(
    ...sortedData.map(d => Math.max(d.replyRate, d.openRate, d.clickRate))
  );
  const yScale = (value: number) => chartHeight - (value / maxRate) * chartHeight;
  const xScale = (index: number) => (index / (sortedData.length - 1)) * chartWidth;

  // Generate path for line chart
  const generatePath = (dataKey: 'replyRate' | 'openRate' | 'clickRate') => {
    return sortedData
      .map((point, index) => {
        const x = padding.left + xScale(index);
        const y = padding.top + yScale(point[dataKey]);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const metrics = [
    {
      key: 'reply' as const,
      label: 'Reply Rate',
      color: 'var(--color-success)',
      path: generatePath('replyRate'),
      visible: selectedMetric === 'all' || selectedMetric === 'reply',
    },
    {
      key: 'open' as const,
      label: 'Open Rate',
      color: 'var(--color-primary)',
      path: generatePath('openRate'),
      visible: selectedMetric === 'all' || selectedMetric === 'open',
    },
    {
      key: 'click' as const,
      label: 'Click Rate',
      color: 'var(--color-warning)',
      path: generatePath('clickRate'),
      visible: selectedMetric === 'all' || selectedMetric === 'click',
    },
  ];

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: '1px solid var(--color-border-light)',
      borderRadius: '1rem',
      padding: '1.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        
        {/* Metric Filter */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSelectedMetric('all')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: selectedMetric === 'all' ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
              color: selectedMetric === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            All
          </button>
          {metrics.map(metric => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: selectedMetric === metric.key ? metric.color : 'var(--color-bg-elevated)',
                color: selectedMetric === metric.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                border: `1px solid ${selectedMetric === metric.key ? metric.color : 'var(--color-border-light)'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart SVG */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <svg
          width={width}
          height={height}
          style={{ display: 'block' }}
        >
          {/* Y-axis grid lines */}
          {[0, 25, 50, 75, 100].map(value => {
            const y = padding.top + yScale(value);
            return (
              <g key={value}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--color-bg-elevated)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="var(--color-text-disabled)"
                  fontSize="12"
                  textAnchor="end"
                >
                  {value}%
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {sortedData.map((point, index) => {
            if (sortedData.length > 10 && index % Math.ceil(sortedData.length / 10) !== 0) {
              return null;
            }
            const x = padding.left + xScale(index);
            return (
              <text
                key={index}
                x={x}
                y={height - padding.bottom + 20}
                fill="#666"
                fontSize="11"
                textAnchor="middle"
              >
                {point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          })}

          {/* Trend lines */}
          {metrics.map(metric => (
            metric.visible && (
              <path
                key={metric.key}
                d={metric.path}
                fill="none"
                stroke={metric.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )
          ))}

          {/* Data points */}
          {metrics.map(metric => (
            metric.visible && sortedData.map((point, index) => {
              const x = padding.left + xScale(index);
              const y = padding.top + yScale(point[`${metric.key}Rate` as keyof TrendDataPoint] as number);
              return (
                <circle
                  key={`${metric.key}-${index}`}
                  cx={x}
                  cy={y}
                  r={hoveredPoint === index ? 6 : 4}
                  fill={metric.color}
                  stroke="var(--color-bg-main)"
                  strokeWidth="2"
                  style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPoint !== null && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.5rem',
            padding: '1rem',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              {sortedData[hoveredPoint].date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.75rem' }}>
              {sortedData[hoveredPoint].sent} messages sent
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-success)' }}>Reply Rate:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {sortedData[hoveredPoint].replyRate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-primary)' }}>Open Rate:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {sortedData[hoveredPoint].openRate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-warning)' }}>Click Rate:</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  {sortedData[hoveredPoint].clickRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '2rem',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--color-bg-elevated)',
      }}>
        {metrics.map(metric => (
          <div
            key={metric.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: metric.visible ? 1 : 0.5,
            }}
          >
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: metric.color,
            }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {metric.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generate mock trend data from current analytics
 * (In production, this would come from time-series data in Firestore)
 */
export function generateTrendDataFromAnalytics(
  sequences: Array<{ totalSent: number; totalDelivered: number; totalOpened: number; totalClicked: number; totalReplied: number }>,
  dateRange: { startDate: Date; endDate: Date }
): TrendDataPoint[] {
  const days = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
  const points: TrendDataPoint[] = [];

  // Generate data points for each day
  for (let i = 0; i <= days; i++) {
    const date = new Date(dateRange.startDate);
    date.setDate(date.getDate() + i);

    // Calculate cumulative metrics (simplified - in production would be actual daily data)
    const progress = i / days;
    const totalSent = sequences.reduce((sum, seq) => sum + seq.totalSent, 0);
    const totalDelivered = sequences.reduce((sum, seq) => sum + seq.totalDelivered, 0);
    const totalOpened = sequences.reduce((sum, seq) => sum + seq.totalOpened, 0);
    const totalClicked = sequences.reduce((sum, seq) => sum + seq.totalClicked, 0);
    const totalReplied = sequences.reduce((sum, seq) => sum + seq.totalReplied, 0);

    // Add some variance to make the chart more realistic
    const variance = (Math.random() - 0.5) * 0.1;

    points.push({
      date,
      sent: Math.floor(totalSent * progress),
      replyRate: totalDelivered > 0 ? ((totalReplied / totalDelivered) * 100 * progress * (1 + variance)) : 0,
      openRate: totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100 * progress * (1 + variance)) : 0,
      clickRate: totalDelivered > 0 ? ((totalClicked / totalDelivered) * 100 * progress * (1 + variance)) : 0,
    });
  }

  return points;
}
