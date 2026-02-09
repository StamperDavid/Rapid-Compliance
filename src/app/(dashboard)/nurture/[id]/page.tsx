'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface NurtureCampaignData {
  name: string;
  description: string | null;
  status: string;
}

export default function EditNurtureCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<NurtureCampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const data = await FirestoreService.get(getSubCollection('nurtureSequences'), campaignId);
      setCampaign(data as NurtureCampaignData);
    } catch (error) {
      logger.error('Error loading campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  const handleSave = async () => {
    if (!campaign) {
      return;
    }

    try {
      setSaving(true);
      await FirestoreService.update(getSubCollection('nurtureSequences'), campaignId, { ...campaign, updatedAt: Timestamp.now() });
      router.push(`/nurture`);
    } catch (error) {
      logger.error('Error saving campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !campaign) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Nurture Campaign</h1>
        <div className="bg-surface-paper rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2">Name</label><input type="text" value={campaign.name} onChange={(e) => setCampaign({...campaign, name: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-2">Description</label><textarea value={campaign.description ?? ''} onChange={(e) => setCampaign({...campaign, description: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg" rows={3} /></div>
            <div><label className="block text-sm font-medium mb-2">Status</label><select value={campaign.status} onChange={(e) => setCampaign({...campaign, status: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg"><option value="active">Active</option><option value="paused">Paused</option><option value="draft">Draft</option></select></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}




