'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function NewLeadPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [lead, setLead] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', source: '', status: 'new' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const leadId = `lead-${Date.now()}`;
      await FirestoreService.set(`organizations/${orgId}/workspaces/default/entities/leads/records`, leadId, { ...lead, id: leadId, score: 50, createdAt: Timestamp.now() }, false);
      router.push(`/workspace/${orgId}/leads`);
    } catch (error) {
      logger.error('Error creating lead:', error, { file: 'page.tsx' });
      alert('Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Lead</h1>
        <form onSubmit={handleSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name *</label><input type="text" value={lead.firstName} onChange={(e) => setLead({...lead, firstName: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name *</label><input type="text" value={lead.lastName} onChange={(e) => setLead({...lead, lastName: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email *</label><input type="email" value={lead.email} onChange={(e) => setLead({...lead, email: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={lead.phone} onChange={(e) => setLead({...lead, phone: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={lead.company} onChange={(e) => setLead({...lead, company: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={lead.title} onChange={(e) => setLead({...lead, title: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Source</label><input type="text" value={lead.source} onChange={(e) => setLead({...lead, source: e.target.value})} placeholder="e.g., Website, Referral, LinkedIn" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Creating...' : 'Create Lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

