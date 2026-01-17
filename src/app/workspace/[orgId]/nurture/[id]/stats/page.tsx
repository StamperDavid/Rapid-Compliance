'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

export default function NurtureCampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaign();
  }, []);

  const loadCampaign = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/nurtureSequences`, campaignId);
      setCampaign(data);
    } catch (error) {
      logger.error('Error loading campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !campaign) {return <div className="p-8">Loading...</div>;}

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




