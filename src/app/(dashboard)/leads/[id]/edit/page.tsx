'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { OwnerSelect } from '@/components/crm/OwnerSelect';
import { CustomFieldInputs, type CustomFieldDef, type CustomFieldRecord } from '@/lib/forms/custom-field-renderer';
import { loadCustomFields } from '@/lib/forms/custom-fields-schema';
import type { CustomFieldValue } from '@/types/crm-entities';

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
  ownerId?: string;
  customFields?: CustomFieldRecord;
}

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const authFetch = useAuthFetch();
  const leadId = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<CustomFieldRecord>({});

  const loadLead = useCallback(async () => {
    try {
      const res = await authFetch(`/api/leads/${leadId}`);
      const json = (await res.json()) as { success?: boolean; lead?: Lead };
      if (json.success && json.lead) {
        setLead(json.lead);
        setCustomValues({ ...(json.lead.customFields ?? {}) });
      }
    } catch (error: unknown) {
      logger.error('Error loading lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, leadId]);

  useEffect(() => {
    void loadLead();
    void loadCustomFields('leads', authFetch).then(setCustomFieldDefs).catch(() => setCustomFieldDefs([]));
  }, [loadLead, authFetch]);

  const handleCustomFieldChange = (key: string, value: CustomFieldValue): void => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) { return; }
    try {
      setSaving(true);
      const res = await authFetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          title: lead.title,
          status: lead.status,
          ownerId: lead.ownerId ?? '',
          customFields: customValues,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to update lead');
      }
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
              <OwnerSelect value={lead.ownerId} onChange={(ownerId) => setLead({...lead, ownerId})} id="lead-owner" />
            </div>
          </div>
          {customFieldDefs.length > 0 && (
            <div className="bg-card rounded-lg p-6 mb-4">
              <h2 className="text-lg font-semibold mb-4">Custom Fields</h2>
              <CustomFieldInputs
                fields={customFieldDefs}
                values={customValues}
                onChange={handleCustomFieldChange}
              />
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-[var(--color-bg-elevated)] rounded-lg hover:bg-[var(--color-border-light)]">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)]">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




