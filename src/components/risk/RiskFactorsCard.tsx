/**
 * Risk Factors Card Component
 * 
 * Displays risk factors and protective factors
 */

'use client';

import React, { useState } from 'react';
import type { RiskFactor, ProtectiveFactor } from '@/lib/risk/types';

interface RiskFactorsCardProps {
  riskFactors: RiskFactor[];
  protectiveFactors: ProtectiveFactor[];
  loading?: boolean;
}

/**
 * Risk Factors Card Component
 */
export function RiskFactorsCard({ 
  riskFactors, 
  protectiveFactors,
  loading = false 
}: RiskFactorsCardProps) {
  const [showRisks, setShowRisks] = useState(true);

  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-surface-elevated rounded"></div>
          <div className="h-16 bg-surface-elevated rounded"></div>
          <div className="h-16 bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-surface-elevated text-gray-800 border-gray-300';
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'timing':
        return '⏰';
      case 'engagement':
        return '📞';
      case 'stakeholder':
        return '👥';
      case 'competition':
        return '⚔️';
      case 'budget':
        return '💰';
      case 'value_alignment':
        return '🎯';
      case 'technical':
        return '⚙️';
      case 'external':
        return '🌍';
      default:
        return '⚠️';
    }
  };

  // Get protective category icon
  const getProtectiveIcon = (category: string) => {
    switch (category) {
      case 'strong_engagement':
        return '💪';
      case 'executive_buy_in':
        return '👔';
      case 'proven_value':
        return '✨';
      case 'competitive_edge':
        return '🏆';
      case 'budget_approved':
        return '✅';
      case 'technical_fit':
        return '🔧';
      case 'urgency':
        return '⚡';
      case 'past_success':
        return '📈';
      default:
        return '✓';
    }
  };

  return (
    <div className="bg-surface-main rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Deal Analysis</h3>
        
        {/* Toggle Tabs */}
        <div className="flex space-x-2 bg-surface-elevated p-1 rounded-lg">
          <button
            onClick={() => setShowRisks(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              showRisks
                ? 'bg-surface-main text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Risk Factors ({riskFactors.length})
          </button>
          <button
            onClick={() => setShowRisks(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !showRisks
                ? 'bg-surface-main text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Protective Factors ({protectiveFactors.length})
          </button>
        </div>
      </div>

      {/* Risk Factors */}
      {showRisks && (
        <div className="space-y-4">
          {riskFactors.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-disabled)]">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm">No significant risk factors detected</p>
            </div>
          ) : (
            riskFactors.map((factor, _index) => (
              <div key={factor.id} className="border border-border-light rounded-lg p-4 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{getCategoryIcon(factor.category)}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {factor.description}
                      </h4>
                      <p className="text-xs text-[var(--color-text-disabled)] capitalize">{factor.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(factor.severity)}`}>
                    {factor.severity.toUpperCase()}
                  </span>
                </div>

                {/* Impact Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-disabled)] mb-1">
                    <span>Impact</span>
                    <span>{factor.impact.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        factor.severity === 'critical' ? 'bg-red-600' :
                        factor.severity === 'high' ? 'bg-orange-600' :
                        factor.severity === 'medium' ? 'bg-yellow-600' :
                        'bg-blue-600'
                      }`}
                      style={{ width: `${factor.impact}%` }}
                    ></div>
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-sm text-[var(--color-text-disabled)] mb-2">
                  {factor.reasoning}
                </p>

                {/* Values */}
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center">
                    <span className="text-[var(--color-text-disabled)] mr-1">Current:</span>
                    <span className="font-medium text-red-600">{factor.currentValue}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[var(--color-text-disabled)] mr-1">Expected:</span>
                    <span className="font-medium text-green-600">{factor.expectedValue}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Protective Factors */}
      {!showRisks && (
        <div className="space-y-4">
          {protectiveFactors.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-disabled)]">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-sm">No protective factors detected</p>
            </div>
          ) : (
            protectiveFactors.map((factor) => (
              <div key={factor.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                {/* Header */}
                <div className="flex items-start mb-2">
                  <span className="text-2xl mr-2">{getProtectiveIcon(factor.category)}</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {factor.description}
                    </h4>
                    <p className="text-xs text-[var(--color-text-disabled)] capitalize">{factor.category.replace('_', ' ')}</p>
                  </div>
                </div>

                {/* Strength Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-disabled)] mb-1">
                    <span>Strength</span>
                    <span>{factor.strength.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${factor.strength}%` }}
                    ></div>
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-sm text-[var(--color-text-disabled)]">
                  {factor.reasoning}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
