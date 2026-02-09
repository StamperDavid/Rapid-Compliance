'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCampaignStats } from '@/lib/email/campaign-manager';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface CampaignStats {
  name: string;
  subject: string;
  sent: number;
  opened: number;
  openRate: number;
  clicked: number;
  clickRate: number;
  bounced: number;
}

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  const { error: showError } = useToast();

  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const data = await getCampaignStats(campaignId);
      setStats(data as unknown as CampaignStats);
    } catch (error: unknown) {
      logger.error('Error loading campaign stats:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      showError('Failed to load campaign statistics');
    } finally {
      setLoading(false);
    }
  }, [campaignId, showError]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading || !stats) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary hover:text-primary-light mb-4">← Back</button>
        <h1 className="text-3xl font-bold mb-2">{stats.name}</h1>
        <p className="text-[var(--color-text-secondary)]">{stats.subject}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-2xl font-bold mb-1">{stats.sent ?? 0}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Sent</div>
        </div>
        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-primary">{stats.opened ?? 0}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Opened ({stats.openRate ?? 0}%)</div>
        </div>
        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-success">{stats.clicked ?? 0}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Clicked ({stats.clickRate ?? 0}%)</div>
        </div>
        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-error">{stats.bounced ?? 0}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Bounced</div>
        </div>
      </div>
    </div>
  );
}




