'use client';

import { Target, ChevronRight } from 'lucide-react';
import type { IcpProfile } from '@/types/icp-profile';

interface IcpSummaryBadgeProps {
  profile: IcpProfile | null;
  onEditClick?: () => void;
}

export default function IcpSummaryBadge({ profile, onEditClick }: IcpSummaryBadgeProps) {
  if (!profile) {
    return (
      <button
        onClick={onEditClick}
        className="w-full p-3 rounded-lg border border-dashed border-[var(--color-border-light)] text-sm text-[var(--color-text-disabled)] hover:border-blue-500 hover:text-blue-400 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          <span>No ICP profile set — click to create one</span>
        </div>
      </button>
    );
  }

  const summaryParts: string[] = [];
  if (profile.targetIndustries.length > 0) {
    summaryParts.push(profile.targetIndustries.slice(0, 3).join(', '));
  }
  if (profile.companySizeRange.min > 1 || profile.companySizeRange.max < 10000) {
    summaryParts.push(`${profile.companySizeRange.min}-${profile.companySizeRange.max} employees`);
  }
  if (profile.preferredLocations.length > 0) {
    summaryParts.push(profile.preferredLocations.slice(0, 2).join(', '));
  }

  return (
    <button
      onClick={onEditClick}
      className="w-full p-3 rounded-lg bg-[var(--color-bg-main)] border border-[var(--color-border-light)] hover:border-blue-500 transition-colors text-left group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <Target className="w-4 h-4 text-cyan-400" />
          {profile.name}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--color-text-disabled)] group-hover:text-blue-400 transition-colors" />
      </div>
      {summaryParts.length > 0 && (
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
          {summaryParts.join(' · ')}
        </p>
      )}
    </button>
  );
}
