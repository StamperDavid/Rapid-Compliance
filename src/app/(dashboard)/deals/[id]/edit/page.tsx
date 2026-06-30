'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { CustomFieldInputs, type CustomFieldDef, type CustomFieldRecord } from '@/lib/forms/custom-field-renderer';
import { loadCustomFields } from '@/lib/forms/custom-fields-schema';
import type { CustomFieldValue } from '@/types/crm-entities';
import { type Pipeline, DEFAULT_PIPELINE_ID } from '@/lib/crm/pipeline-types';

interface Deal {
  id: string;
  name?: string;
  company?: string;
  companyName?: string;
  value?: number;
  probability?: number;
  stage?: string;
  pipelineId?: string;
  ownerId?: string;
  expectedCloseDate?: string;
  notes?: string;
  customFields?: CustomFieldRecord;
}

interface TeamMember {
  uid: string;
  name: string;
  email: string;
}

export default function EditDealPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<CustomFieldRecord>({});
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const loadDeal = useCallback(async () => {
    try {
      const res = await authFetch(`/api/deals/${dealId}`);
      const json = (await res.json()) as { success?: boolean; deal?: Deal };
      if (json.success && json.deal) {
        setDeal(json.deal);
        setCustomValues({ ...(json.deal.customFields ?? {}) });
      }
    } catch (error: unknown) {
      logger.error('Error loading deal:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, dealId]);

  const loadPipelines = useCallback(async () => {
    try {
      const res = await authFetch('/api/crm/pipelines');
      if (!res.ok) { return; }
      const json = (await res.json()) as { success?: boolean; pipelines?: Pipeline[] };
      if (json.success && json.pipelines) { setPipelines(json.pipelines); }
    } catch (error: unknown) {
      logger.error('Error loading pipelines:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [authFetch]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await authFetch('/api/team/members');
      if (!res.ok) { return; }
      const json = (await res.json()) as { success?: boolean; members?: TeamMember[] };
      if (json.success && json.members) { setTeamMembers(json.members); }
    } catch (error: unknown) {
      logger.error('Error loading team members:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [authFetch]);

  useEffect(() => {
    void loadDeal();
    void loadPipelines();
    void loadTeamMembers();
    void loadCustomFields('deals', authFetch).then(setCustomFieldDefs).catch(() => setCustomFieldDefs([]));
  }, [loadDeal, loadPipelines, loadTeamMembers, authFetch]);

  // The pipeline currently chosen for this deal (deals with no pipelineId use the default).
  const currentPipelineId = (deal?.pipelineId ?? '') !== '' ? deal?.pipelineId ?? DEFAULT_PIPELINE_ID : DEFAULT_PIPELINE_ID;
  const selectedPipeline = pipelines.find((p) => p.id === currentPipelineId) ?? null;
  const stageOptions = selectedPipeline
    ? [...selectedPipeline.stages].sort((a, b) => a.order - b.order)
    : [];

  const handleCustomFieldChange = (key: string, value: CustomFieldValue): void => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) {
      return;
    }
    setErrorMessage(null);
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: deal.name,
        company: deal.company,
        value: deal.value,
        probability: deal.probability,
        stage: deal.stage,
        notes: deal.notes,
        customFields: customValues,
      };
      if (deal.pipelineId) { payload.pipelineId = deal.pipelineId; }
      if (deal.ownerId) { payload.ownerId = deal.ownerId; }
      if (deal.expectedCloseDate) { payload.expectedCloseDate = deal.expectedCloseDate; }
      const res = await authFetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to update deal');
      }
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
          <div style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }} className="mb-4 p-4 border rounded-lg">
            {errorMessage}
          </div>
        )}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="bg-[var(--color-bg-paper)] rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Deal Name</label><input type="text" value={deal.name ?? ''} onChange={(e) => setDeal({...deal, name: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Company</label><input type="text" value={(deal.company !== '' && deal.company != null) ? deal.company : (deal.companyName ?? '')} onChange={(e) => setDeal({...deal, company: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Value ($)</label><input type="number" value={deal.value ?? 0} onChange={(e) => setDeal({...deal, value: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Probability (%)</label><input type="number" min="0" max="100" value={deal.probability ?? 50} onChange={(e) => setDeal({...deal, probability: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pipeline</label>
                  <select
                    value={currentPipelineId}
                    onChange={(e) => {
                      const newPipelineId = e.target.value;
                      const newPipeline = pipelines.find((p) => p.id === newPipelineId);
                      const firstStage = newPipeline
                        ? [...newPipeline.stages].sort((a, b) => a.order - b.order)[0]
                        : undefined;
                      // Moving to another pipeline: if the current stage isn't in
                      // the new pipeline, drop the deal onto its first stage.
                      const stageStillValid = newPipeline?.stages.some((s) => s.key === deal.stage) ?? false;
                      setDeal({
                        ...deal,
                        pipelineId: newPipelineId,
                        stage: stageStillValid ? deal.stage : firstStage?.key ?? deal.stage,
                      });
                    }}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg"
                  >
                    {pipelines.length === 0 && <option value={currentPipelineId}>Loading...</option>}
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Stage</label>
                  <select
                    value={(deal.stage !== '' && deal.stage != null) ? deal.stage : (stageOptions[0]?.key ?? 'prospecting')}
                    onChange={(e) => setDeal({...deal, stage: e.target.value})}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg"
                  >
                    {stageOptions.length === 0 && deal.stage != null && (
                      <option value={deal.stage}>{deal.stage}</option>
                    )}
                    {stageOptions.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Owner</label>
                  <select
                    value={deal.ownerId ?? ''}
                    onChange={(e) => setDeal({...deal, ownerId: e.target.value})}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.uid} value={m.uid}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-2">Expected Close Date</label><input type="date" value={deal.expectedCloseDate ?? ''} onChange={(e) => setDeal({...deal, expectedCloseDate: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Notes</label><textarea value={deal.notes ?? ''} onChange={(e) => setDeal({...deal, notes: e.target.value})} className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg" rows={4} /></div>
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




