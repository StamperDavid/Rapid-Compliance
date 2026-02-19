'use client';

/**
 * Marketing Scraper Dashboard
 * Full management UI for the Scraper Intelligence system.
 * Start scrape jobs, view extracted signals, and manage research intelligence configs.
 * Uses PLATFORM_ID (rapid-compliance-root) for penthouse access.
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';
import SubpageNav from '@/components/ui/SubpageNav';
import type { ScrapingPlatform } from '@/types/scraper-intelligence';
import DistillationPreviewDialog from '@/components/scraper/DistillationPreviewDialog';

// ============================================================================
// TYPES
// ============================================================================

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ScraperJob {
  id: string;
  url: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  signalsFound?: number;
}

interface ScraperStartResponse {
  job: {
    id: string;
    url: string;
    type: string;
    status: 'pending';
    createdAt: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_OPTIONS: { value: ScrapingPlatform; label: string; description: string }[] = [
  { value: 'website', label: 'Website', description: 'Company website scraping' },
  { value: 'linkedin-jobs', label: 'LinkedIn Jobs', description: 'Job postings analysis' },
  { value: 'linkedin-company', label: 'LinkedIn Company', description: 'Company profile data' },
  { value: 'news', label: 'News', description: 'News articles via NewsAPI' },
  { value: 'crunchbase', label: 'Crunchbase', description: 'Funding & growth data' },
  { value: 'dns', label: 'DNS/WHOIS', description: 'Domain & infrastructure data' },
  { value: 'google-business', label: 'Google Business', description: 'Business profile data' },
  { value: 'social-media', label: 'Social Media', description: 'Social presence signals' },
];

const STATUS_STYLES: Record<JobStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(var(--color-primary-rgb), 0.1)', text: 'var(--color-primary)', label: 'Pending' },
  running: { bg: 'rgba(var(--color-warning-rgb), 0.1)', text: 'var(--color-warning)', label: 'Running' },
  completed: { bg: 'rgba(var(--color-success-rgb), 0.1)', text: 'var(--color-success)', label: 'Completed' },
  failed: { bg: 'rgba(var(--color-error-rgb), 0.1)', text: 'var(--color-error)', label: 'Failed' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScraperDashboardPage() {
  const { user } = useAuth();

  // Form state
  const [url, setUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<ScrapingPlatform>('website');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<ScraperJob[]>([]);

  // Preview dialog state
  const [previewJob, setPreviewJob] = useState<ScraperJob | null>(null);

  // Stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const totalSignals = jobs.reduce((sum, j) => sum + (j.signalsFound ?? 0), 0);
  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;

  const handleStartScrape = useCallback(async () => {
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      const response = await fetch('/api/admin/growth/scraper/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim(), type: selectedPlatform }),
      });

      if (!response.ok) {
        const text = await response.text();
        setError(`Scrape failed (${response.status}): ${text}`);
        return;
      }

      const data = (await response.json()) as ScraperStartResponse;

      // Add job to local state
      setJobs((prev) => [
        {
          id: data.job.id,
          url: data.job.url,
          type: data.job.type,
          status: data.job.status,
          createdAt: data.job.createdAt,
        },
        ...prev,
      ]);

      // Clear form
      setUrl('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Error starting scrape: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [url, selectedPlatform]);

  return (
    <div style={{ padding: '2rem' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-primary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Lead Gen / {user?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Marketing Scraper
          </h1>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            Extract business intelligence signals from websites, job boards, and social platforms.
          </p>
        </div>

        {/* Sub-page Navigation */}
        <SubpageNav items={[
          { label: 'Lead Research', href: '/leads/research' },
          { label: 'Lead Scoring', href: '/lead-scoring' },
          { label: 'Marketing Scraper', href: '/scraper' },
        ]} />

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {[
            { label: 'Total Jobs', value: totalJobs.toString(), color: 'var(--color-primary)' },
            { label: 'Completed', value: completedJobs.toString(), color: 'var(--color-success)' },
            { label: 'Signals Extracted', value: totalSignals.toString(), color: 'var(--color-cyan)' },
            { label: 'Active Jobs', value: activeJobs.toString(), color: 'var(--color-warning)' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--color-bg-paper)',
                border: '1px solid var(--color-border-main)',
                borderRadius: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Start Scrape Form */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Start New Scrape
          </h3>

          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                backgroundColor: 'rgba(var(--color-error-rgb), 0.1)',
                border: '1px solid rgba(var(--color-error-rgb), 0.3)',
                borderRadius: '0.5rem',
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* URL Input */}
            <div style={{ flex: '1 1 400px' }}>
              <label
                htmlFor="scraper-url"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.375rem',
                  fontWeight: 600,
                }}
              >
                Target URL
              </label>
              <input
                id="scraper-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-main)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-main)';
                }}
              />
            </div>

            {/* Platform Select */}
            <div style={{ flex: '0 0 220px' }}>
              <label
                htmlFor="scraper-platform"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.375rem',
                  fontWeight: 600,
                }}
              >
                Platform
              </label>
              <select
                id="scraper-platform"
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as ScrapingPlatform)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-main)',
                  borderRadius: '0.5rem',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="button"
                onClick={() => void handleStartScrape()}
                disabled={isSubmitting || !url.trim()}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: isSubmitting || !url.trim() ? 'var(--color-bg-paper)' : 'var(--color-primary)',
                  color: isSubmitting || !url.trim() ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isSubmitting || !url.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSubmitting ? 'Starting...' : 'Start Scrape'}
              </button>
            </div>
          </div>
        </div>

        {/* Platform Capabilities Grid */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Platform Capabilities
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {PLATFORM_OPTIONS.map((platform) => (
              <div
                key={platform.value}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-main)',
                  borderRadius: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  {platform.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                  {platform.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Jobs Table */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '1rem',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1.5rem 1.5rem 0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
              Recent Scrape Jobs
            </h3>
          </div>

          {jobs.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                No scrape jobs yet. Start one above to begin extracting intelligence signals.
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px',
                  gap: '1rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderTop: '1px solid var(--color-border-light)',
                  borderBottom: '1px solid var(--color-border-light)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-disabled)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <div>URL</div>
                <div>Platform</div>
                <div>Status</div>
                <div>Started</div>
                <div>Signals</div>
                <div>Actions</div>
              </div>

              {/* Table Rows */}
              {jobs.map((job) => {
                const statusStyle = STATUS_STYLES[job.status];
                return (
                  <div
                    key={job.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px',
                      gap: '1rem',
                      padding: '1rem 1.5rem',
                      borderBottom: '1px solid var(--color-border-main)',
                      alignItems: 'center',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-primary)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={job.url}
                    >
                      {job.url}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {PLATFORM_OPTIONS.find((p) => p.value === job.type)?.label ?? job.type}
                    </div>
                    <div>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          borderRadius: '9999px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {new Date(job.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-cyan)' }}>
                      {job.signalsFound ?? '--'}
                    </div>
                    <div>
                      {job.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => setPreviewJob(job)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
                            color: 'var(--color-primary)',
                            border: '1px solid rgba(var(--color-primary-rgb), 0.3)',
                            borderRadius: '0.375rem',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      ) : (
                        <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem' }}>--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Distillation Architecture Info */}
        <div
          style={{
            marginTop: '2rem',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '1rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Distillation Architecture
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-main)',
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Raw Scrapes
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', lineHeight: 1.6 }}>
                Temporary storage (7-day TTL). Raw HTML preserved for verification, then auto-deleted to prevent storage cost explosion.
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-main)',
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Signal Extraction
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', lineHeight: 1.6 }}>
                High-value signals distilled from raw content using industry-specific research intelligence configs. Only signals are stored permanently.
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-main)',
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Lead Scoring
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', lineHeight: 1.6 }}>
                Extracted signals feed into lead scoring rules. Each signal contributes a score boost based on priority and confidence level.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Distillation Preview Dialog */}
      <DistillationPreviewDialog
        open={previewJob !== null}
        onOpenChange={(open) => { if (!open) { setPreviewJob(null); } }}
        jobId={previewJob?.id ?? ''}
        jobUrl={previewJob?.url ?? ''}
        jobPlatform={previewJob?.type ?? ''}
      />
    </div>
  );
}
