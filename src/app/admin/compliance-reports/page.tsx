'use client';

/**
 * Admin Compliance Reports
 * Regulatory and compliance reporting dashboard.
 * Uses DEFAULT_ORG_ID (rapid-compliance-root) for single-tenant access.
 */

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
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
  compliant: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Compliant' },
  'review-needed': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Review Needed' },
  'non-compliant': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', label: 'Non-Compliant' },
  pending: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1', label: 'Pending' },
};

export default function AdminComplianceReportsPage() {
  const { adminUser } = useAdminAuth();
  const _orgId = DEFAULT_ORG_ID;
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
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Compliance Reports
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Loading...</p>
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
            <span style={{ fontSize: '0.6875rem', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin / {adminUser?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Compliance Reports
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Regulatory compliance dashboard for RapidCompliance.US
          </p>
        </div>

        {/* Empty State */}
        {reports.length === 0 && (
          <div
            style={{
              padding: '3rem',
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '0.75rem',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>
              No Compliance Reports Found
            </h2>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
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
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #1a1a1a',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Overall Score</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: overallScore >= 90 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#ef4444' }}>
                  {overallScore}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#555' }}>out of 100</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #1a1a1a',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Compliant</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981' }}>
                  {compliantCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#555' }}>of {reports.length} areas</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #1a1a1a',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Review Needed</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b' }}>
                  {reviewCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#555' }}>areas flagged</div>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #1a1a1a',
                  borderRadius: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Pending Audit</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6366f1' }}>
                  {pendingCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#555' }}>awaiting review</div>
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
                    backgroundColor: selectedCategory === cat ? '#6366f1' : '#1a1a1a',
                    color: selectedCategory === cat ? '#fff' : '#999',
                    border: `1px solid ${selectedCategory === cat ? '#6366f1' : '#333'}`,
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
                backgroundColor: '#0a0a0a',
                border: '1px solid #1a1a1a',
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
                  backgroundColor: '#111',
                  borderBottom: '1px solid #1a1a1a',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#666',
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
                      borderBottom: '1px solid #141414',
                      alignItems: 'center',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#111';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                      {report.title}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#999' }}>
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
                    <div style={{ fontSize: '0.8125rem', color: '#999' }}>
                      {report.lastAudit}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#999' }}>
                      {report.nextReview}
                    </div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color:
                          report.score >= 90
                            ? '#10b981'
                            : report.score >= 70
                              ? '#f59e0b'
                              : '#ef4444',
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
