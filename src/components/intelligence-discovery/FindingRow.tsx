/**
 * FindingRow — Single row in the findings table
 *
 * Displays seed data, enrichment status, contact info, confidence, and actions.
 */

'use client';

import React from 'react';
import {
  Phone,
  Mail,
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Copy,
  GitBranch,
} from 'lucide-react';
import type { DiscoveryFinding, EnrichmentStatus, ApprovalStatus } from '@/types/intelligence-discovery';

interface FindingRowProps {
  finding: DiscoveryFinding;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEnrich: () => void;
}

const ENRICHMENT_BADGES: Record<EnrichmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--color-text-disabled)', bg: 'var(--color-bg-elevated)' },
  in_progress: { label: 'Enriching...', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)' },
  enriched: { label: 'Enriched', color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)' },
  partial: { label: 'Partial', color: 'var(--color-info)', bg: 'rgba(59,130,246,0.1)' },
  failed: { label: 'Failed', color: 'var(--color-error)', bg: 'rgba(239,68,68,0.1)' },
};

const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'var(--color-text-disabled)' },
  approved: { label: 'Approved', color: 'var(--color-success)' },
  rejected: { label: 'Rejected', color: 'var(--color-error)' },
  converted: { label: 'Converted', color: 'var(--color-cyan)' },
};

function EnrichmentIcon({ status }: { status: EnrichmentStatus }) {
  switch (status) {
    case 'pending': return <Clock className="w-3 h-3" />;
    case 'in_progress': return <RefreshCw className="w-3 h-3 animate-spin" />;
    case 'enriched': return <CheckCircle className="w-3 h-3" />;
    case 'partial': return <AlertTriangle className="w-3 h-3" />;
    case 'failed': return <XCircle className="w-3 h-3" />;
  }
}

function confidenceColor(score: number): string {
  if (score >= 70) { return 'var(--color-success)'; }
  if (score >= 40) { return 'var(--color-warning)'; }
  return 'var(--color-error)';
}

export default function FindingRow({
  finding,
  isSelected,
  onToggleSelect,
  onApprove,
  onReject,
  onEnrich,
}: FindingRowProps) {
  const seed = finding.seedData;
  const entityName = seed.company_name ?? seed.business_name ?? seed.entity_name ?? 'Unknown';
  const address = seed.physical_address ?? seed.principal_address ?? seed.mailing_address ?? '';
  const ownerName = seed.owner_name ?? seed.officer_name ?? seed.poc_name ?? '';
  const enrichment = ENRICHMENT_BADGES[finding.enrichmentStatus];
  const approval = APPROVAL_BADGES[finding.approvalStatus];

  const hasPhone = finding.enrichedData.phones.length > 0;
  const hasEmail = finding.enrichedData.emails.length > 0;
  const hasSocial = Object.keys(finding.enrichedData.socialMedia).length > 0;
  const hasWebsite = finding.enrichedData.website !== null;
  const isDuplicate = Boolean(finding.duplicateOf);
  const hasConflicts = finding.fieldConflicts && Object.keys(finding.fieldConflicts).length > 0;
  const conflictCount = hasConflicts ? Object.keys(finding.fieldConflicts ?? {}).length : 0;

  return (
    <div
      className={`px-4 py-3 border-b border-[var(--color-border-light)] transition-colors hover:bg-[var(--color-bg-elevated)] ${
        isSelected ? 'bg-[var(--color-cyan)]/5 border-l-2 border-l-[var(--color-cyan)]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 rounded border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] text-[var(--color-cyan)] focus:ring-[var(--color-cyan)]"
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Entity name + owner */}
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {entityName}
            </h4>
            {ownerName && (
              <span className="text-xs text-[var(--color-text-secondary)] truncate">
                — {ownerName}
              </span>
            )}
          </div>

          {/* Address + seed data highlights */}
          {address && (
            <p className="text-xs text-[var(--color-text-disabled)] truncate mt-0.5">
              {address}
            </p>
          )}

          {/* Contact indicators */}
          <div className="flex items-center gap-3 mt-2">
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: hasPhone ? 'var(--color-success)' : 'var(--color-text-disabled)' }}
            >
              <Phone className="w-3 h-3" />
              {hasPhone ? finding.enrichedData.phones[0] : 'No phone'}
            </span>
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: hasEmail ? 'var(--color-success)' : 'var(--color-text-disabled)' }}
            >
              <Mail className="w-3 h-3" />
              {hasEmail ? finding.enrichedData.emails[0] : 'No email'}
            </span>
            {hasWebsite && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-info)]">
                <Globe className="w-3 h-3" />
                Website
              </span>
            )}
            {hasSocial && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-primary)]">
                <Share2 className="w-3 h-3" />
                Social
              </span>
            )}
            {isDuplicate && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]" title={`Duplicate of ${finding.duplicateOf}`}>
                <Copy className="w-3 h-3" />
                Duplicate
              </span>
            )}
            {hasConflicts && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]" title={`${conflictCount} field conflict${conflictCount > 1 ? 's' : ''} — click to resolve`}>
                <GitBranch className="w-3 h-3" />
                {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Right side — badges + actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Confidence score */}
          <div
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              color: confidenceColor(finding.overallConfidence),
              backgroundColor: `color-mix(in srgb, ${confidenceColor(finding.overallConfidence)} 10%, transparent)`,
            }}
          >
            {finding.overallConfidence}%
          </div>

          {/* Enrichment badge */}
          <span
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: enrichment.color, backgroundColor: enrichment.bg }}
          >
            <EnrichmentIcon status={finding.enrichmentStatus} />
            {enrichment.label}
          </span>

          {/* Approval badge */}
          {finding.approvalStatus !== 'pending' && (
            <span className="text-[10px]" style={{ color: approval.color }}>
              {approval.label}
            </span>
          )}

          {/* Action buttons */}
          {finding.approvalStatus === 'pending' && (
            <div className="flex gap-1 mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                className="p-1 rounded hover:bg-[var(--color-success)]/10 transition-colors"
                title="Approve"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-[var(--color-success)]" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="p-1 rounded hover:bg-[var(--color-error)]/10 transition-colors"
                title="Reject"
              >
                <ThumbsDown className="w-3.5 h-3.5 text-[var(--color-error)]" />
              </button>
              {finding.enrichmentStatus === 'pending' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEnrich(); }}
                  className="p-1 rounded hover:bg-[var(--color-cyan)]/10 transition-colors"
                  title="Enrich"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
