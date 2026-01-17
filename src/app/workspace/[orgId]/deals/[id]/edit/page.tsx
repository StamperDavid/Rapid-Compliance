'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function EditDealPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const dealId = params.id as string;
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDeal();
  }, []);

  const loadDeal = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/deals/records`, dealId);
      setDeal(data);
    } catch (error: unknown) {
      logger.error('Error loading deal:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${orgId}/workspaces/default/entities/deals/records`, dealId, { ...deal, updatedAt: Timestamp.now() });
      router.push(`/workspace/${orgId}/deals/${dealId}`);
    } catch (error: unknown) {
      logger.error('Error updating deal:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      alert('Failed to update deal');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !deal) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Deal</h1>
        <form onSubmit={handleSubmit}>
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




