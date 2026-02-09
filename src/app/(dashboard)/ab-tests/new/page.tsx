'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { abTestFormSchema, type ABTestFormValues } from '@/lib/validation/ab-test-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function NewABTestPage() {
  const router = useRouter();
  const toast = useToast();
  const form = useForm<ABTestFormValues>({
    resolver: zodResolver(abTestFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (data: ABTestFormValues) => {
    try {
      const testId = `abtest-${Date.now()}`;
      await FirestoreService.set(
        `organizations/${DEFAULT_ORG_ID}/abTests`,
        testId,
        {
          ...data,
          id: testId,
          status: 'draft',
          variants: [{ name: 'A', config: {} }, { name: 'B', config: {} }],
          createdAt: Timestamp.now(),
        },
        false
      );
      router.push('/ab-tests');
    } catch (error: unknown) {
      logger.error('Error saving test:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save test');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create A/B Test</h1>
        <Form form={form} onSubmit={onSubmit}>
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Name *</FormLabel>
                  <FormControl>
                    <input {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated">Cancel</button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
