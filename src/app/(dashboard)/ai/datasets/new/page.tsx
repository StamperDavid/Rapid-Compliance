'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { datasetFormSchema, type DatasetFormValues } from '@/lib/validation/dataset-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function NewDatasetPage() {
  const router = useRouter();
  const toast = useToast();
  const form = useForm<DatasetFormValues>({
    resolver: zodResolver(datasetFormSchema),
    defaultValues: {
      name: '',
      description: '',
      format: 'jsonl',
    },
  });

  const onSubmit = async (data: DatasetFormValues) => {
    try {
      const datasetId = `dataset-${Date.now()}`;
      await FirestoreService.set(
        getSubCollection('trainingDatasets'),
        datasetId,
        {
          ...data,
          id: datasetId,
          exampleCount: 0,
          createdAt: Timestamp.now(),
        },
        false
      );
      toast.success('Dataset created successfully');
      router.push('/ai/datasets');
    } catch (error: unknown) {
      logger.error('Error creating dataset:', error instanceof Error ? error : new Error(String(error)), { file: 'datasets/new/page.tsx' });
      toast.error('Failed to create dataset');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Create Dataset</h1>
        <Form form={form} onSubmit={onSubmit}>
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dataset Name *</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      placeholder="e.g., Sales Conversations Q1 2026"
                      className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Describe what this dataset contains and its intended use..."
                      className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)] resize-vertical"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="format" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Format</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                    >
                      <option value="jsonl">JSONL (JSON Lines)</option>
                      <option value="csv">CSV (Comma-Separated)</option>
                      <option value="text">Plain Text</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Creating...' : 'Create Dataset'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
