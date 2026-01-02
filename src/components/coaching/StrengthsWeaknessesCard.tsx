/**
 * Strengths & Weaknesses Card Component
 * 
 * Displays identified strengths and weaknesses with impact levels
 */

'use client';

import React from 'react';
import type { Strength, Weakness } from '@/lib/coaching/types';

interface StrengthsWeaknessesCardProps {
  strengths: Strength[];
  weaknesses: Weakness[];
  loading?: boolean;
}

/**
 * Strengths & Weaknesses Card Component
 */
export function StrengthsWeaknessesCard({
  strengths,
  weaknesses,
  loading = false
}: StrengthsWeaknessesCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Strengths & Weaknesses</h3>
        <p className="text-sm text-gray-500">Key areas of performance</p>
      </div>

      {/* Strengths */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Strengths ({strengths.length})
        </h4>
        
        {strengths.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No strengths identified yet</p>
        ) : (
          <div className="space-y-3">
            {strengths.map((strength, idx) => (
              <StrengthItem key={idx} strength={strength} />
            ))}
          </div>
        )}
      </div>

      {/* Weaknesses */}
      <div>
        <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Areas for Improvement ({weaknesses.length})
        </h4>
        
        {weaknesses.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No weaknesses identified yet</p>
        ) : (
          <div className="space-y-3">
            {weaknesses.map((weakness, idx) => (
              <WeaknessItem key={idx} weakness={weakness} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Strength Item Component
 */
interface StrengthItemProps {
  strength: Strength;
}

function StrengthItem({ strength }: StrengthItemProps) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-green-200 bg-green-50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-semibold text-gray-900">{strength.title}</h5>
            <span className={`text-xs font-medium px-2 py-1 rounded ${getImpactColor(strength.impact)}`}>
              {strength.impact} impact
            </span>
          </div>
          <p className="text-xs text-gray-600">{strength.category.replace('_', ' ')}</p>
        </div>
      </div>
      
      <p className="text-sm text-gray-700 mb-3">{strength.description}</p>
      
      {/* Metrics */}
      {strength.metrics.length > 0 && (
        <div className="mb-3 space-y-1">
          {strength.metrics.map((metric, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{metric.metric}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-700">{metric.value.toFixed(1)}</span>
                <span className="text-gray-400">vs</span>
                <span className="text-gray-500">{metric.benchmark.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Leverage Strategy */}
      <div className="pt-3 border-t border-green-200">
        <p className="text-xs font-medium text-gray-700 mb-1">💡 How to Leverage</p>
        <p className="text-xs text-gray-600">{strength.leverageStrategy}</p>
      </div>
    </div>
  );
}

/**
 * Weakness Item Component
 */
interface WeaknessItemProps {
  weakness: Weakness;
}

function WeaknessItem({ weakness }: WeaknessItemProps) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return 'bg-red-100 text-red-800';
      case 'near_term':
        return 'bg-orange-100 text-orange-800';
      case 'long_term':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-semibold text-gray-900">{weakness.title}</h5>
            <span className={`text-xs font-medium px-2 py-1 rounded ${getImpactColor(weakness.impact)}`}>
              {weakness.impact} impact
            </span>
            <span className={`text-xs font-medium px-2 py-1 rounded ${getUrgencyColor(weakness.urgency)}`}>
              {weakness.urgency.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-600">{weakness.category.replace('_', ' ')}</p>
        </div>
      </div>
      
      <p className="text-sm text-gray-700 mb-3">{weakness.description}</p>
      
      {/* Metrics with Gaps */}
      {weakness.metrics.length > 0 && (
        <div className="mb-3 space-y-1">
          {weakness.metrics.map((metric, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{metric.metric}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-orange-700">{metric.value.toFixed(1)}</span>
                <span className="text-gray-400">vs</span>
                <span className="text-gray-500">{metric.benchmark.toFixed(1)}</span>
                <span className="text-red-600">(gap: {metric.gap.toFixed(1)})</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Root Causes */}
      {weakness.rootCauses.length > 0 && (
        <div className="pt-3 border-t border-orange-200">
          <p className="text-xs font-medium text-gray-700 mb-1">🔍 Root Causes</p>
          <ul className="text-xs text-gray-600 space-y-1">
            {weakness.rootCauses.map((cause, idx) => (
              <li key={idx} className="flex items-start gap-1">
                <span className="text-orange-600">•</span>
                <span>{cause}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
