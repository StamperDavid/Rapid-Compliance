'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const workflowId = params.workflowId as string;

  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkflow();
  }, []);

  const loadWorkflow = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/workflows`, workflowId);
      setWorkflow(data);
    } catch (error) {
      logger.error('Error loading workflow:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${orgId}/workspaces/default/workflows`, workflowId, {
        ...workflow,
        updatedAt: Timestamp.now(),
      });
      router.push(`/workspace/${orgId}/workflows`);
    } catch (error) {
      logger.error('Error saving workflow:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      alert('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !workflow) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Workflow</h1>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input type="text" value={workflow.name} onChange={(e) => setWorkflow({...workflow, name: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea value={workflow.description ?? ''} onChange={(e) => setWorkflow({...workflow, description: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select value={workflow.status} onChange={(e) => setWorkflow({...workflow, status: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}




