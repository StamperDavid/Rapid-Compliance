'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface Lead {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  company?: string;
  companyName?: string;
  title?: string;
  status?: string;
  updatedAt?: Timestamp;
}

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const leadId = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLead = useCallback(async () => {
    try {
      const data = await FirestoreService.get(`${getSubCollection('workspaces')}/default/entities/leads/records`, leadId);
      setLead(data as Lead);
    } catch (error: unknown) {
      logger.error('Error loading lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await FirestoreService.update(`${getSubCollection('workspaces')}/default/entities/leads/records`, leadId, { ...lead, updatedAt: Timestamp.now() });
      router.push(`/leads/${leadId}`);
    } catch (error: unknown) {
      logger.error('Error updating lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !lead) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Lead</h1>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">First Name</label><input type="text" value={lead.firstName ?? ''} onChange={(e) => setLead({...lead, firstName: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Last Name</label><input type="text" value={lead.lastName ?? ''} onChange={(e) => setLead({...lead, lastName: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={lead.email ?? ''} onChange={(e) => setLead({...lead, email: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Phone</label><input type="tel" value={(lead.phone !== '' && lead.phone != null) ? lead.phone : (lead.phoneNumber ?? '')} onChange={(e) => setLead({...lead, phone: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={(lead.company !== '' && lead.company != null) ? lead.company : (lead.companyName ?? '')} onChange={(e) => setLead({...lead, company: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Title</label><input type="text" value={lead.title ?? ''} onChange={(e) => setLead({...lead, title: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Status</label><select value={(lead.status !== '' && lead.status != null) ? lead.status : 'new'} onChange={(e) => setLead({...lead, status: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option></select></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-[var(--color-bg-elevated)] rounded-lg hover:bg-[var(--color-border-light)]">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)]">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




