'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign } from '@/lib/email/campaign-manager'
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

export default function NewCampaignPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState({
    name: '',
    subject: '',
    body: '',
    recipientFilters: [],
    scheduledFor: '',
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setCreating(true);
      
      await createCampaign({
        ...campaign,
        scheduledFor: campaign.scheduledFor ? new Date(campaign.scheduledFor) : new Date(),
        organizationId: DEFAULT_ORG_ID,
        createdBy: user?.id ?? 'anonymous',
      });
      
      router.push(`/email/campaigns`);
    } catch (error: unknown) {
      logger.error('Error creating campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Email Campaign</h1>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name *</label>
                <input type="text" value={campaign.name} onChange={(e) => setCampaign({...campaign, name: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Subject Line *</label>
                <input type="text" value={campaign.subject} onChange={(e) => setCampaign({...campaign, subject: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Body *</label>
                <textarea value={campaign.body} onChange={(e) => setCampaign({...campaign, body: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={10} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Schedule For (Optional)</label>
                <input type="datetime-local" value={campaign.scheduledFor} onChange={(e) => setCampaign({...campaign, scheduledFor: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={creating} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

