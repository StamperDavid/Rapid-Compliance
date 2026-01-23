/**
 * Conversation Topics Card
 * 
 * Displays topics discussed, objections raised, and competitor mentions.
 * Shows what was covered and what needs attention.
 * 
 * @module components/conversation
 */

'use client';

import React from 'react';
import type { ConversationAnalysis } from '@/lib/conversation/types';

interface ConversationTopicsCardProps {
  analysis: ConversationAnalysis;
  className?: string;
}

export function ConversationTopicsCard({ analysis, className = '' }: ConversationTopicsCardProps) {
  const { topics, objections, competitors, keyMoments } = analysis;
  
  // Topic category icons
  const getTopicIcon = (category: string) => {
    const icons: Record<string, string> = {
      pain_points: '😣',
      business_value: '💼',
      technical_requirements: '⚙️',
      pricing: '💰',
      timeline: '📅',
      competition: '⚔️',
      stakeholders: '👥',
      decision_process: '🤔',
      integration: '🔗',
      support: '🆘',
      other: '📋',
    };
    return icons[category] || '📋';
  };
  
  // Importance badge
  const getImportanceBadge = (importance: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      critical: { bg: 'bg-red-100', text: 'text-red-700' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      low: { bg: 'bg-gray-100', text: 'text-gray-700' },
    };
    const style = styles[importance] || styles.low;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {importance}
      </span>
    );
  };
  
  // Sentiment indicator
  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) {return 'text-green-600';}
    if (sentiment > -0.3) {return 'text-gray-600';}
    return 'text-red-600';
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Topics & Discussion</h2>
      
      {/* Main Topics */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Topics Covered ({topics.mainTopics.length})</h3>
        
        {topics.mainTopics.length > 0 ? (
          <div className="space-y-3">
            {topics.mainTopics.slice(0, 5).map((topic, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-3 py-2 bg-gray-50 rounded-r">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{getTopicIcon(topic.category)}</span>
                    <span className="font-medium text-gray-900">{topic.name}</span>
                  </div>
                  {getImportanceBadge(topic.importance)}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                  <span>Mentions: {topic.mentions}</span>
                  <span>Duration: {Math.round(topic.duration / 60)}min</span>
                  <span className={`font-medium ${getSentimentColor(topic.sentiment)}`}>
                    Sentiment: {topic.sentiment > 0 ? 'Positive' : topic.sentiment < 0 ? 'Negative' : 'Neutral'}
                  </span>
                </div>
                
                {topic.quotes.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600 italic">
                    {'"'}{topic.quotes[0].substring(0, 100)}{topic.quotes[0].length > 100 ? '...' : ''}{'"'}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No topics identified
          </div>
        )}
      </div>
      
      {/* Uncovered Topics */}
      {topics.uncoveredTopics.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Topics Not Discussed</h3>
          <ul className="space-y-1">
            {topics.uncoveredTopics.map((topic, index) => (
              <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                <span>•</span>
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Objections */}
      {objections.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Objections ({objections.length})</h3>
          
          <div className="space-y-3">
            {objections.map((objection, index) => (
              <div
                key={index}
                className={`border-l-4 pl-3 py-2 rounded-r ${
                  objection.wasAddressed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className="font-medium text-gray-900">{objection.objection}</span>
                    <span className={`ml-2 text-xs ${objection.wasAddressed ? 'text-green-600' : 'text-red-600'}`}>
                      {objection.wasAddressed ? '✓ Addressed' : '✗ Not Addressed'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">{objection.type}</span>
                </div>
                
                <div className="text-sm text-gray-600 italic mt-1">
                  {'"'}{objection.quote.substring(0, 120)}{objection.quote.length > 120 ? '...' : ''}{'"'}
                </div>
                
                {!objection.wasAddressed && objection.recommendedResponse && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-1">Recommended Response:</div>
                    <div className="text-xs text-gray-600">{objection.recommendedResponse}</div>
                  </div>
                )}
                
                {objection.wasAddressed && objection.responseQuality && (
                  <div className="mt-2 text-xs">
                    <span className="text-gray-500">Response Quality: </span>
                    <span className={`font-medium capitalize ${
                      objection.responseQuality === 'excellent' ? 'text-green-600' :
                      objection.responseQuality === 'good' ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {objection.responseQuality}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Competitors */}
      {competitors.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Competitor Mentions ({competitors.length})</h3>
          
          <div className="space-y-3">
            {competitors.map((competitor, index) => (
              <div
                key={index}
                className={`border-l-4 pl-3 py-2 rounded-r ${
                  competitor.concernLevel === 'high' ? 'border-red-500 bg-red-50' :
                  competitor.concernLevel === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-gray-500 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-gray-900">{competitor.competitor}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{competitor.mentions} mention{competitor.mentions > 1 ? 's' : ''}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      competitor.concernLevel === 'high' ? 'bg-red-100 text-red-700' :
                      competitor.concernLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {competitor.concernLevel} concern
                    </span>
                  </div>
                </div>
                
                {competitor.context.length > 0 && (
                  <div className="text-sm text-gray-600 italic mt-1">
                    {'"'}{competitor.context[0].substring(0, 120)}{competitor.context[0].length > 120 ? '...' : ''}{'"'}
                  </div>
                )}
                
                <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Recommended Response:</div>
                  <div className="text-xs text-gray-600">{competitor.recommendedResponse}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Key Moments */}
      {keyMoments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Moments ({keyMoments.length})</h3>
          
          <div className="space-y-2">
            {keyMoments.slice(0, 5).map((moment, _index) => {
              const impactIcon =
                moment.impact === 'positive' ? '✅' :
                moment.impact === 'negative' ? '⚠️' : 'ℹ️';

              const _impactColor =
                moment.impact === 'positive' ? 'text-green-600' :
                moment.impact === 'negative' ? 'text-red-600' : 'text-gray-600';
              
              return (
                <div key={_index} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <span className="text-lg">{impactIcon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{moment.title}</span>
                      <span className="text-xs text-gray-500">
                        {Math.floor(moment.timestamp / 60)}:{(moment.timestamp % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{moment.description}</p>
                    {moment.quote && (
                      <p className="text-sm text-gray-500 italic mt-1">
                        {'"'}{moment.quote.substring(0, 100)}{moment.quote.length > 100 ? '...' : ''}{'"'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
