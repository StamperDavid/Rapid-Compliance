'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fineTuningFormSchema, type FineTuningFormValues } from '@/lib/validation/fine-tuning-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function NewFineTuningPage() {
  const router = useRouter();
  const toast = useToast();
  const form = useForm<FineTuningFormValues>({
    resolver: zodResolver(fineTuningFormSchema),
    defaultValues: {
      modelName: '',
      baseModel: 'gpt-3.5-turbo',
      datasetId: '',
    },
  });

  const onSubmit = async (data: FineTuningFormValues) => {
    try {
      const jobId = `finetune-${Date.now()}`;
      await FirestoreService.set(
        getSubCollection('fineTuningJobs'),
        jobId,
        { ...data, id: jobId, status: 'pending', createdAt: Timestamp.now() },
        false
      );
      router.push('/ai/fine-tuning');
    } catch (error: unknown) {
      logger.error('Error creating job:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create fine-tuning job');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Start Fine-Tuning</h1>
        <Form form={form} onSubmit={onSubmit}>
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <FormField control={form.control} name="modelName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Name *</FormLabel>
                  <FormControl>
                    <input {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="baseModel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Model</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]">
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="datasetId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dataset</FormLabel>
                  <FormControl>
                    <input {...field} placeholder="Dataset ID" className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]">Cancel</button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Starting...' : 'Start Fine-Tuning'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
