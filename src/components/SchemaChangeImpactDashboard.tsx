/**
 * Schema Change Impact Dashboard
 * Shows schema changes and their impact on the system
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SchemaChangeEvent } from '@/lib/schema/schema-change-tracker';
import { useAuthFetch } from '@/hooks/useAuthFetch';

type FirestoreTimestamp = Date | string | { toDate: () => Date } | null | undefined;

interface SchemaChangeImpactDashboardProps {
  schemaId: string;
}

interface ImpactSummary {
  totalChanges: number;
  byType: Record<string, number>;
  affectedSystems: {
    workflows: number;
    integrations: number;
    ecommerce: number;
    aiAgent: number;
  };
  recentChanges: SchemaChangeEvent[];
}

interface WorkflowDetail {
  workflowId: string;
  workflowName: string;
  errorCount: number;
  warningCount: number;
  valid: boolean;
}

interface WorkflowsSummary {
  valid: number;
  withWarnings: number;
  withErrors: number;
  details?: WorkflowDetail[];
}

interface ImpactApiResponse {
  impact: ImpactSummary;
  workflows: WorkflowsSummary;
}

export default function SchemaChangeImpactDashboard({
  schemaId,
}: SchemaChangeImpactDashboardProps) {
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImpactData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch(
        `/api/schema-changes/impact?schemaId=${schemaId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load impact data');
      }

      const data = await response.json() as ImpactApiResponse;
      setImpact(data.impact);
      setWorkflows(data.workflows);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load impact data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [schemaId, authFetch]);

  useEffect(() => {
    void loadImpactData();
  }, [loadImpactData]);

  const processUnprocessedEvents = async () => {
    try {
      const response = await authFetch('/api/schema-changes/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to process events');
      }

      // Reload impact data
      await loadImpactData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process events';
      setError(message);
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

  if (!impact) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No schema change data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Schema Change Impact</h2>
        <button
          onClick={() => { void processUnprocessedEvents(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Process Pending Changes
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Changes</div>
          <div className="text-3xl font-bold text-gray-900">{impact.totalChanges}</div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">Workflows</div>
          <div className="text-3xl font-bold text-blue-900">
            {impact.affectedSystems.workflows}
          </div>
          <div className="text-xs text-blue-600 mt-1">affected</div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 mb-1">E-Commerce</div>
          <div className="text-3xl font-bold text-green-900">
            {impact.affectedSystems.ecommerce}
          </div>
          <div className="text-xs text-green-600 mt-1">mappings updated</div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-600 mb-1">Integrations</div>
          <div className="text-3xl font-bold text-purple-900">
            {impact.affectedSystems.integrations}
          </div>
          <div className="text-xs text-purple-600 mt-1">field mappings</div>
        </div>
      </div>

      {/* Change Types */}
      {Object.keys(impact.byType).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes by Type</h3>
          <div className="space-y-2">
            {Object.entries(impact.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getChangeTypeBadgeClass(type)}`}>
                    {formatChangeType(type)}
                  </span>
                </div>
                <span className="text-gray-600 font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Summary */}
      {workflows && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Status</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">Valid</div>
              <div className="text-2xl font-bold text-green-600">{workflows.valid}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Warnings</div>
              <div className="text-2xl font-bold text-yellow-600">{workflows.withWarnings}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Errors</div>
              <div className="text-2xl font-bold text-red-600">{workflows.withErrors}</div>
            </div>
          </div>
          
          {workflows.details && workflows.details.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Workflow Details</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {workflows.details.map((detail) => (
                  <div
                    key={detail.workflowId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-900">{detail.workflowName}</span>
                    <div className="flex gap-2">
                      {detail.errorCount > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                          {detail.errorCount} errors
                        </span>
                      )}
                      {detail.warningCount > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                          {detail.warningCount} warnings
                        </span>
                      )}
                      {detail.valid && detail.warningCount === 0 && detail.errorCount === 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                          ✓ Valid
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Changes */}
      {impact.recentChanges.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Changes</h3>
          <div className="space-y-3">
            {impact.recentChanges.map((change) => (
              <div
                key={change.id}
                className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-shrink-0">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getChangeTypeBadgeClass(change.changeType)}`}>
                    {formatChangeType(change.changeType)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">
                    {getChangeDescription(change)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(change.timestamp)}
                  </div>
                  {change.affectedSystems.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {change.affectedSystems.map((system, idx) => (
                        <span
                          key={idx}
                          className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                        >
                          {system.system}: {system.itemsAffected || 0} affected
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {change.processed ? (
                    <span className="text-xs text-green-600">✓ Processed</span>
                  ) : (
                    <span className="text-xs text-yellow-600">⏳ Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getChangeTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    field_added: 'bg-green-100 text-green-700',
    field_renamed: 'bg-blue-100 text-blue-700',
    field_key_changed: 'bg-blue-100 text-blue-700',
    field_deleted: 'bg-red-100 text-red-700',
    field_type_changed: 'bg-yellow-100 text-yellow-700',
    schema_renamed: 'bg-purple-100 text-purple-700',
  };
  return classes[type] || 'bg-gray-100 text-gray-700';
}

function formatChangeType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getChangeDescription(change: SchemaChangeEvent): string {
  switch (change.changeType) {
    case 'field_renamed':
      return `Field renamed: "${change.oldFieldName}" → "${change.newFieldName}"`;
    case 'field_key_changed':
      return `Field key changed: "${change.oldFieldKey}" → "${change.newFieldKey}"`;
    case 'field_deleted':
      return `Field deleted: "${change.oldFieldName}"`;
    case 'field_added':
      return `Field added: "${change.newFieldName}"`;
    case 'field_type_changed':
      return `Field type changed: "${change.oldFieldType}" → "${change.newFieldType}"`;
    case 'schema_renamed':
      return `Schema renamed: "${change.oldSchemaName}" → "${change.newSchemaName}"`;
    default:
      return 'Schema change detected';
  }
}

function formatTimestamp(timestamp: FirestoreTimestamp): string {
  if (!timestamp) { return 'Unknown time'; }

  try {
    const tsWithToDate = timestamp as { toDate?: () => Date };
    const date = typeof tsWithToDate.toDate === 'function'
      ? tsWithToDate.toDate()
      : new Date(timestamp as string | Date);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) { return 'Just now'; }
    if (diffMins < 60) { return `${diffMins} minutes ago`; }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) { return `${diffHours} hours ago`; }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) { return `${diffDays} days ago`; }

    return date.toLocaleDateString();
  } catch {
    return 'Unknown time';
  }
}



