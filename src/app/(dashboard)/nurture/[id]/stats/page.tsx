'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

interface NurtureCampaignStats {
  name: string;
  description: string | null;
  enrolled: number;
  completed: number;
  active: number;
  converted: number;
}

export default function NurtureCampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<NurtureCampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCampaign = useCallback(async () => {
    try {
      const data = await FirestoreService.get(`organizations/${DEFAULT_ORG_ID}/nurtureSequences`, campaignId);
      setCampaign(data as NurtureCampaignStats);
    } catch (error) {
      logger.error('Error loading campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  if (loading || !campaign) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-400 hover:text-blue-300 mb-4">← Back</button>
        <h1 className="text-3xl font-bold mb-2">{campaign.name}</h1>
        <p className="text-gray-400">{campaign.description}</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-6"><div className="text-2xl font-bold mb-1">{campaign.enrolled ?? 0}</div><div className="text-sm text-gray-400">Enrolled</div></div>
        <div className="bg-gray-900 rounded-lg p-6"><div className="text-2xl font-bold mb-1 text-green-400">{campaign.completed ?? 0}</div><div className="text-sm text-gray-400">Completed</div></div>
        <div className="bg-gray-900 rounded-lg p-6"><div className="text-2xl font-bold mb-1 text-blue-400">{campaign.active ?? 0}</div><div className="text-sm text-gray-400">Active</div></div>
        <div className="bg-gray-900 rounded-lg p-6"><div className="text-2xl font-bold mb-1 text-yellow-400">{campaign.converted ?? 0}</div><div className="text-sm text-gray-400">Converted</div></div>
      </div>
    </div>
  );
}




