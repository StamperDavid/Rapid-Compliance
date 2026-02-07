'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { nurtureFormSchema, type NurtureFormValues } from '@/lib/validation/nurture-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function NewNurtureCampaignPage() {
  const router = useRouter();
  const toast = useToast();

  const form = useForm<NurtureFormValues>({
    resolver: zodResolver(nurtureFormSchema),
    defaultValues: {
      name: '',
      description: '',
      steps: [],
    },
  });

  const { fields, append } = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  const addStep = () => {
    append({ delayDays: 1, subject: '', body: '', type: 'email' });
  };

  const onSubmit = async (data: NurtureFormValues) => {
    try {
      const campaignId = `nurture-${Date.now()}`;
      await FirestoreService.set(
        `organizations/${DEFAULT_ORG_ID}/nurtureSequences`,
        campaignId,
        {
          ...data,
          id: campaignId,
          status: 'draft',
          enrolled: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        false
      );
      router.push('/nurture');
    } catch (error: unknown) {
      logger.error('Error saving campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to save campaign');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Nurture Campaign</h1>
        <Form form={form} onSubmit={onSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name *</FormLabel>
                  <FormControl>
                    <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Nurture Steps</h2>
              <button type="button" onClick={addStep} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ Add Step</button>
            </div>
            <div className="space-y-3">
              {fields.map((item, idx) => (
                <div key={item.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-400 mb-3">Step {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name={`steps.${idx}.delayDays`} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <input {...field} type="number" placeholder="Delay (days)" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm w-full focus:border-blue-500 focus:outline-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`steps.${idx}.subject`} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <input {...field} placeholder="Subject" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm w-full focus:border-blue-500 focus:outline-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name={`steps.${idx}.body`} render={({ field }) => (
                    <FormItem className="mt-3">
                      <FormControl>
                        <textarea {...field} placeholder="Email body..." className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
