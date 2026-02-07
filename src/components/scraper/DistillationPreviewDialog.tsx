'use client';

/**
 * Distillation Preview Dialog
 * Shows extracted signals and storage metrics for a completed scraper job.
 * Uses inline styles with CSS variables to match the scraper dashboard page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase/config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ============================================================================
// TYPES
// ============================================================================

interface SerializedSignal {
  signalId: string;
  signalLabel: string;
  sourceText: string;
  confidence: number;
  platform: string;
  extractedAt: string;
  sourceScrapeId: string;
}

interface ArchiveInfo {
  url: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  scrapeCount: number;
  verified: boolean;
}

interface DistillationPreviewData {
  signals: SerializedSignal[];
  archive: ArchiveInfo | null;
  analytics: {
    totalSignals: number;
    averageConfidence: number;
    signalsByPlatform: Record<string, number>;
  };
}

interface DistillationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobUrl: string;
  jobPlatform: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) { return '0 B'; }
  const units = ['B', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getConfidenceColor(confidence: number): { bg: string; text: string } {
  if (confidence >= 80) { return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--color-success)' }; }
  if (confidence >= 60) { return { bg: 'rgba(6, 182, 212, 0.15)', text: 'var(--color-cyan)' }; }
  return { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--color-warning)' };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DistillationPreviewDialog({
  open,
  onOpenChange,
  jobId,
  jobUrl,
  jobPlatform,
}: DistillationPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DistillationPreviewData | null>(null);

  const fetchResults = useCallback(async () => {
    if (!jobId) { return; }

    setLoading(true);
    setError(null);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `/api/admin/growth/scraper/results?scrapeId=${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      const json = (await response.json()) as DistillationPreviewData;
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open && jobId) {
      void fetchResults();
    }
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, jobId, fetchResults]);

  const sortedSignals = data?.signals
    .slice()
    .sort((a, b) => b.confidence - a.confidence) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Distillation Results</DialogTitle>
          <DialogDescription>
            Extracted signals for {jobUrl} ({jobPlatform})
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div
              style={{
                display: 'inline-block',
                width: '2rem',
                height: '2rem',
                border: '3px solid var(--color-border-light)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ marginTop: '0.75rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Loading distillation results...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              color: 'var(--color-error)',
              fontSize: '0.875rem',
            }}
          >
            Failed to load results: {error}
          </div>
        )}

        {/* Results */}
        {!loading && !error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {data.analytics.totalSignals}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                  Signals Found
                </div>
              </div>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>
                  {data.analytics.averageConfidence}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                  Avg Confidence
                </div>
              </div>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border-light)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-cyan)' }}>
                  {formatBytes(data.archive?.sizeBytes)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                  Archive Size
                </div>
              </div>
            </div>

            {/* Archive Expiry Notice */}
            {data.archive === null && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-warning)',
                  fontSize: '0.8125rem',
                }}
              >
                Archive data has expired or is not available. Only extracted signals are shown.
              </div>
            )}

            {/* Platform Breakdown */}
            {Object.keys(data.analytics.signalsByPlatform).length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(data.analytics.signalsByPlatform).map(([platform, count]) => (
                  <span
                    key={platform}
                    style={{
                      padding: '0.25rem 0.625rem',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      color: 'var(--color-primary)',
                      borderRadius: '9999px',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                    }}
                  >
                    {platform}: {count}
                  </span>
                ))}
              </div>
            )}

            {/* Signals Table */}
            {sortedSignals.length > 0 ? (
              <div
                style={{
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 80px 1fr 2fr',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    borderBottom: '1px solid var(--color-border-light)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-disabled)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <div>Signal</div>
                  <div>Confidence</div>
                  <div>Platform</div>
                  <div>Source Text</div>
                </div>

                {/* Table Rows */}
                {sortedSignals.map((signal, index) => {
                  const confidenceStyle = getConfidenceColor(signal.confidence);
                  return (
                    <div
                      key={`${signal.signalId}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 80px 1fr 2fr',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderBottom:
                          index < sortedSignals.length - 1
                            ? '1px solid var(--color-border-main)'
                            : 'none',
                        alignItems: 'center',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {signal.signalLabel}
                      </div>
                      <div>
                        <span
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: confidenceStyle.bg,
                            color: confidenceStyle.text,
                            borderRadius: '9999px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                          }}
                        >
                          {signal.confidence}%
                        </span>
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                        {signal.platform}
                      </div>
                      <div
                        style={{
                          color: 'var(--color-text-disabled)',
                          fontSize: '0.75rem',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                        title={signal.sourceText}
                      >
                        {signal.sourceText}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--color-text-disabled)',
                  fontSize: '0.875rem',
                }}
              >
                No signals extracted for this scrape.
              </div>
            )}

            {/* Archive Details */}
            {data.archive && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-disabled)',
                  padding: '0.5rem 0',
                  borderTop: '1px solid var(--color-border-main)',
                }}
              >
                <span>Scraped {data.archive.scrapeCount} time{data.archive.scrapeCount !== 1 ? 's' : ''}</span>
                <span>
                  Expires {new Date(data.archive.expiresAt).toLocaleDateString()}
                </span>
                {data.archive.verified && (
                  <span style={{ color: 'var(--color-success)' }}>Verified</span>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
