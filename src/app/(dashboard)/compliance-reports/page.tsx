'use client';

/**
 * Compliance Reports
 * Regulatory and compliance reporting dashboard.
 * Uses getSubCollection() for penthouse-model Firestore access.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { ANALYTICS_TABS } from '@/lib/constants/subpage-nav';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

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
          getSubCollection('complianceReports')
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
      <div className="p-8">
        <PageTitle className="mb-2">Compliance Reports</PageTitle>
        <SectionDescription>Loading...</SectionDescription>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={ANALYTICS_TABS} />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-primary font-semibold uppercase tracking-wider">
            Command Center / {user?.email}
          </span>
        </div>
        <PageTitle className="mb-1">Compliance Reports</PageTitle>
        <SectionDescription>Regulatory compliance dashboard for SalesVelocity.ai</SectionDescription>
      </div>

      {/* Empty State */}
      {reports.length === 0 && (
        <div className="p-12 bg-surface-elevated border border-border-light rounded-xl text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No Compliance Reports Found
          </h2>
          <SectionDescription>
            Compliance reports will appear here once audits are configured and completed.
          </SectionDescription>
        </div>
      )}

      {/* Summary Cards */}
      {reports.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-surface-elevated border border-border-light rounded-xl">
              <div className="text-xs text-muted-foreground mb-2">Overall Score</div>
              <div
                className="text-5xl font-black"
                style={{ color: overallScore >= 90 ? 'var(--color-success)' : overallScore >= 70 ? 'var(--color-warning)' : 'var(--color-error)' }}
              >
                {overallScore}
              </div>
              <div className="text-xs text-muted-foreground">out of 100</div>
            </div>

            <div className="p-6 bg-surface-elevated border border-border-light rounded-xl">
              <div className="text-xs text-muted-foreground mb-2">Compliant</div>
              <div className="text-5xl font-black" style={{ color: 'var(--color-success)' }}>
                {compliantCount}
              </div>
              <div className="text-xs text-muted-foreground">of {reports.length} areas</div>
            </div>

            <div className="p-6 bg-surface-elevated border border-border-light rounded-xl">
              <div className="text-xs text-muted-foreground mb-2">Review Needed</div>
              <div className="text-5xl font-black" style={{ color: 'var(--color-warning)' }}>
                {reviewCount}
              </div>
              <div className="text-xs text-muted-foreground">areas flagged</div>
            </div>

            <div className="p-6 bg-surface-elevated border border-border-light rounded-xl">
              <div className="text-xs text-muted-foreground mb-2">Pending Audit</div>
              <div className="text-5xl font-black text-primary">
                {pendingCount}
              </div>
              <div className="text-xs text-muted-foreground">awaiting review</div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors border"
                style={{
                  backgroundColor: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: selectedCategory === cat ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  borderColor: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-border-light)',
                  fontWeight: selectedCategory === cat ? 600 : 400,
                }}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          {/* Reports Table */}
          <div className="bg-surface-elevated border border-border-light rounded-xl overflow-hidden">
            {/* Table Header */}
            <div
              className="grid gap-4 px-6 py-4 bg-card border-b border-border-light text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
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
                  className="grid gap-4 px-6 py-5 border-b border-border-main items-center transition-colors hover:bg-card"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
                >
                  <div className="text-sm font-semibold text-foreground">
                    {report.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.category}
                  </div>
                  <div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.lastAudit}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.nextReview}
                  </div>
                  <div
                    className="text-base font-bold"
                    style={{
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
  );
}
