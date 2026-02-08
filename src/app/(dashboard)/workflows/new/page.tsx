'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workflowFormSchema, type WorkflowFormValues } from '@/lib/validation/workflow-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger: { type: 'manual', config: {}, requireConfirmation: false },
      actions: [],
      status: 'draft',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'actions',
  });

  const addAction = () => {
    append({ id: `action-${Date.now()}`, type: 'delay', duration: 3600, onError: 'stop' });
  };

  const onSubmit = async (data: WorkflowFormValues) => {
    if (!data.name) {
      toast.error('Please enter a workflow name');
      return;
    }

    try {
      const workflowId = `workflow-${Date.now()}`;
      const now = Timestamp.now();

      await FirestoreService.set(
        `organizations/${PLATFORM_ID}/workspaces/default/workflows`,
        workflowId,
        {
          ...data,
          id: workflowId,
          workspaceId: 'default',
          trigger: { ...data.trigger, id: `trigger-${Date.now()}`, name: 'Main Trigger' },
          settings: { stopOnError: false, parallel: false },
          permissions: { canView: ['owner', 'admin'], canEdit: ['owner', 'admin'], canExecute: ['owner', 'admin', 'member'] },
          stats: { totalRuns: 0, successfulRuns: 0, failedRuns: 0 },
          createdAt: now,
          updatedAt: now,
          createdBy: user?.id ?? 'anonymous',
          version: 1,
        },
        false
      );

      router.push('/workflows');
    } catch (error: unknown) {
      logger.error('Error saving workflow:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save workflow');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Workflow</h1>

        <Form form={form} onSubmit={onSubmit}>
          {/* Basic Info */}
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Name</FormLabel>
                  <FormControl>
                    <input {...field} placeholder="e.g., Welcome New Leads" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} placeholder="What does this workflow do?" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Trigger</h2>
            <FormField control={form.control} name="trigger.type" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <select {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none">
                    <option value="manual">Manual</option>
                    <option value="entity.created">Entity Created</option>
                    <option value="entity.updated">Entity Updated</option>
                    <option value="schedule">Schedule</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Actions */}
          <div className="bg-gray-900 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Actions</h2>
              <button type="button" onClick={addAction} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                + Add Action
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No actions yet. Add an action to get started.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((item, index) => (
                  <div key={item.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-400">Action {index + 1}</span>
                      <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name={`actions.${index}.type`} render={({ field }) => (
                        <FormItem>
                          <label className="block text-xs text-gray-400 mb-1">Type</label>
                          <FormControl>
                            <select {...field} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none">
                              <option value="delay">Delay</option>
                              <option value="send_email">Send Email</option>
                              <option value="send_sms">Send SMS</option>
                              <option value="http_request">HTTP Request</option>
                              <option value="create_entity">Create Entity</option>
                              <option value="update_entity">Update Entity</option>
                              <option value="ai_agent">AI Agent</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`actions.${index}.onError`} render={({ field }) => (
                        <FormItem>
                          <label className="block text-xs text-gray-400 mb-1">On Error</label>
                          <FormControl>
                            <select {...field} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none">
                              <option value="stop">Stop Workflow</option>
                              <option value="continue">Continue</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    {form.watch(`actions.${index}.type`) === 'delay' && (
                      <div className="mt-3">
                        <FormField control={form.control} name={`actions.${index}.duration`} render={({ field }) => (
                          <FormItem>
                            <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
                            <FormControl>
                              <input {...field} type="number" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Buttons */}
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Saving...' : 'Create Workflow'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
