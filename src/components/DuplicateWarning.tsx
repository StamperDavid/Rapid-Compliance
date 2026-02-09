/**
 * Duplicate Warning Component
 * Shows warning when potential duplicates are detected
 */

'use client';

import { useState } from 'react';
import type { DuplicateMatch } from '@/lib/crm/duplicate-detection';

interface DuplicateRecord {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface TypedDuplicateMatch extends Omit<DuplicateMatch, 'record'> {
  record: DuplicateRecord;
}

interface DuplicateWarningProps {
  duplicates: DuplicateMatch[];
  entityType: 'lead' | 'contact' | 'company';
  onMerge?: (keepId: string, mergeId: string) => void;
  onIgnore?: () => void;
  newRecordId?: string;
}

export default function DuplicateWarning({
  duplicates,
  entityType,
  onMerge,
  onIgnore,
  newRecordId,
}: DuplicateWarningProps) {
  const [merging, setMerging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (duplicates.length === 0) { return null; }

  // Cast duplicates to typed version for safe property access
  const typedDuplicates = duplicates as TypedDuplicateMatch[];
  const highConfidenceMatches = typedDuplicates.filter(d => d.confidence === 'high');
  const mediumConfidenceMatches = typedDuplicates.filter(d => d.confidence === 'medium');

  const handleMerge = (duplicateId: string) => {
    if (!onMerge || !newRecordId) { return; }

    setMerging(true);
    try {
      onMerge(newRecordId, duplicateId);
    } finally {
      setMerging(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-orange-900">
              Potential {entityType === 'lead' ? 'Lead' : entityType === 'contact' ? 'Contact' : 'Company'} Duplicates Detected
            </h3>
            <p className="text-sm text-orange-700">
              Found {duplicates.length} potential {duplicates.length === 1 ? 'match' : 'matches'} in your database
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-orange-700 hover:text-orange-900 font-medium"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* High confidence matches */}
      {highConfidenceMatches.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-red-700 mb-2">
            HIGH CONFIDENCE MATCHES ({highConfidenceMatches.length})
          </div>
          {highConfidenceMatches.slice(0, showDetails ? undefined : 1).map((match) => (
            <div
              key={match.id}
              className="bg-white rounded border border-red-300 p-3 mb-2"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {match.record.firstName} {match.record.lastName}
                    {match.record.name && ` - ${match.record.name}`}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {match.record.email ?? match.record.phone ?? match.record.company ?? 'No contact info'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(match.confidence)}`}>
                    {match.matchScore}% match
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {match.matchReasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                  >
                    {reason}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                {onMerge && newRecordId && (
                  <button
                    onClick={() => { handleMerge(match.id); }}
                    disabled={merging}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {merging ? 'Merging...' : 'Merge with this record'}
                  </button>
                )}
                <button className="px-3 py-1 bg-gray-200 text-[var(--color-text-primary)] rounded text-sm font-medium hover:bg-gray-300">
                  View Record
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Medium confidence matches */}
      {showDetails && mediumConfidenceMatches.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-yellow-700 mb-2">
            MEDIUM CONFIDENCE MATCHES ({mediumConfidenceMatches.length})
          </div>
          {mediumConfidenceMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded border border-yellow-300 p-3 mb-2"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {match.record.firstName} {match.record.lastName}
                    {match.record.name && ` - ${match.record.name}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    {match.record.email ?? match.record.phone ?? match.record.company ?? 'No contact info'}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(match.confidence)}`}>
                  {match.matchScore}% match
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {match.matchReasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-orange-300">
        {onIgnore && (
          <button
            onClick={onIgnore}
            className="px-4 py-2 bg-white border border-orange-400 text-orange-700 rounded font-medium hover:bg-orange-100"
          >
            Continue Anyway
          </button>
        )}
        <button className="px-4 py-2 bg-white border border-gray-300 text-[var(--color-text-primary)] rounded font-medium hover:bg-gray-100">
          Review All Duplicates
        </button>
      </div>
    </div>
  );
}

