/**
 * Field Rename History Component
 * Shows rename history and allows rollback
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

type FirestoreTimestamp = Date | string | { toDate: () => Date } | null | undefined;

interface FieldRenameHistoryProps {
  schemaId: string;
  fieldId: string;
  userId: string;
  onRollback?: () => void;
}

interface RenameRecord {
  timestamp: FirestoreTimestamp;
  oldKey: string;
  newKey: string;
  oldLabel: string;
  newLabel: string;
  renamedBy: string;
  reason?: string;
}

interface TimelineEntry {
  version: number;
  key: string;
  label: string;
  timestamp: FirestoreTimestamp;
  renamedBy: string;
  reason?: string;
}

interface CurrentFieldInfo {
  currentKey: string;
  currentLabel: string;
}

interface HistoryApiResponse {
  field: CurrentFieldInfo;
  history: RenameRecord[];
  timeline: TimelineEntry[];
  aliases: string[];
}

export default function FieldRenameHistory({
  schemaId,
  fieldId,
  userId,
  onRollback,
}: FieldRenameHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RenameRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<CurrentFieldInfo | null>(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/schema/${schemaId}/field/${fieldId}/rename-history`
      );

      if (!response.ok) {
        throw new Error('Failed to load rename history');
      }

      const data = await response.json() as HistoryApiResponse;
      setCurrentField(data.field);
      setHistory(data.history ?? []);
      setTimeline(data.timeline ?? []);
      setAliases(data.aliases ?? []);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [schemaId, fieldId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRollback = async (toVersion: number) => {
    // eslint-disable-next-line no-alert -- User confirmation required for destructive action
    if (!confirm(`Are you sure you want to rollback to version ${toVersion}?`)) {
      return;
    }

    try {
      setRolling(true);
      const response = await fetch(
        `/api/schema/${schemaId}/field/${fieldId}/rename-history`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toVersion,
            userId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to rollback field');
      }

      // Reload history
      await loadHistory();

      // Notify parent
      if (onRollback) {
        onRollback();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rollback';
      setError(message);
    } finally {
      setRolling(false);
    }
  };

  const formatTimestamp = (timestamp: FirestoreTimestamp): string => {
    if (!timestamp) { return 'Unknown'; }

    try {
      const tsWithToDate = timestamp as { toDate?: () => Date };
      const date = typeof tsWithToDate.toDate === 'function'
        ? tsWithToDate.toDate()
        : new Date(timestamp as string | Date);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No rename history available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Field Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Current Field</h3>
        <div className="space-y-1">
          <div className="text-sm">
            <span className="text-blue-600 font-medium">Key:</span>{' '}
            <code className="bg-blue-100 px-2 py-1 rounded">{currentField?.currentKey}</code>
          </div>
          <div className="text-sm">
            <span className="text-blue-600 font-medium">Label:</span>{' '}
            <span className="text-blue-900">{currentField?.currentLabel}</span>
          </div>
        </div>
      </div>

      {/* Aliases */}
      {aliases.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">All Known Aliases</h3>
          <div className="flex flex-wrap gap-2">
            {aliases.map((alias, idx) => (
              <span
                key={idx}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  alias === currentField?.currentKey
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename Timeline</h3>
        <div className="space-y-4">
          {timeline.map((entry, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                idx === timeline.length - 1
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === timeline.length - 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {entry.version}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-white px-2 py-1 rounded border border-gray-300 text-sm font-mono">
                    {entry.key}
                  </code>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-900 font-medium">{entry.label}</span>
                  {idx === timeline.length - 1 && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  {formatTimestamp(entry.timestamp)}
                  {entry.reason && (
                    <span className="ml-2 italic">• {entry.reason}</span>
                  )}
                </div>
              </div>
              
              {idx < timeline.length - 1 && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => { void handleRollback(entry.version); }}
                    disabled={rolling}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {rolling ? 'Rolling back...' : 'Rollback'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Change History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  From
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  When
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((record, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {record.oldKey}
                    </code>
                    <div className="text-xs text-gray-500 mt-1">{record.oldLabel}</div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {record.newKey}
                    </code>
                    <div className="text-xs text-gray-500 mt-1">{record.newLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatTimestamp(record.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 italic">
                    {(record.reason !== '' && record.reason != null) ? record.reason : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



