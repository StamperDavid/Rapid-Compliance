'use client';

import { Building, MapPin, Users, Check, X, ArrowRight } from 'lucide-react';
import type { DiscoveryResult } from '@/types/discovery-batch';

interface ResultCardProps {
  result: DiscoveryResult;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onConvert: () => void;
}

function scoreColor(score: number): string {
  if (score >= 70) {return 'text-green-400';}
  if (score >= 40) {return 'text-yellow-400';}
  return 'text-red-400';
}

function scoreBgColor(score: number): string {
  if (score >= 70) {return 'bg-green-500/10 border-green-500/30';}
  if (score >= 40) {return 'bg-yellow-500/10 border-yellow-500/30';}
  return 'bg-red-500/10 border-red-500/30';
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', cls: 'bg-green-500/10 text-green-400 border-green-500/30' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
    case 'converted':
      return { label: 'Converted', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    default:
      return { label: 'Pending', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' };
  }
}

export default function ResultCard({
  result,
  isSelected,
  onToggleSelect,
  onApprove,
  onReject,
  onConvert,
}: ResultCardProps) {
  const company = result.companyData;
  const badge = statusBadge(result.status);
  const locationParts = [company.city, company.state, company.country].filter(Boolean);

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-light)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1 rounded border-[var(--color-border-light)] bg-[var(--color-bg-main)]"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {company.companyName ?? company.domain ?? 'Unknown Company'}
              </h4>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
              {company.industry && (
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  {company.industry}
                </span>
              )}
              {(company.employeeCount ?? company.companySize) && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {company.employeeCount ?? company.companySize}
                </span>
              )}
              {locationParts.length > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {locationParts.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`text-center px-2 py-1 rounded border ${scoreBgColor(result.icpScore)}`}>
          <div className={`text-lg font-bold ${scoreColor(result.icpScore)}`}>
            {Math.round(result.icpScore)}
          </div>
          <div className="text-[10px] text-[var(--color-text-disabled)]">ICP</div>
        </div>
      </div>

      {result.status === 'pending' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--color-border-light)]">
          <button
            onClick={onApprove}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-colors"
          >
            <Check className="w-3 h-3" /> Approve
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            <X className="w-3 h-3" /> Reject
          </button>
        </div>
      )}

      {result.status === 'approved' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--color-border-light)]">
          <button
            onClick={onConvert}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
          >
            <ArrowRight className="w-3 h-3" /> Convert to Lead
          </button>
        </div>
      )}
    </div>
  );
}
