'use client';

/**
 * PlatformHeaderBand — large color band at the top of every per-platform
 * Social Hub dashboard.
 *
 * Renders the platform's brand color as a full-width header with the platform
 * label on the left and account/status info on the right. The brand color
 * comes from `PLATFORM_META[platform].color` (a hex string), which is the
 * documented exception in CLAUDE.md for the only inline `style` use allowed
 * here.
 */

import * as React from 'react';
import type { SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle } from '@/components/ui/typography';

export type PlatformHeaderStatus =
  | 'connected'
  | 'available'
  | 'external_block'
  | 'no_dm'
  | 'no_specialist'
  | 'coming_soon'
  | 'parked';

export interface PlatformHeaderBandProps {
  platform: SocialPlatform;
  account?: {
    handle: string;
    accountName?: string;
  };
  status: PlatformHeaderStatus;
  /** Shown when status is 'external_block' or 'parked'. */
  blockReason?: string;
}

interface StatusPillContent {
  /** Tailwind color class for the leading dot (or null for no dot). */
  dotClass: string | null;
  label: string;
  /** Color class for the pill's background tint over the brand color. */
  pillClass: string;
}

function buildStatusPill(
  status: PlatformHeaderStatus,
  blockReason?: string,
): StatusPillContent {
  switch (status) {
    case 'connected':
      return {
        dotClass: 'bg-green-400',
        label: 'Connected',
        pillClass: 'bg-white/15 text-white',
      };
    case 'available':
      return {
        dotClass: 'bg-white/60',
        label: 'Connect to start',
        pillClass: 'bg-white/15 text-white',
      };
    case 'external_block':
      return {
        dotClass: 'bg-amber-300',
        label: blockReason
          ? `DM blocked: ${blockReason}`
          : 'DM blocked',
        pillClass: 'bg-white/15 text-white',
      };
    case 'no_dm':
      return {
        dotClass: null,
        label: 'No DM concept on this platform',
        pillClass: 'bg-white/15 text-white/90',
      };
    case 'no_specialist':
      return {
        dotClass: 'bg-amber-300',
        label: 'AI specialist coming soon',
        pillClass: 'bg-white/15 text-white',
      };
    case 'coming_soon':
      return {
        dotClass: 'bg-amber-300',
        label: 'Coming soon',
        pillClass: 'bg-white/15 text-white',
      };
    case 'parked':
      return {
        dotClass: 'bg-red-400',
        label: blockReason ? `Parked: ${blockReason}` : 'Parked',
        pillClass: 'bg-white/15 text-white',
      };
  }
}

export default function PlatformHeaderBand({
  platform,
  account,
  status,
  blockReason,
}: PlatformHeaderBandProps): React.JSX.Element {
  const meta = PLATFORM_META[platform];
  const pill = buildStatusPill(status, blockReason);

  return (
    <div
      // Dynamic platform brand color — documented exception in CLAUDE.md.
      style={{ backgroundColor: meta.color }}
      className="w-full px-8 py-6 flex items-center justify-between gap-4 rounded-2xl shadow-sm"
    >
      {/* Left: large icon chip + platform label */}
      <div className="flex items-center gap-4 min-w-0">
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl font-bold text-white"
        >
          {meta.icon}
        </div>
        <div className="min-w-0">
          <PageTitle className="text-white truncate">{meta.label}</PageTitle>
          {account?.accountName && (
            <p className="text-sm text-white/80 truncate">{account.accountName}</p>
          )}
        </div>
      </div>

      {/* Right: handle + status pill */}
      <div className="flex items-center gap-3 shrink-0">
        {account?.handle && (
          <span className="text-sm font-medium text-white/90 hidden sm:inline">
            @{account.handle.replace(/^@/, '')}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${pill.pillClass}`}
        >
          {pill.dotClass && (
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${pill.dotClass}`}
            />
          )}
          {pill.label}
        </span>
      </div>
    </div>
  );
}
