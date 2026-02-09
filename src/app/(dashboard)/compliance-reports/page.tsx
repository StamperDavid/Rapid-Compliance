'use client';

/**
 * Compliance Reports
 * Regulatory and compliance reporting dashboard.
 * Uses DEFAULT_ORG_ID (rapid-compliance-root) for penthouse access.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

interface ComplianceReport {
  id: string;
  title: string;
  category: string;
  status: 'compliant' | 'review-needed' | 'non-compliant' | 'pending';
  lastAudit: string;
  nextReview: string;
  score: number;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: 'rgba(var(--color-success-rgb), 0.1)', text: 'var(--color-success)', label: 'Compliant' },
  'review-needed': { bg: 'rgba(var(--color-warning-rgb), 0.1)', text: 'var(--color-warning)', label: 'Review Needed' },
  'non-compliant': { bg: 'rgba(var(--color-error-rgb), 0.1)', text: 'var(--color-error)', label: 'Non-Compliant' },
  pending: { bg: 'rgba(var(--color-primary-rgb), 0.1)', text: 'var(--color-primary)', label: 'Pending' },
};

export default function ComplianceReportsPage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplianceReports = async () => {
      try {
        setLoading(true);
        const result = await FirestoreService.getAll<ComplianceReport>(
          `organizations/${DEFAULT_ORG_ID}/complianceReports`
        );
        setReports(result);
      } catch (error) {
        logger.error('Failed to fetch compliance reports', error instanceof Error ? error : undefined);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchComplianceReports();
  }, []);

  const categories = ['all', ...Array.from(new Set(reports.map((r) => r.category)))];

  const filteredReports =
    selectedCategory === 'all'
      ? reports
      : reports.filter((r) => r.category === selectedCategory);

  const overallScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length)
    : 0;

  const compliantCount = reports.filter((r) => r.status === 'compliant').length;
  const reviewCount = reports.filter((r) => r.status === 'review-needed').length;
  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Compliance Reports
            </h1>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Command Center / {user?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Compliance Reports
          </h1>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            Regulatory compliance dashboard for SalesVelocity.ai
          </p>
        </div>

        {/* Empty State */}
        {reports.length === 0 && (
          <div
            style={{
              padding: '3rem',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              No Compliance Reports Found
            </h2>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Compliance reports will appear here once audits are configured and completed.
            </p>
          </div>
        )}

        {/* Summary Cards */}
        {reports.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
              }}
            >
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Overall Score</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: overallScore >= 90 ? 'var(--color-success)' : overallScore >= 70 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                  {overallScore}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>out of 100</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Compliant</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {compliantCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>of {reports.length} areas</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Review Needed</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-warning)' }}>
                  {reviewCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>areas flagged</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Pending Audit</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {pendingCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>awaiting review</div>
              </div>
            </div>

            {/* Category Filter */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                    color: selectedCategory === cat ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: `1px solid ${selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: selectedCategory === cat ? 600 : 400,
                  }}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Reports Table */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.75rem',
                overflow: 'hidden',
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                  gap: '1rem',
                  padding: '1rem 1.5rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderBottom: '1px solid var(--color-border-light)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-disabled)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <div>Report</div>
                <div>Category</div>
                <div>Status</div>
                <div>Last Audit</div>
                <div>Next Review</div>
                <div>Score</div>
              </div>

              {/* Table Rows */}
              {filteredReports.map((report) => {
                const statusStyle = STATUS_CONFIG[report.status];
                return (
                  <div
                    key={report.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                      gap: '1rem',
                      padding: '1.25rem 1.5rem',
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
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {report.title}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {report.category}
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
                      {report.lastAudit}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {report.nextReview}
                    </div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color:
                          report.score >= 90
                            ? 'var(--color-success)'
                            : report.score >= 70
                              ? 'var(--color-warning)'
                              : 'var(--color-error)',
                      }}
                    >
                      {report.score}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
