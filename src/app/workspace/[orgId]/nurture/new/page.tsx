'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function NewNurtureCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [campaign, setCampaign] = useState({ name: '', description: '', steps: [] as any[] });
  const [saving, setSaving] = useState(false);

  const addStep = () => {
    setCampaign(prev => ({
      ...prev,
      steps: [...prev.steps, { delayDays: 1, subject: '', body: '', type: 'email' }]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const campaignId = `nurture-${Date.now()}`;
      await FirestoreService.set(`organizations/${orgId}/nurtureSequences`, campaignId, {
        ...campaign,
        id: campaignId,
        status: 'draft',
        enrolled: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, false);
      router.push(`/workspace/${orgId}/nurture`);
    } catch (error) {
      logger.error('Error saving campaign:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      alert('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Nurture Campaign</h1>
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Name *</label>
              <input type="text" value={campaign.name} onChange={(e) => setCampaign({...campaign, name: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea value={campaign.description} onChange={(e) => setCampaign({...campaign, description: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={3} />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Nurture Steps</h2>
            <button onClick={addStep} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ Add Step</button>
          </div>
          <div className="space-y-3">
            {campaign.steps.map((step, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-400 mb-3">Step {idx + 1}</div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Delay (days)" value={step.delayDays} onChange={(e) => {
                    const steps = [...campaign.steps];
                    steps[idx].delayDays = parseInt(e.target.value);
                    setCampaign({...campaign, steps});
                  }} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm" />
                  <input type="text" placeholder="Subject" value={step.subject} onChange={(e) => {
                    const steps = [...campaign.steps];
                    steps[idx].subject = e.target.value;
                    setCampaign({...campaign, steps});
                  }} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm" />
                </div>
                <textarea placeholder="Email body..." value={step.body} onChange={(e) => {
                  const steps = [...campaign.steps];
                  steps[idx].body = e.target.value;
                  setCampaign({...campaign, steps});
                }} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm mt-3" rows={3} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Creating...' : 'Create Campaign'}</button>
        </div>
      </div>
    </div>
  );
}




