'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workflowFormSchema, type WorkflowFormValues } from '@/lib/validation/workflow-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getWorkflowsCollection } from '@/lib/firebase/collections';
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
        getWorkflowsCollection(),
        workflowId,
        {
          ...data,
          id: workflowId,
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
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Create Workflow</h1>

        <Form form={form} onSubmit={onSubmit}>
          {/* Basic Info */}
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Basic Information</h2>
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Name</FormLabel>
                  <FormControl>
                    <input {...field} placeholder="e.g., Welcome New Leads" className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} placeholder="What does this workflow do?" className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Trigger</h2>
            <FormField control={form.control} name="trigger.type" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <select {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]">
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
          <div className="bg-surface-paper rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Actions</h2>
              <button type="button" onClick={addAction} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light text-sm">
                + Add Action
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-center py-8">No actions yet. Add an action to get started.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((item, index) => (
                  <div key={item.id} className="bg-surface-elevated rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">Action {index + 1}</span>
                      <button type="button" onClick={() => remove(index)} className="text-error hover:text-error text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name={`actions.${index}.type`} render={({ field }) => (
                        <FormItem>
                          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Type</label>
                          <FormControl>
                            <select {...field} className="w-full px-3 py-2 bg-surface-paper border border-border-light rounded text-sm focus:border-primary focus:outline-none text-[var(--color-text-primary)]">
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
                          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">On Error</label>
                          <FormControl>
                            <select {...field} className="w-full px-3 py-2 bg-surface-paper border border-border-light rounded text-sm focus:border-primary focus:outline-none text-[var(--color-text-primary)]">
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
                            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Duration (seconds)</label>
                            <FormControl>
                              <input {...field} type="number" className="w-full px-3 py-2 bg-surface-paper border border-border-light rounded text-sm focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
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
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated text-[var(--color-text-primary)] rounded-lg hover:bg-surface-elevated">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Saving...' : 'Create Workflow'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
