'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface WorkflowData {
  name: string;
  description?: string;
  status: string;
  [key: string]: unknown;
}

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const authFetch = useAuthFetch();
  const workflowId = params.workflowId as string;

  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWorkflow = useCallback(async () => {
    try {
      const res = await authFetch(`/api/workflows/${workflowId}`);
      const json = (await res.json()) as { success?: boolean; workflow?: WorkflowData };
      if (json.success && json.workflow) {
        setWorkflow(json.workflow);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error loading workflow:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, workflowId]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  const handleSave = async () => {
    if (!workflow) {
      return;
    }

    try {
      setSaving(true);
      const res = await authFetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: {
            name: workflow.name,
            description: workflow.description,
            status: workflow.status,
          },
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error ?? 'Failed to save workflow');
      }
      router.push(`/workflows`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error saving workflow:', error, { file: 'page.tsx' });
      toast.error(error.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !workflow) {return <div className="p-8 text-[var(--color-text-primary)]">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Edit Workflow</h1>

        <div className="bg-surface-paper rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]">Name</label>
              <input type="text" value={workflow.name} onChange={(e) => setWorkflow({...workflow, name: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]">Description</label>
              <textarea value={workflow.description ?? ''} onChange={(e) => setWorkflow({...workflow, description: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]">Status</label>
              <select value={workflow.status} onChange={(e) => setWorkflow({...workflow, status: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]">Cancel</button>
          <button onClick={() => router.push(`/workflows/builder?id=${workflowId}`)} className="px-6 py-3 bg-surface-elevated rounded-lg text-[var(--color-text-primary)] border border-border-light">
            Edit Steps in Builder
          </button>
          <button onClick={() => router.push(`/workflows/${workflowId}/runs`)} className="px-6 py-3 bg-surface-elevated rounded-lg text-[var(--color-text-primary)] border border-border-light">
            View Runs
          </button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}




