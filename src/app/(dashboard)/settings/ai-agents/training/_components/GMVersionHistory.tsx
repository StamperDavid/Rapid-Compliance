'use client';

/**
 * GMVersionHistory
 *
 * Displays the full version history of Golden Masters for a given agentType.
 * Supports:
 * - Expanding a version to see its full system prompt
 * - Selecting two versions and comparing them side-by-side (diff panel)
 * - Rolling back to any non-active version
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2, GitCompare, RotateCcw } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface GMVersion {
  id: string;
  version: string;
  systemPrompt: string;
  isActive: boolean;
  deployedAt: string;
  createdAt: string;
  createdBy: string;
  notes: string;
}

interface GMVersionsResponse {
  success: boolean;
  versions: GMVersion[];
}

interface GMVersionHistoryProps {
  agentType: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimestamp(iso: string): string {
  if (!iso) {
    return 'Unknown';
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GMVersionHistory({ agentType }: GMVersionHistoryProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [versions, setVersions] = useState<GMVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  // Diff state: tuple of [versionId | null, versionId | null]
  const [diffVersions, setDiffVersions] = useState<[string | null, string | null]>([null, null]);
  const [showDiff, setShowDiff] = useState(false);

  // Rollback state
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/training/gm-versions?agentType=${encodeURIComponent(agentType)}`);
      if (!res.ok) {
        const rawBody: unknown = await res.json().catch(() => ({}));
        const body = rawBody as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as GMVersionsResponse;
      setVersions(data.versions ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  // ── Expand / collapse ──────────────────────────────────────────────────────
  function handleToggleExpand(versionId: string) {
    setExpandedVersion((prev) => (prev === versionId ? null : versionId));
  }

  // ── Diff selection ─────────────────────────────────────────────────────────
  function handleDiffToggle(versionId: string) {
    setDiffVersions(([a, b]) => {
      if (a === versionId) { return [null, b]; }
      if (b === versionId) { return [a, null]; }
      if (a === null) { return [versionId, b]; }
      if (b === null) { return [a, versionId]; }
      // Both slots filled — replace the second slot
      return [a, versionId];
    });
    // Ensure diff panel is hidden until Compare is clicked
    setShowDiff(false);
  }

  function handleCompare() {
    if (diffVersions[0] !== null && diffVersions[1] !== null) {
      setShowDiff(true);
    }
  }

  function handleClearDiff() {
    setDiffVersions([null, null]);
    setShowDiff(false);
  }

  // ── Rollback ───────────────────────────────────────────────────────────────
  async function handleRollback(version: GMVersion) {
    setIsRollingBack(true);
    setRollbackError(null);
    setRollbackSuccess(null);
    try {
      const res = await fetch('/api/training/apply-prompt-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType,
          revisedPromptSection: version.systemPrompt,
          fullRevisedPrompt: version.systemPrompt,
          changeDescription: `Rollback to ${version.version}`,
        }),
      });

      if (!res.ok) {
        const rawBody: unknown = await res.json().catch(() => ({}));
        const body = rawBody as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setRollbackSuccess(`Successfully rolled back to ${version.version}`);
      // Refetch so the newly created version (and active badge) reflects correctly
      await fetchVersions();
    } catch (err: unknown) {
      setRollbackError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setIsRollingBack(false);
    }
  }

  // ── Derived diff content ───────────────────────────────────────────────────
  const diffA = versions.find((v) => v.id === diffVersions[0]);
  const diffB = versions.find((v) => v.id === diffVersions[1]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-500 dark:text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading version history...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
        {fetchError}
        <button
          type="button"
          onClick={() => void fetchVersions()}
          className="ml-3 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <p className="py-6 text-sm text-gray-500 dark:text-gray-400">
        No Golden Master versions found for agent type &ldquo;{agentType}&rdquo;.
      </p>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Feedback banners ────────────────────────────────────────────── */}
      {rollbackSuccess && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
          {rollbackSuccess}
        </div>
      )}
      {rollbackError && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {rollbackError}
        </div>
      )}

      {/* ── Compare toolbar ─────────────────────────────────────────────── */}
      {(diffVersions[0] !== null || diffVersions[1] !== null) && (
        <div className="flex items-center gap-3 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 px-4 py-2 text-sm">
          <GitCompare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-indigo-700 dark:text-indigo-300 flex-1">
            Comparing&nbsp;
            <strong>{diffA?.version ?? '—'}</strong>
            &nbsp;vs&nbsp;
            <strong>{diffB?.version ?? '—'}</strong>
          </span>
          {diffVersions[0] !== null && diffVersions[1] !== null && (
            <button
              type="button"
              onClick={handleCompare}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
            >
              Compare
            </button>
          )}
          <button
            type="button"
            onClick={handleClearDiff}
            className="px-3 py-1 rounded border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Diff panel ──────────────────────────────────────────────────── */}
      {showDiff && diffA && diffB && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Diff: {diffA.version} vs {diffB.version}
            </span>
            <button
              type="button"
              onClick={() => setShowDiff(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Close diff
            </button>
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200 dark:divide-gray-700">
            {/* Left panel — version A */}
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">
                {diffA.version} — {formatTimestamp(diffA.createdAt)}
              </p>
              <pre className="font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96 p-3 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-gray-800 dark:text-gray-200">
                {diffA.systemPrompt}
              </pre>
            </div>
            {/* Right panel — version B */}
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-2">
                {diffB.version} — {formatTimestamp(diffB.createdAt)}
              </p>
              <pre className="font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96 p-3 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-200">
                {diffB.systemPrompt}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Version list ─────────────────────────────────────────────────── */}
      <ul className="space-y-2">
        {versions.map((version) => {
          const isExpanded = expandedVersion === version.id;
          const isCheckedForDiff =
            diffVersions[0] === version.id || diffVersions[1] === version.id;

          return (
            <li
              key={version.id}
              className={[
                'rounded-lg border p-4 transition-colors',
                version.isActive
                  ? 'border-green-400 dark:border-green-600 bg-green-50/30 dark:bg-green-950/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
              ].join(' ')}
            >
              {/* ── Version header row ──────────────────────────────────── */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Diff checkbox */}
                <input
                  type="checkbox"
                  id={`diff-${version.id}`}
                  checked={isCheckedForDiff}
                  onChange={() => handleDiffToggle(version.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  aria-label={`Select ${version.version} for diff`}
                />

                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleExpand(version.id)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  aria-expanded={isExpanded}
                  aria-controls={`prompt-${version.id}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  {version.version}
                </button>

                {/* Active badge */}
                {version.isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
                    Active
                  </span>
                )}

                {/* Meta info */}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {formatTimestamp(version.createdAt)}
                </span>
              </div>

              {/* ── Secondary meta row ──────────────────────────────────── */}
              <div className="mt-1 pl-8 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                {version.createdBy && (
                  <span>
                    By&nbsp;
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {version.createdBy}
                    </span>
                  </span>
                )}
                {version.notes && (
                  <span className="italic truncate max-w-xs" title={version.notes}>
                    {version.notes}
                  </span>
                )}
              </div>

              {/* ── Actions ─────────────────────────────────────────────── */}
              {!version.isActive && (
                <div className="mt-2 pl-8">
                  <button
                    type="button"
                    onClick={() => void handleRollback(version)}
                    disabled={isRollingBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 transition-colors"
                    aria-label={`Rollback to ${version.version}`}
                  >
                    {isRollingBack ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    {isRollingBack ? 'Rolling back...' : `Rollback to ${version.version}`}
                  </button>
                </div>
              )}

              {/* ── Expanded system prompt ───────────────────────────────── */}
              {isExpanded && (
                <div id={`prompt-${version.id}`} className="mt-3 pl-8">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    System Prompt
                  </p>
                  <pre className="font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                    {version.systemPrompt || '(no prompt stored)'}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
