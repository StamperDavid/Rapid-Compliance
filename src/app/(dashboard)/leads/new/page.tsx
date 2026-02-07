'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadFormSchema, type LeadFormValues } from '@/lib/validation/lead-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { logger } from '@/lib/logger/logger';
import DuplicateWarning from '@/components/DuplicateWarning';
import { useToast } from '@/hooks/useToast';
import type { DuplicateDetectionResult } from '@/lib/crm/duplicate-detection';
import type { DataQualityScore } from '@/lib/crm/data-quality';

export default function NewLeadPage() {
  const router = useRouter();
  const toast = useToast();
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityScore | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      source: '',
      status: 'new',
    },
  });

  // Watch fields for duplicate detection & data quality
  const watchedEmail = form.watch('email');
  const watchedPhone = form.watch('phone');
  const watchedFirstName = form.watch('firstName');
  const watchedLastName = form.watch('lastName');
  const watchedCompany = form.watch('company');
  const allValues = form.watch();

  const checkDuplicates = useCallback(async () => {
    setCheckingDuplicates(true);
    try {
      const response = await fetch('/api/crm/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'lead',
          record: { firstName: watchedFirstName, lastName: watchedLastName, email: watchedEmail, phone: watchedPhone, company: watchedCompany },
          workspaceId: 'default',
        }),
      });
      const rawData: unknown = await response.json();
      const data = rawData as { success?: boolean; data?: DuplicateDetectionResult };
      if (data.success && data.data) {
        setDuplicateResult(data.data);
      }
    } catch (error: unknown) {
      logger.error('Error checking duplicates:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setCheckingDuplicates(false);
    }
  }, [watchedEmail, watchedPhone, watchedFirstName, watchedLastName, watchedCompany]);

  const calculateQuality = useCallback(async () => {
    try {
      const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');
      const quality = calculateLeadDataQuality(allValues);
      setDataQuality(quality);
    } catch (error: unknown) {
      logger.error('Error calculating quality:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [allValues]);

  // Check for duplicates when email or phone changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchedEmail || watchedPhone) {
        void checkDuplicates();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchedEmail, watchedPhone, watchedFirstName, watchedLastName, watchedCompany, checkDuplicates]);

  // Calculate data quality in real-time
  useEffect(() => {
    if (allValues.firstName || allValues.email) {
      void calculateQuality();
    }
  }, [allValues, calculateQuality]);

  const proceedWithSubmit = useCallback(async (data: LeadFormValues) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          leadData: { ...data, autoEnrich: true },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create lead');
      }

      router.push('/leads');
    } catch (error: unknown) {
      logger.error('Error creating lead:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create lead');
    }
  }, [router, toast]);

  const onSubmit = async (data: LeadFormValues) => {
    // Warn about high-confidence duplicates
    if (duplicateResult?.hasDuplicates && duplicateResult.highestMatch?.confidence === 'high') {
      setShowConfirmDialog(true);
      return;
    }
    await proceedWithSubmit(data);
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Lead</h1>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md">
              <h2 className="text-xl font-bold mb-4">High-Confidence Duplicate Detected</h2>
              <p className="text-gray-400 mb-6">
                A high-confidence duplicate has been detected. Are you sure you want to create this lead?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    void proceedWithSubmit(form.getValues());
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Quality Score */}
        {dataQuality && (
          <div className="mb-4">
            <div className="flex items-center justify-between bg-gray-900 rounded-lg p-4">
              <div>
                <div className="text-sm text-gray-400">Data Quality Score</div>
                <div className="text-2xl font-bold">
                  {dataQuality.overall}%
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Completeness</div>
                  <div className="font-medium">{dataQuality.completeness}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Accuracy</div>
                  <div className="font-medium">{dataQuality.accuracy}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Consistency</div>
                  <div className="font-medium">{dataQuality.consistency}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateResult?.hasDuplicates && duplicateResult.duplicates.length > 0 && (
          <div className="mb-6">
            <DuplicateWarning
              duplicates={duplicateResult.duplicates}
              entityType="lead"
              onIgnore={() => setDuplicateResult(null)}
            />
          </div>
        )}

        <Form form={form} onSubmit={onSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </FormControl>
                    {dataQuality?.suggestions.find(s => s.field === 'firstName') && (
                      <div className="text-xs text-yellow-400 mt-1">
                        {dataQuality.suggestions.find(s => s.field === 'firstName')?.suggestion}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <input {...field} type="email" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  {checkingDuplicates && <div className="text-xs text-gray-400 mt-1">Checking for duplicates...</div>}
                  {dataQuality?.issues.find(i => i.field === 'email') && (
                    <div className="text-xs text-red-400 mt-1">
                      {dataQuality.issues.find(i => i.field === 'email')?.issue}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <input {...field} type="tel" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  {dataQuality?.suggestions.find(s => s.field === 'phone')?.suggestedValue && (
                    <button
                      type="button"
                      onClick={() => {
                        const suggestion = dataQuality.suggestions.find(s => s.field === 'phone');
                        if (suggestion?.suggestedValue) {
                          form.setValue('phone', String(suggestion.suggestedValue));
                        }
                      }}
                      className="text-xs text-blue-400 mt-1 hover:text-blue-300"
                    >
                      Format as: {dataQuality.suggestions.find(s => s.field === 'phone')?.suggestedValue}
                    </button>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="company" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </FormControl>
                    {field.value && <div className="text-xs text-gray-400 mt-1">Will auto-enrich company data on save</div>}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="source" render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <FormControl>
                    <input {...field} placeholder="e.g., Website, Referral, LinkedIn" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Data Quality Issues */}
          {dataQuality && dataQuality.issues.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-4">
              <div className="font-medium mb-2">Data Quality Issues:</div>
              <div className="space-y-1 text-sm">
                {dataQuality.issues.map((issue, idx) => (
                  <div key={idx}>
                    <span className="font-medium">{issue.field}:</span> {issue.issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting || checkingDuplicates}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Creating...' : checkingDuplicates ? 'Checking duplicates...' : 'Create Lead'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
