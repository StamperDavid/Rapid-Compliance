'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignFormSchema, type CampaignFormValues } from '@/lib/validation/campaign-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createCampaign } from '@/lib/email/campaign-manager';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

export default function NewCampaignPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: '',
      subject: '',
      body: '',
      scheduledFor: '',
    },
  });

  const onSubmit = async (data: CampaignFormValues) => {
    try {
      await createCampaign({
        ...data,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(),
        organizationId: DEFAULT_ORG_ID,
        createdBy: user?.id ?? 'anonymous',
      });
      router.push('/email/campaigns');
    } catch (error: unknown) {
      logger.error('Error creating campaign:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create campaign');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Email Campaign</h1>
        <Form form={form} onSubmit={onSubmit} className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
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
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Line *</FormLabel>
                  <FormControl>
                    <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Body *</FormLabel>
                  <FormControl>
                    <textarea {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" rows={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scheduledFor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule For (Optional)</FormLabel>
                  <FormControl>
                    <input {...field} type="datetime-local" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
