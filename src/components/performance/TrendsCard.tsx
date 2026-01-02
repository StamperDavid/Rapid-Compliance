/**
 * Trends Card
 * 
 * Displays performance trends over time including risers, fallers,
 * and consistent performers with trend insights.
 * 
 * @module components/performance
 */

'use client';

import React from 'react';
import type { TrendAnalysis, TrendingRep } from '@/lib/performance';

interface TrendsCardProps {
  trendAnalysis: TrendAnalysis;
  loading?: boolean;
}

export function TrendsCard({
  trendAnalysis,
  loading = false,
}: TrendsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasRisers = trendAnalysis.risers.length > 0;
  const hasFallers = trendAnalysis.fallers.length > 0;
  const hasConsistent = trendAnalysis.consistent.length > 0;

  const getTrendIcon = (direction: 'improving' | 'declining' | 'stable') => {
    switch (direction) {
      case 'improving':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
        );
      case 'declining':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
          </svg>
        );
      case 'stable':
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getTrendColor = (direction: 'improving' | 'declining' | 'stable') => {
    switch (direction) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      case 'stable':
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
        <p className="text-sm text-gray-500 mt-1">
          Track changes and movement over time
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overall Trends */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <TrendBox
            label="Overall Score"
            trend={trendAnalysis.overallScoreTrend}
          />
          <TrendBox
            label="Sentiment"
            trend={trendAnalysis.sentimentTrend}
          />
          <TrendBox
            label="Quality"
            trend={trendAnalysis.qualityTrend}
          />
        </div>

        {/* Trend Insights */}
        {trendAnalysis.trendInsights.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Insights</h4>
            <ul className="space-y-1">
              {trendAnalysis.trendInsights.map((insight, idx) => (
                <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risers */}
        {hasRisers && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              Rising Stars
            </h4>
            <div className="space-y-2">
              {trendAnalysis.risers.map((rep) => (
                <RepTrendRow key={rep.repId} rep={rep} type="riser" />
              ))}
            </div>
          </div>
        )}

        {/* Fallers */}
        {hasFallers && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
              </svg>
              Needs Attention
            </h4>
            <div className="space-y-2">
              {trendAnalysis.fallers.map((rep) => (
                <RepTrendRow key={rep.repId} rep={rep} type="faller" />
              ))}
            </div>
          </div>
        )}

        {/* Consistent Performers */}
        {hasConsistent && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Consistent Performers
            </h4>
            <div className="space-y-2">
              {trendAnalysis.consistent.map((rep) => (
                <RepTrendRow key={rep.repId} rep={rep} type="consistent" />
              ))}
            </div>
          </div>
        )}

        {/* No Trend Data */}
        {!hasRisers && !hasFallers && !hasConsistent && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">Not enough historical data to show trends</p>
            <p className="text-xs mt-1">Trends will appear after multiple analysis periods</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TrendBoxProps {
  label: string;
  trend: {
    direction: 'improving' | 'declining' | 'stable';
    changePercentage: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

function TrendBox({ label, trend }: TrendBoxProps) {
  const getTrendColor = (direction: 'improving' | 'declining' | 'stable') => {
    switch (direction) {
      case 'improving':
        return 'bg-green-50 border-green-200';
      case 'declining':
        return 'bg-red-50 border-red-200';
      case 'stable':
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = (direction: 'improving' | 'declining' | 'stable') => {
    switch (direction) {
      case 'improving':
        return 'text-green-700';
      case 'declining':
        return 'text-red-700';
      case 'stable':
      default:
        return 'text-gray-700';
    }
  };

  const getTrendIcon = (direction: 'improving' | 'declining' | 'stable') => {
    switch (direction) {
      case 'improving':
        return '↗';
      case 'declining':
        return '↘';
      case 'stable':
      default:
        return '→';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getTrendColor(trend.direction)}`}>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold ${getTextColor(trend.direction)}`}>
          {getTrendIcon(trend.direction)}
        </span>
        <div>
          <div className={`text-sm font-semibold ${getTextColor(trend.direction)}`}>
            {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
          </div>
          {trend.changePercentage !== 0 && (
            <div className="text-xs text-gray-500">
              {trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RepTrendRowProps {
  rep: TrendingRep;
  type: 'riser' | 'faller' | 'consistent';
}

function RepTrendRow({ rep, type }: RepTrendRowProps) {
  const getIcon = () => {
    switch (type) {
      case 'riser':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'faller':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'consistent':
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'riser':
        return 'bg-green-50';
      case 'faller':
        return 'bg-red-50';
      case 'consistent':
      default:
        return 'bg-gray-50';
    }
  };

  const getChangeColor = () => {
    if (rep.scoreChange > 0) return 'text-green-600';
    if (rep.scoreChange < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className={`p-3 rounded-lg ${getBgColor()} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        {getIcon()}
        <div>
          <div className="font-medium text-gray-900">{rep.repName}</div>
          <div className="text-xs text-gray-600">{rep.description}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${getChangeColor()}`}>
          {rep.scoreChange > 0 ? '+' : ''}{rep.scoreChange.toFixed(1)}
        </div>
        {rep.rankChange !== 0 && (
          <div className="text-xs text-gray-500">
            {rep.rankChange > 0 ? '+' : ''}{rep.rankChange} ranks
          </div>
        )}
      </div>
    </div>
  );
}
