'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

interface Deal {
  id: string;
  name?: string;
  company?: string;
  companyName?: string;
  value?: number;
  probability?: number;
  stage?: string;
  expectedCloseDate?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function EditDealPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDeal = useCallback(async () => {
    try {
      const data = await FirestoreService.get(`organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/deals/records`, dealId);
      setDeal(data as Deal | null);
    } catch (error: unknown) {
      logger.error('Error loading deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadDeal();
  }, [loadDeal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) {
      return;
    }
    setErrorMessage(null);
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/deals/records`, dealId, { ...deal, updatedAt: Timestamp.now() });
      router.push(`/deals/${dealId}`);
    } catch (error: unknown) {
      logger.error('Error updating deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      setErrorMessage('Failed to update deal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !deal) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Deal</h1>
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-900 text-red-400 rounded-lg">
            {errorMessage}
          </div>
        )}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Deal Name</label><input type="text" value={deal.name ?? ''} onChange={(e) => setDeal({...deal, name: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={(deal.company !== '' && deal.company != null) ? deal.company : (deal.companyName ?? '')} onChange={(e) => setDeal({...deal, company: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Value ($)</label><input type="number" value={deal.value ?? 0} onChange={(e) => setDeal({...deal, value: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Probability (%)</label><input type="number" min="0" max="100" value={deal.probability ?? 50} onChange={(e) => setDeal({...deal, probability: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Stage</label><select value={(deal.stage !== '' && deal.stage != null) ? deal.stage : 'prospecting'} onChange={(e) => setDeal({...deal, stage: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"><option value="prospecting">Prospecting</option><option value="qualification">Qualification</option><option value="proposal">Proposal</option><option value="negotiation">Negotiation</option><option value="closed_won">Closed Won</option><option value="closed_lost">Closed Lost</option></select></div>
                <div><label className="block text-sm font-medium mb-2">Expected Close Date</label><input type="date" value={deal.expectedCloseDate ?? ''} onChange={(e) => setDeal({...deal, expectedCloseDate: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Notes</label><textarea value={deal.notes ?? ''} onChange={(e) => setDeal({...deal, notes: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={4} /></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




