/**
 * Sequence Patterns Card Component
 * 
 * Displays high-performing patterns detected by AI analysis.
 * 
 * @module components/sequence/SequencePatternsCard
 */

'use client';

import React from 'react';
import type { SequenceAnalysis, SequencePattern } from '@/lib/sequence';
import { Lightbulb, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface SequencePatternsCardProps {
  analysis: SequenceAnalysis;
}

export function SequencePatternsCard({ analysis }: SequencePatternsCardProps) {
  const { patterns } = analysis;
  
  if (!patterns || patterns.total === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">High-Performing Patterns</h2>
          <p className="text-sm text-gray-600 mt-1">
            AI-detected patterns in top sequences
          </p>
        </div>
        <div className="text-center py-12">
          <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No patterns detected yet. Need more data.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">High-Performing Patterns</h2>
        <p className="text-sm text-gray-600 mt-1">
          {patterns.total} pattern{patterns.total !== 1 ? 's' : ''} detected • 
          {' '}{patterns.highConfidence} high confidence
        </p>
      </div>
      
      {/* Pattern Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded">
          <div className="text-2xl font-bold text-green-600">{patterns.highConfidence}</div>
          <div className="text-xs text-gray-600 mt-1">High Confidence</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded">
          <div className="text-2xl font-bold text-yellow-600">{patterns.mediumConfidence}</div>
          <div className="text-xs text-gray-600 mt-1">Medium Confidence</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-gray-600">{patterns.lowConfidence}</div>
          <div className="text-xs text-gray-600 mt-1">Low Confidence</div>
        </div>
      </div>
      
      {/* Top Patterns */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Top Patterns</h3>
        {patterns.topPatterns.map((pattern, index) => (
          <PatternCard key={index} pattern={pattern} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface PatternCardProps {
  pattern: SequencePattern;
  rank: number;
}

function PatternCard({ pattern, rank }: PatternCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  
  const confidenceColor = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  }[pattern.confidence];
  
  return (
    <div className="border rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                #{rank}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${confidenceColor}`}>
                {pattern.confidence} confidence
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                {pattern.type.replace('_', ' ')}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900">{pattern.name}</h4>
            <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
          </div>
          <TrendingUp className={`w-4 h-4 ml-4 ${expanded ? 'rotate-180' : ''} transition-transform`} />
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-3">
          <LiftBadge label="Reply" value={pattern.replyLift} />
          <LiftBadge label="Meeting" value={pattern.meetingLift} />
          <LiftBadge label="Opportunity" value={pattern.opportunityLift} />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {/* Characteristics */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Key Characteristics</h5>
            <div className="space-y-2">
              {pattern.characteristics.map((char, index) => (
                <div key={index} className="flex items-start space-x-2">
                  {char.importance === 'critical' ? (
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {char.attribute}: <span className="text-gray-600">{String(char.value)}</span>
                    </div>
                    <div className="text-xs text-gray-500">{char.description}</div>
                  </div>
                  {char.importance === 'critical' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      Critical
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Evidence */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Evidence</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Sample Size:</span>
                <span className="ml-2 font-medium">{pattern.sampleSize}</span>
              </div>
              <div>
                <span className="text-gray-600">Occurrences:</span>
                <span className="ml-2 font-medium">{pattern.occurrences}</span>
              </div>
            </div>
          </div>
          
          {/* Recommendation */}
          <div className="bg-blue-50 rounded p-3">
            <h5 className="text-sm font-medium text-blue-900 mb-2">
              <Lightbulb className="w-4 h-4 inline mr-1" />
              Recommendation
            </h5>
            <p className="text-sm text-blue-800 mb-3">{pattern.recommendation}</p>
            <div className="space-y-1">
              {pattern.implementationSteps.map((step, index) => (
                <div key={index} className="text-xs text-blue-700 flex items-start">
                  <span className="mr-2">{index + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LiftBadgeProps {
  label: string;
  value: number;
}

function LiftBadge({ label, value }: LiftBadgeProps) {
  const isPositive = value > 0;
  
  return (
    <div className="text-center p-2 bg-gray-50 rounded">
      <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </div>
      <div className="text-xs text-gray-600">{label} Lift</div>
    </div>
  );
}
