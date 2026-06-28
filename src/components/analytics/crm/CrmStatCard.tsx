'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

interface CrmStatCardProps {
  label: string;
  value: string;
  /** Optional small line under the value (e.g. a comparison or count) */
  sublabel?: string;
  /** Optional tone for the value text */
  tone?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
}

const toneClass: Record<NonNullable<CrmStatCardProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

/**
 * Compact KPI card used across the CRM Dashboard. Pure presentation —
 * all numbers are passed in from real API data by the parent page.
 */
export function CrmStatCard({ label, value, sublabel, tone = 'default', loading = false }: CrmStatCardProps) {
  return (
    <Card className="p-6 bg-card border border-border-light rounded-2xl">
      <Caption className="uppercase tracking-wide text-muted-foreground">{label}</Caption>
      {loading ? (
        <div className="mt-2 h-9 w-24 animate-pulse rounded bg-surface-elevated" />
      ) : (
        <div className={cn('mt-2 text-3xl font-bold', toneClass[tone])}>{value}</div>
      )}
      {sublabel && !loading && (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      )}
    </Card>
  );
}
