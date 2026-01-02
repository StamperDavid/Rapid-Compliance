/**
 * Patterns Card
 * 
 * Displays extracted patterns with examples and success metrics.
 * Shows when to use each pattern and expected outcomes.
 * 
 * @module components/playbook
 */

'use client';

import React, { useState } from 'react';
import type { Pattern, PatternCategory } from '@/lib/playbook/types';

interface PatternsCardProps {
  patterns: Pattern[];
  className?: string;
}

export function PatternsCard({ patterns, className = '' }: PatternsCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<PatternCategory | 'all'>('all');
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  
  // Filter patterns by category
  const filteredPatterns = selectedCategory === 'all'
    ? patterns
    : patterns.filter(p => p.category === selectedCategory);
  
  // Sort by success rate
  const sortedPatterns = [...filteredPatterns].sort((a, b) => b.successRate - a.successRate);
  
  // Success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-blue-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Category badge
  const getCategoryBadge = (category: PatternCategory) => {
    const colors = {
      opening: 'bg-purple-100 text-purple-800',
      discovery_question: 'bg-blue-100 text-blue-800',
      value_proposition: 'bg-green-100 text-green-800',
      objection_response: 'bg-red-100 text-red-800',
      closing_technique: 'bg-yellow-100 text-yellow-800',
      rapport_building: 'bg-pink-100 text-pink-800',
      pain_exploration: 'bg-orange-100 text-orange-800',
      feature_positioning: 'bg-indigo-100 text-indigo-800',
      competitor_dismissal: 'bg-red-100 text-red-800',
      urgency_creation: 'bg-yellow-100 text-yellow-800',
      stakeholder_engagement: 'bg-blue-100 text-blue-800',
      next_steps: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.other;
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Winning Patterns</h2>
      
      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({patterns.length})
          </button>
          {(['opening', 'discovery_question', 'value_proposition', 'objection_response', 'closing_technique'] as PatternCategory[]).map((category) => {
            const count = patterns.filter(p => p.category === category).length;
            if (count === 0) return null;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.replace(/_/g, ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Pattern List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {sortedPatterns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No patterns found</p>
          </div>
        ) : (
          sortedPatterns.map((pattern) => (
            <div key={pattern.id} className="border rounded-lg p-4">
              {/* Header */}
              <div 
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedPattern(expandedPattern === pattern.id ? null : pattern.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{pattern.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getCategoryBadge(pattern.category)}`}>
                      {pattern.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{pattern.description}</p>
                </div>
                <div className="ml-4 text-right">
                  <div className={`text-2xl font-bold ${getSuccessRateColor(pattern.successRate)}`}>
                    {pattern.successRate}%
                  </div>
                  <div className="text-xs text-gray-500">success rate</div>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                <div>
                  <div className="text-gray-600">Frequency</div>
                  <div className="font-semibold">{pattern.frequency}x</div>
                </div>
                <div>
                  <div className="text-gray-600">Impact</div>
                  <div className="font-semibold">{pattern.avgImpact}/100</div>
                </div>
                <div>
                  <div className="text-gray-600">Confidence</div>
                  <div className="font-semibold">{pattern.confidence}%</div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedPattern === pattern.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  {/* Situation -> Approach -> Outcome */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-gray-700 mb-1">When (Situation)</div>
                      <p className="text-gray-600">{pattern.situation}</p>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700 mb-1">Do (Approach)</div>
                      <p className="text-gray-600">{pattern.approach}</p>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700 mb-1">Result (Outcome)</div>
                      <p className="text-gray-600">{pattern.outcome}</p>
                    </div>
                  </div>
                  
                  {/* Examples */}
                  {pattern.examples.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-700 mb-2">Examples</div>
                      <div className="space-y-2">
                        {pattern.examples.slice(0, 3).map((example, index) => (
                          <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-700">{example.repName}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                example.effectiveness === 'excellent' ? 'bg-green-100 text-green-800' :
                                example.effectiveness === 'good' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {example.effectiveness}
                              </span>
                            </div>
                            <p className="text-gray-600 italic">"{example.quote}"</p>
                            <div className="mt-2 text-xs text-gray-500">
                              Sentiment: {example.sentimentBefore.toFixed(2)} → {example.sentimentAfter.toFixed(2)}
                              <span className={`ml-2 ${example.sentimentAfter > example.sentimentBefore ? 'text-green-600' : 'text-red-600'}`}>
                                ({example.sentimentAfter > example.sentimentBefore ? '↑' : '↓'} {Math.abs(example.sentimentAfter - example.sentimentBefore).toFixed(2)})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Top Performers */}
                  {pattern.topPerformerIds.length > 0 && (
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Top performers using this: </span>
                      <span className="text-gray-600">{pattern.topPerformerIds.length} reps</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Summary */}
      {sortedPatterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>{sortedPatterns.length} patterns</span>
            <span>Avg Success: {Math.round(sortedPatterns.reduce((sum, p) => sum + p.successRate, 0) / sortedPatterns.length)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
