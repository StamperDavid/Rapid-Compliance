/**
 * Conversation Overview Card
 * 
 * Displays high-level conversation metrics and scores.
 * Shows overall quality, sentiment, talk ratio, and key indicators.
 * 
 * @module components/conversation
 */

'use client';

import React from 'react';
import type { ConversationAnalysis } from '@/lib/conversation/types';

interface ConversationOverviewCardProps {
  analysis: ConversationAnalysis;
  className?: string;
}

export function ConversationOverviewCard({ analysis, className = '' }: ConversationOverviewCardProps) {
  const { scores, sentiment, talkRatio, redFlags, positiveSignals } = analysis;
  
  // Score colors
  const getScoreColor = (score: number) => {
    if (score >= 80) {return 'text-green-600';}
    if (score >= 60) {return 'text-blue-600';}
    if (score >= 40) {return 'text-yellow-600';}
    return 'text-red-600';
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 80) {return 'bg-green-100';}
    if (score >= 60) {return 'bg-blue-100';}
    if (score >= 40) {return 'bg-yellow-100';}
    return 'bg-red-100';
  };
  
  // Sentiment emoji
  const getSentimentEmoji = (polarity: string) => {
    switch (polarity) {
      case 'very_positive': return '😊';
      case 'positive': return '🙂';
      case 'neutral': return '😐';
      case 'negative': return '😟';
      case 'very_negative': return '😢';
      default: return '❓';
    }
  };
  
  // Talk ratio status
  const getTalkRatioStatus = (assessment: string) => {
    switch (assessment) {
      case 'ideal': return { text: 'Ideal', color: 'text-green-600', bg: 'bg-green-100' };
      case 'balanced': return { text: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'needs_improvement': return { text: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
      default: return { text: 'Poor', color: 'text-red-600', bg: 'bg-red-100' };
    }
  };
  
  const talkRatioStatus = getTalkRatioStatus(talkRatio.assessment);
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Conversation Overview</h2>
      
      {/* Overall Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Score</span>
          <span className={`text-2xl font-bold ${getScoreColor(scores.overall)}`}>
            {scores.overall}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${getScoreBgColor(scores.overall)}`}
            style={{ width: `${scores.overall}%` }}
          />
        </div>
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Sentiment */}
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Sentiment</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getSentimentEmoji(sentiment.overall.polarity)}</span>
            <div>
              <div className="font-semibold capitalize">{sentiment.overall.polarity.replace('_', ' ')}</div>
              <div className="text-xs text-gray-500">{Math.round((sentiment.overall.score + 1) * 50)}/100</div>
            </div>
          </div>
        </div>
        
        {/* Talk Ratio */}
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Talk Ratio</div>
          <div>
            <div className={`inline-block px-2 py-1 rounded text-sm font-semibold ${talkRatioStatus.bg} ${talkRatioStatus.color}`}>
              {talkRatioStatus.text}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Rep: {talkRatio.repPercentage}% • Prospect: {talkRatio.prospectPercentage}%
            </div>
          </div>
        </div>
        
        {/* Red Flags */}
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Red Flags</div>
          <div className="flex items-center gap-2">
            {redFlags.length > 0 ? (
              <>
                <span className="text-2xl">🚩</span>
                <div>
                  <div className="font-semibold text-red-600">{redFlags.length}</div>
                  <div className="text-xs text-gray-500">Issues detected</div>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-semibold text-green-600">None</div>
                  <div className="text-xs text-gray-500">All clear</div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Positive Signals */}
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Positive Signals</div>
          <div className="flex items-center gap-2">
            {positiveSignals.length > 0 ? (
              <>
                <span className="text-2xl">⭐</span>
                <div>
                  <div className="font-semibold text-green-600">{positiveSignals.length}</div>
                  <div className="text-xs text-gray-500">Buying signals</div>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl">ℹ️</span>
                <div>
                  <div className="font-semibold text-gray-600">None</div>
                  <div className="text-xs text-gray-500">Build interest</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Detailed Scores */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Detailed Scores</h3>
        
        {/* Discovery */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Discovery</span>
            <span className={`text-sm font-semibold ${getScoreColor(scores.discovery)}`}>
              {scores.discovery}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getScoreBgColor(scores.discovery)}`}
              style={{ width: `${scores.discovery}%` }}
            />
          </div>
        </div>
        
        {/* Objection Handling */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Objection Handling</span>
            <span className={`text-sm font-semibold ${getScoreColor(scores.objectionHandling)}`}>
              {scores.objectionHandling}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getScoreBgColor(scores.objectionHandling)}`}
              style={{ width: `${scores.objectionHandling}%` }}
            />
          </div>
        </div>
        
        {/* Closing */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Closing</span>
            <span className={`text-sm font-semibold ${getScoreColor(scores.closing)}`}>
              {scores.closing}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getScoreBgColor(scores.closing)}`}
              style={{ width: `${scores.closing}%` }}
            />
          </div>
        </div>
        
        {/* Rapport */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Rapport</span>
            <span className={`text-sm font-semibold ${getScoreColor(scores.rapport)}`}>
              {scores.rapport}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getScoreBgColor(scores.rapport)}`}
              style={{ width: `${scores.rapport}%` }}
            />
          </div>
        </div>
        
        {/* Engagement */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Engagement</span>
            <span className={`text-sm font-semibold ${getScoreColor(scores.engagement)}`}>
              {scores.engagement}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getScoreBgColor(scores.engagement)}`}
              style={{ width: `${scores.engagement}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div className="mt-6 pt-4 border-t">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {analysis.summary}
        </p>
      </div>
      
      {/* Highlights */}
      {analysis.highlights.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Highlights</h3>
          <ul className="space-y-1">
            {analysis.highlights.slice(0, 3).map((highlight, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Metadata */}
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
          </span>
          <span>
            Confidence: {analysis.confidence}%
          </span>
        </div>
      </div>
    </div>
  );
}
