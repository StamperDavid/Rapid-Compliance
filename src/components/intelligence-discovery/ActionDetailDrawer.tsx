/**
 * ActionDetailDrawer — Slide-over panel showing full details of a DiscoveryAction
 *
 * Opens when clicking an action entry in the OperationLogPanel.
 * Shows URL, entity info, extracted data table, content sizes, confidence, errors.
 */

'use client';

import React from 'react';
import {
  X,
  Globe,
  Search,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Clock,
  Database,
  FileText,
  Target,
  ArrowRight,
} from 'lucide-react';
import type { DiscoveryAction, ActionType } from '@/types/intelligence-discovery';

interface ActionDetailDrawerProps {
  action: DiscoveryAction | null;
  onClose: () => void;
  onNavigateToFinding: ((findingId: string) => void) | null;
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  scrape: Globe,
  search: Search,
  extract: Cpu,
  enrich: RefreshCw,
  validate: CheckCircle,
  error: AlertTriangle,
};

const ACTION_COLORS: Record<ActionType, string> = {
  scrape: 'var(--color-info)',
  search: 'var(--color-primary)',
  extract: 'var(--color-secondary)',
  enrich: 'var(--color-cyan)',
  validate: 'var(--color-success)',
  error: 'var(--color-error)',
};

const ACTION_LABELS: Record<ActionType, string> = {
  scrape: 'Web Scrape',
  search: 'Search Query',
  extract: 'Data Extraction',
  enrich: 'Enrichment Hop',
  validate: 'Validation',
  error: 'Error',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  running: { label: 'Running', color: 'var(--color-warning)', Icon: Clock },
  completed: { label: 'Completed', color: 'var(--color-success)', Icon: CheckCircle },
  failed: { label: 'Failed', color: 'var(--color-error)', Icon: XCircle },
};

function formatDuration(ms: number | null): string {
  if (ms === null) { return 'In progress...'; }
  if (ms < 1000) { return `${ms}ms`; }
  if (ms < 60000) { return `${(ms / 1000).toFixed(1)}s`; }
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceColor(score: number): string {
  if (score >= 70) { return 'var(--color-success)'; }
  if (score >= 40) { return 'var(--color-warning)'; }
  return 'var(--color-error)';
}

export default function ActionDetailDrawer({
  action,
  onClose,
  onNavigateToFinding,
}: ActionDetailDrawerProps) {
  if (!action) { return null; }

  const Icon = ACTION_ICONS[action.actionType];
  const color = ACTION_COLORS[action.actionType];
  const statusCfg = STATUS_CONFIG[action.status];
  const StatusIcon = statusCfg?.Icon ?? Clock;
  const extractedFields = action.data.extractedFields;
  const fieldEntries = extractedFields ? Object.entries(extractedFields) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-[var(--color-bg-paper)] border-l border-[var(--color-border-light)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border-light)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {ACTION_LABELS[action.actionType]}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon className="w-3 h-3" style={{ color: statusCfg?.color }} />
                <span className="text-xs" style={{ color: statusCfg?.color }}>
                  {statusCfg?.label}
                </span>
                <span className="text-xs text-[var(--color-text-disabled)]">
                  &middot; {formatDuration(action.durationMs)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* URLs */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
              URLs
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Globe className="w-3.5 h-3.5 text-[var(--color-text-disabled)] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[var(--color-text-disabled)]">Source URL</p>
                  <p className="text-xs text-[var(--color-text-primary)] break-all">
                    {action.sourceUrl || 'N/A'}
                  </p>
                </div>
              </div>
              {action.targetUrl && (
                <div className="flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-[var(--color-text-disabled)] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--color-text-disabled)]">Target URL</p>
                    <p className="text-xs text-[var(--color-text-primary)] break-all">
                      {action.targetUrl}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Timestamps */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
              Timing
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[var(--color-text-disabled)]">Started</p>
                <p className="text-xs text-[var(--color-text-primary)]">
                  {formatTimestamp(action.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-disabled)]">Completed</p>
                <p className="text-xs text-[var(--color-text-primary)]">
                  {action.completedAt ? formatTimestamp(action.completedAt) : 'In progress...'}
                </p>
              </div>
            </div>
          </section>

          {/* Content Size */}
          {(action.data.rawContentSize !== null || action.data.extractedContentSize !== null) && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
                Content Size
              </h3>
              <div className="flex items-center gap-2">
                {action.data.rawContentSize !== null && (
                  <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-lg p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <FileText className="w-3 h-3 text-[var(--color-text-disabled)]" />
                      <p className="text-[10px] text-[var(--color-text-disabled)]">Raw</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {formatBytes(action.data.rawContentSize)}
                    </p>
                  </div>
                )}
                {action.data.rawContentSize !== null && action.data.extractedContentSize !== null && (
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-disabled)] flex-shrink-0" />
                )}
                {action.data.extractedContentSize !== null && (
                  <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-lg p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Database className="w-3 h-3 text-[var(--color-cyan)]" />
                      <p className="text-[10px] text-[var(--color-text-disabled)]">Extracted</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-cyan)]">
                      {formatBytes(action.data.extractedContentSize)}
                    </p>
                  </div>
                )}
              </div>
              {action.data.rawContentSize !== null && action.data.extractedContentSize !== null && action.data.rawContentSize > 0 && (
                <p className="text-[10px] text-[var(--color-text-disabled)] mt-1.5 text-center">
                  {((action.data.extractedContentSize / action.data.rawContentSize) * 100).toFixed(1)}% extraction ratio
                </p>
              )}
            </section>
          )}

          {/* Confidence Score */}
          {action.data.confidence !== null && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
                Confidence
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${action.data.confidence}%`,
                      backgroundColor: confidenceColor(action.data.confidence),
                    }}
                  />
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: confidenceColor(action.data.confidence) }}
                >
                  {action.data.confidence}%
                </span>
              </div>
            </section>
          )}

          {/* Summary */}
          {action.data.summary && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
                Summary
              </h3>
              <p className="text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] rounded-lg p-3 leading-relaxed">
                {action.data.summary}
              </p>
            </section>
          )}

          {/* Extracted Data Table */}
          {fieldEntries.length > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2">
                Extracted Data ({fieldEntries.length} fields)
              </h3>
              <div className="border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-bg-elevated)]">
                      <th className="text-left text-[10px] font-semibold text-[var(--color-text-secondary)] px-3 py-2 w-1/3">
                        Field
                      </th>
                      <th className="text-left text-[10px] font-semibold text-[var(--color-text-secondary)] px-3 py-2">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldEntries.map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-bg-elevated)]/50"
                      >
                        <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)] font-medium align-top">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td className="px-3 py-2 text-xs text-[var(--color-text-primary)] break-all">
                          {value || <span className="text-[var(--color-text-disabled)] italic">empty</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Error Details */}
          {action.data.errorMessage && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-error)] mb-2">
                Error Details
              </h3>
              <div className="bg-[var(--color-error)]/5 border border-[var(--color-error)]/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-error)] leading-relaxed break-all">
                    {action.data.errorMessage}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Finding Link */}
          {action.findingId && onNavigateToFinding && (
            <section>
              <button
                onClick={() => {
                  onNavigateToFinding(action.findingId as string);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)] text-xs font-medium rounded-lg hover:bg-[var(--color-cyan)]/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Related Finding
              </button>
            </section>
          )}
        </div>

        {/* Footer — action IDs for debugging */}
        <div className="p-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg-main)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--color-text-disabled)]">
            <span className="truncate" title={action.id}>ID: {action.id}</span>
            {action.findingId && (
              <span className="truncate ml-2" title={action.findingId}>
                Finding: {action.findingId.slice(0, 16)}...
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
