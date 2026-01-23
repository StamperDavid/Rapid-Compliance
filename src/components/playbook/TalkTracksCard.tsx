/**
 * Talk Tracks Card
 * 
 * Displays proven talk tracks with scripts, key phrases, and usage guidance.
 * Shows tonality, pace, and when to use each track.
 * 
 * @module components/playbook
 */

'use client';

import React, { useState } from 'react';
import type { TalkTrack, TalkTrackPurpose } from '@/lib/playbook/types';

interface TalkTracksCardProps {
  talkTracks: TalkTrack[];
  className?: string;
}

export function TalkTracksCard({ talkTracks, className = '' }: TalkTracksCardProps) {
  const [selectedPurpose, setSelectedPurpose] = useState<TalkTrackPurpose | 'all'>('all');
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  
  // Filter by purpose
  const filteredTracks = selectedPurpose === 'all'
    ? talkTracks
    : talkTracks.filter(t => t.purpose === selectedPurpose);
  
  // Sort by success rate
  const sortedTracks = [...filteredTracks].sort((a, b) => b.successRate - a.successRate);
  
  // Success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) {return 'text-green-600';}
    if (rate >= 60) {return 'text-blue-600';}
    if (rate >= 40) {return 'text-yellow-600';}
    return 'text-red-600';
  };
  
  // Tonality badge
  const getTonalityBadge = (tonality: string): string => {
    const colors: Record<string, string> = {
      consultative: 'bg-blue-100 text-blue-800',
      assertive: 'bg-red-100 text-red-800',
      empathetic: 'bg-purple-100 text-purple-800',
      enthusiastic: 'bg-yellow-100 text-yellow-800',
      professional: 'bg-gray-100 text-gray-800',
      casual: 'bg-green-100 text-green-800',
      urgent: 'bg-orange-100 text-orange-800',
      educational: 'bg-indigo-100 text-indigo-800',
    };
    return colors[tonality] ?? colors.professional;
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Talk Tracks</h2>
      
      {/* Purpose Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPurpose('all')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              selectedPurpose === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({talkTracks.length})
          </button>
          {(['opening', 'value_prop', 'discovery', 'objection_handling', 'closing'] as TalkTrackPurpose[]).map((purpose) => {
            const count = talkTracks.filter(t => t.purpose === purpose).length;
            if (count === 0) {return null;}
            return (
              <button
                key={purpose}
                onClick={() => setSelectedPurpose(purpose)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedPurpose === purpose
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {purpose.replace(/_/g, ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Talk Track List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {sortedTracks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No talk tracks found</p>
          </div>
        ) : (
          sortedTracks.map((track) => (
            <div key={track.id} className="border rounded-lg p-4">
              {/* Header */}
              <div 
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{track.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getTonalityBadge(track.tonality)}`}>
                      {track.tonality}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                      {track.pace} pace
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{track.description}</p>
                </div>
                <div className="ml-4 text-right">
                  <div className={`text-2xl font-bold ${getSuccessRateColor(track.successRate)}`}>
                    {track.successRate}%
                  </div>
                  <div className="text-xs text-gray-500">success</div>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                <div>
                  <div className="text-gray-600">Adoption</div>
                  <div className="font-semibold">{track.adoptionRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Usage</div>
                  <div className="font-semibold">{track.usageCount}x</div>
                </div>
                <div>
                  <div className="text-gray-600">Sentiment</div>
                  <div className="font-semibold">{(track.avgSentimentScore * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Confidence</div>
                  <div className="font-semibold">{track.confidence}%</div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedTrack === track.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  {/* Script */}
                  <div>
                    <div className="font-semibold text-gray-700 mb-2">Script</div>
                    <div className="bg-gray-50 rounded p-4 text-sm whitespace-pre-wrap">
                      {track.script}
                    </div>
                  </div>
                  
                  {/* Key Phrases */}
                  {track.keyPhrases.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-700 mb-2">Key Phrases</div>
                      <div className="flex flex-wrap gap-2">
                        {track.keyPhrases.map((phrase, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                            &quot;{phrase}&quot;
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Structure */}
                  {track.structure.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-700 mb-2">Structure</div>
                      <div className="space-y-2">
                        {track.structure.map((section, index) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                              {section.order}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{section.name}</div>
                              <div className="text-xs text-gray-600">{section.purpose}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                ~{Math.round(section.estimatedDuration / 60)} min
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Use When / Avoid When */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-green-700 mb-1">✓ Use When:</div>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {track.useWhen.map((condition, index) => (
                          <li key={index}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-red-700 mb-1">✗ Avoid When:</div>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {track.avoidWhen.map((condition, index) => (
                          <li key={index}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* Originator */}
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">Originally from: </span>
                    <span className="text-gray-600">{track.originatingRepName}</span>
                  </div>
                  
                  {/* Variations */}
                  {track.variations.length > 0 && (
                    <div>
                      <div className="font-semibold text-gray-700 mb-2">
                        {track.variations.length} Variation{track.variations.length > 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        Expand to see alternative versions for different situations
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Summary */}
      {sortedTracks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>{sortedTracks.length} talk tracks</span>
            <span>Avg Success: {Math.round(sortedTracks.reduce((sum, t) => sum + t.successRate, 0) / sortedTracks.length)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
