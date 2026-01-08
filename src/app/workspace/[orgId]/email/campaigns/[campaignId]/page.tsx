'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCampaignStats } from '@/lib/email/campaign-manager'
import { logger } from '@/lib/logger/logger';;

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const campaignId = params.campaignId as string;

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getCampaignStats(campaignId);
      setStats(data);
    } catch (error) {
      logger.error('Error loading campaign stats:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

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




