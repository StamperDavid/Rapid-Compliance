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
  const _orgId = params.orgId as string;
  const campaignId = params.campaignId as string;
  const { error: showError } = useToast();

  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const data = await getCampaignStats(campaignId);
      setStats(data as CampaignStats);
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
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back</button>
        <h1 className="text-3xl font-bold mb-2">{stats.name}</h1>
        <p className="text-gray-400">{stats.subject}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="text-2xl font-bold mb-1">{stats.sent ?? 0}</div>
          <div className="text-sm text-gray-400">Sent</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-blue-400">{stats.opened ?? 0}</div>
          <div className="text-sm text-gray-400">Opened ({stats.openRate ?? 0}%)</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-green-400">{stats.clicked ?? 0}</div>
          <div className="text-sm text-gray-400">Clicked ({stats.clickRate ?? 0}%)</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="text-2xl font-bold mb-1 text-red-400">{stats.bounced ?? 0}</div>
          <div className="text-sm text-gray-400">Bounced</div>
        </div>
      </div>
    </div>
  );
}




