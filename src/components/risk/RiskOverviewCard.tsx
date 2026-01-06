/**
 * Risk Overview Card Component
 * 
 * Displays overall risk level, slippage probability, and key metrics
 */

'use client';

import React from 'react';
import type { DealRiskPrediction } from '@/lib/risk/types';

interface RiskOverviewCardProps {
  prediction: DealRiskPrediction;
  dealName: string;
  dealValue: number;
  loading?: boolean;
}

/**
 * Risk Overview Card Component
 */
export function RiskOverviewCard({ 
  prediction, 
  dealName,
  dealValue,
  loading = false 
}: RiskOverviewCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Get risk level color
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'minimal':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get probability color
  const getProbabilityColor = (prob: number) => {
    if (prob >= 80) {return 'text-red-600';}
    if (prob >= 60) {return 'text-orange-600';}
    if (prob >= 40) {return 'text-yellow-600';}
    if (prob >= 20) {return 'text-blue-600';}
    return 'text-green-600';
  };

  // Get probability background
  const getProbabilityBackground = (prob: number) => {
    if (prob >= 80) {return 'bg-red-50';}
    if (prob >= 60) {return 'bg-orange-50';}
    if (prob >= 40) {return 'bg-yellow-50';}
    if (prob >= 20) {return 'bg-blue-50';}
    return 'bg-green-50';
  };

  // Get trend icon
  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return '↗';
      case 'decreasing':
        return '↘';
      case 'stable':
      default:
        return '→';
    }
  };

  // Get trend color
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      case 'stable':
      default:
        return 'text-gray-600';
    }
  };

  const riskLevelLabel = prediction.riskLevel.toUpperCase();
  const revenueAtRisk = dealValue * (prediction.slippageProbability / 100);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Risk Overview</h3>
        <p className="text-sm text-gray-500">{dealName} · ${dealValue.toLocaleString()}</p>
      </div>

      {/* Probability Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className={`relative w-40 h-40 rounded-full ${getProbabilityBackground(prediction.slippageProbability)} flex items-center justify-center border-4 ${getRiskLevelColor(prediction.riskLevel)}`}>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getProbabilityColor(prediction.slippageProbability)}`}>
              {prediction.slippageProbability.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Slippage Risk</div>
          </div>
        </div>
      </div>

      {/* Risk Level Badge */}
      <div className="flex justify-center mb-6">
        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${getRiskLevelColor(prediction.riskLevel)}`}>
          {prediction.riskLevel === 'critical' && '🚨 '}
          {prediction.riskLevel === 'high' && '⚠️ '}
          {prediction.riskLevel === 'medium' && '⚡ '}
          {prediction.riskLevel === 'low' && '📊 '}
          {prediction.riskLevel === 'minimal' && '✅ '}
          {riskLevelLabel} RISK
        </span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="Loss Probability"
          value={`${prediction.lossProbability.toFixed(0)}%`}
          status={prediction.lossProbability >= 50 ? 'danger' : 'normal'}
        />
        <MetricCard
          label="Revenue at Risk"
          value={`$${revenueAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          status={prediction.riskLevel === 'critical' || prediction.riskLevel === 'high' ? 'danger' : 'normal'}
        />
        <MetricCard
          label="Risk Factors"
          value={prediction.riskFactors.length.toString()}
          status={prediction.riskFactors.length >= 5 ? 'warning' : 'normal'}
        />
        <MetricCard
          label="Interventions"
          value={prediction.interventions.length.toString()}
          status={prediction.interventions.length >= 3 ? 'success' : 'normal'}
        />
      </div>

      {/* Slippage Timeline */}
      {prediction.predictedSlippageDate && prediction.daysUntilSlippage && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Predicted Slippage</span>
            <span className="text-lg font-semibold text-orange-600">
              {prediction.daysUntilSlippage} days
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Expected: {prediction.predictedSlippageDate.toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Risk Trend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Risk Trend</span>
          <div className="flex items-center">
            <span className={`text-2xl mr-2 ${getTrendColor(prediction.trend.direction)}`}>
              {getTrendIcon(prediction.trend.direction)}
            </span>
            <span className="text-sm font-medium text-gray-900 capitalize">
              {prediction.trend.direction}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {prediction.trend.description}
        </div>
      </div>

      {/* Confidence */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Prediction Confidence</span>
          <span className="text-lg font-semibold text-gray-900">
            {prediction.confidence.toFixed(0)}%
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${prediction.confidence}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string;
  status?: 'danger' | 'warning' | 'success' | 'normal';
}

function MetricCard({ label, value, status = 'normal' }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'danger':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getValueColor = () => {
    switch (status) {
      case 'danger':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
      case 'success':
        return 'text-green-900';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className={`rounded-lg p-3 border ${getStatusColor()}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${getValueColor()}`}>{value}</div>
    </div>
  );
}
