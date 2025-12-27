'use client';

/**
 * Workflow Builder
 * Visual workflow creation interface
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    trigger: { type: 'manual', config: {}, requireConfirmation: false },
    conditions: [] as any[],
    actions: [] as any[],
    status: 'draft' as const,
  });
  const [saving, setSaving] = useState(false);

  const addAction = () => {
    setWorkflow(prev => ({
      ...prev,
      actions: [...prev.actions, { id: `action-${Date.now()}`, type: 'delay', duration: 3600, onError: 'stop' }]
    }));
  };

  const updateAction = (index: number, updates: any) => {
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? { ...a, ...updates } : a)
    }));
  };

  const removeAction = (index: number) => {
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!workflow.name) {
      alert('Please enter a workflow name');
      return;
    }

    try {
      setSaving(true);
      
      const workflowId = `workflow-${Date.now()}`;
      const now = Timestamp.now();
      
      await FirestoreService.set(
        `organizations/${orgId}/workspaces/default/workflows`,
        workflowId,
        {
          ...workflow,
          id: workflowId,
          organizationId: orgId,
          workspaceId: 'default',
          trigger: { ...workflow.trigger, id: `trigger-${Date.now()}`, name: 'Main Trigger' },
          settings: { stopOnError: false, parallel: false },
          permissions: { canView: ['owner', 'admin'], canEdit: ['owner', 'admin'], canExecute: ['owner', 'admin', 'member'] },
          stats: { totalRuns: 0, successfulRuns: 0, failedRuns: 0 },
          createdAt: now,
          updatedAt: now,
          createdBy: 'current-user', // TODO: Get from auth
          version: 1,
        },
        false
      );
      
      router.push(`/workspace/${orgId}/workflows`);
    } catch (error) {
      logger.error('Error saving workflow:', error, { file: 'page.tsx' });
      alert('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Workflow</h1>

        {/* Basic Info */}
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Workflow Name</label>
              <input type="text" value={workflow.name} onChange={(e) => setWorkflow({...workflow, name: e.target.value})} placeholder="e.g., Welcome New Leads" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea value={workflow.description} onChange={(e) => setWorkflow({...workflow, description: e.target.value})} placeholder="What does this workflow do?" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={3} />
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Trigger</h2>
          <select value={workflow.trigger.type} onChange={(e) => setWorkflow({...workflow, trigger: {...workflow.trigger, type: e.target.value}})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
            <option value="manual">Manual</option>
            <option value="entity.created">Entity Created</option>
            <option value="entity.updated">Entity Updated</option>
            <option value="schedule">Schedule</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>

        {/* Actions */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Actions</h2>
            <button onClick={addAction} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              + Add Action
            </button>
          </div>
          
          {workflow.actions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No actions yet. Add an action to get started.</p>
          ) : (
            <div className="space-y-3">
              {workflow.actions.map((action, index) => (
                <div key={action.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400">Action {index + 1}</span>
                    <button onClick={() => removeAction(index)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Type</label>
                      <select value={action.type} onChange={(e) => updateAction(index, {type: e.target.value})} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm">
                        <option value="delay">Delay</option>
                        <option value="send_email">Send Email</option>
                        <option value="send_sms">Send SMS</option>
                        <option value="http_request">HTTP Request</option>
                        <option value="create_entity">Create Entity</option>
                        <option value="update_entity">Update Entity</option>
                        <option value="ai_agent">AI Agent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">On Error</label>
                      <select value={action.onError} onChange={(e) => updateAction(index, {onError: e.target.value})} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm">
                        <option value="stop">Stop Workflow</option>
                        <option value="continue">Continue</option>
                      </select>
                    </div>
                  </div>
                  {action.type === 'delay' && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
                      <input type="number" value={action.duration || 3600} onChange={(e) => updateAction(index, {duration: parseInt(e.target.value)})} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Buttons */}
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

