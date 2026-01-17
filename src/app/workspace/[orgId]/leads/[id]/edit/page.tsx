'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const leadId = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLead();
  }, []);

  const loadLead = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/leads/records`, leadId);
      setLead(data);
    } catch (error: unknown) {
      logger.error('Error loading lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${orgId}/workspaces/default/entities/leads/records`, leadId, { ...lead, updatedAt: Timestamp.now() });
      router.push(`/workspace/${orgId}/leads/${leadId}`);
    } catch (error: unknown) {
      logger.error('Error updating lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      alert('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !lead) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Lead</h1>
        <form onSubmit={handleSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name</label><input type="text" value={lead.firstName ?? ''} onChange={(e) => setLead({...lead, firstName: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name</label><input type="text" value={lead.lastName ?? ''} onChange={(e) => setLead({...lead, lastName: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={lead.email ?? ''} onChange={(e) => setLead({...lead, email: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={(lead.phone !== '' && lead.phone != null) ? lead.phone : (lead.phoneNumber ?? '')} onChange={(e) => setLead({...lead, phone: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={(lead.company !== '' && lead.company != null) ? lead.company : (lead.companyName ?? '')} onChange={(e) => setLead({...lead, company: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={lead.title ?? ''} onChange={(e) => setLead({...lead, title: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Status</label><select value={(lead.status !== '' && lead.status != null) ? lead.status : 'new'} onChange={(e) => setLead({...lead, status: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option></select></div>
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




