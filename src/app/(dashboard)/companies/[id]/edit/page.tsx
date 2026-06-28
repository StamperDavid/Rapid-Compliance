'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import type { Company, CompanyStatus } from '@/types/company';
import { CustomFieldInputs, type CustomFieldDef, type CustomFieldRecord } from '@/lib/forms/custom-field-renderer';
import { loadCustomFields } from '@/lib/forms/custom-fields-schema';
import type { CustomFieldValue } from '@/types/crm-entities';

const STATUS_OPTIONS: CompanyStatus[] = ['prospect', 'active', 'inactive', 'churned'];

const INPUT_CLASS =
  'w-full px-4 py-2 bg-surface-elevated text-foreground border border-border-light rounded-lg text-sm';

export default function EditCompanyPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<CustomFieldRecord>({});

  const loadCompany = useCallback(async () => {
    try {
      const res = await authFetch(`/api/crm/companies/${companyId}`);
      const json = (await res.json()) as { success?: boolean; data?: Company };
      if (json.success && json.data) {
        setCompany(json.data);
        setCustomValues({ ...(json.data.customFields ?? {}) });
      }
    } catch (error: unknown) {
      logger.error('Error loading company:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, companyId]);

  useEffect(() => {
    void loadCompany();
    void loadCustomFields('companies', authFetch).then(setCustomFieldDefs).catch(() => setCustomFieldDefs([]));
  }, [loadCompany, authFetch]);

  const handleCustomFieldChange = (key: string, value: CustomFieldValue): void => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!company) {
      return;
    }
    try {
      setSaving(true);
      const res = await authFetch(`/api/crm/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          website: company.website,
          phone: company.phone,
          email: company.email,
          industry: company.industry,
          description: company.description,
          status: company.status,
          customFields: customValues,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to update company');
      }
      router.push(`/companies/${companyId}`);
    } catch (error: unknown) {
      logger.error('Error updating company:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update company. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !company) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Company</h1>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="bg-card rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Company Name</label>
                <input type="text" value={company.name ?? ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <input type="text" value={company.website ?? ''} onChange={(e) => setCompany({ ...company, website: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Industry</label>
                  <input type="text" value={company.industry ?? ''} onChange={(e) => setCompany({ ...company, industry: e.target.value })} className={INPUT_CLASS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input type="tel" value={company.phone ?? ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input type="email" value={company.email ?? ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={INPUT_CLASS} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select value={company.status} onChange={(e) => setCompany({ ...company, status: e.target.value as CompanyStatus })} className={`${INPUT_CLASS} cursor-pointer capitalize`}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea value={company.description ?? ''} onChange={(e) => setCompany({ ...company, description: e.target.value })} className={`${INPUT_CLASS} resize-y`} rows={4} />
              </div>
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
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-border-light">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
