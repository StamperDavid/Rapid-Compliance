'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { abTestFormSchema, type ABTestFormValues } from '@/lib/validation/ab-test-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface VariantInput {
  name: string;
  description: string;
  trafficWeight: number;
}

const TEST_TYPE_OPTIONS = [
  { value: 'page', label: 'Landing Page' },
  { value: 'email', label: 'Email Campaign' },
  { value: 'checkout', label: 'Checkout Flow' },
  { value: 'pricing', label: 'Pricing Display' },
  { value: 'cta', label: 'CTA Button' },
  { value: 'custom', label: 'Custom' },
] as const;

const DEFAULT_METRICS = {
  page: 'page_conversion',
  email: 'email_click_rate',
  checkout: 'checkout_completion',
  pricing: 'purchase',
  cta: 'click_through',
  custom: 'conversion',
} as const;

export default function NewABTestPage() {
  const router = useRouter();
  const toast = useToast();
  const [variants, setVariants] = useState<VariantInput[]>([
    { name: 'Control', description: '', trafficWeight: 50 },
    { name: 'Variant B', description: '', trafficWeight: 50 },
  ]);
  const [variantError, setVariantError] = useState<string | null>(null);

  const form = useForm<ABTestFormValues>({
    resolver: zodResolver(abTestFormSchema),
    defaultValues: {
      name: '',
      description: '',
      testType: 'page',
      targetMetric: 'page_conversion',
      trafficAllocation: 100,
    },
  });

  const addVariant = () => {
    if (variants.length >= 5) { return; }
    const labels = ['C', 'D', 'E'];
    const label = labels[variants.length - 2] ?? `${variants.length + 1}`;
    setVariants([...variants, { name: `Variant ${label}`, description: '', trafficWeight: 0 }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) { return; }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantInput, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
    setVariantError(null);
  };

  const distributeWeightsEvenly = () => {
    const base = Math.floor(100 / variants.length);
    const remainder = 100 - base * variants.length;
    setVariants(variants.map((v, i) => ({
      ...v,
      trafficWeight: base + (i < remainder ? 1 : 0),
    })));
  };

  const onSubmit = async (data: ABTestFormValues) => {
    const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);
    if (totalWeight !== 100) {
      setVariantError(`Traffic weights must sum to 100% (currently ${totalWeight}%)`);
      return;
    }
    const emptyNames = variants.some(v => !v.name.trim());
    if (emptyNames) {
      setVariantError('All variants must have a name');
      return;
    }

    try {
      const testId = `abtest-${Date.now()}`;
      await FirestoreService.set(
        getSubCollection('abTests'),
        testId,
        {
          ...data,
          id: testId,
          status: 'draft',
          variants: variants.map((v, i) => ({
            id: i === 0 ? 'control' : `variant-${String.fromCharCode(97 + i)}`,
            name: v.name,
            description: v.description,
            trafficWeight: v.trafficWeight,
            config: {},
            metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
          })),
          createdAt: Timestamp.now(),
        },
        false
      );
      toast.success('A/B test created');
      router.push('/ab-tests');
    } catch (error: unknown) {
      logger.error('Error saving test:', error instanceof Error ? error : new Error(String(error)), { file: 'ab-tests/new/page.tsx' });
      toast.error('Failed to create test');
    }
  };

  const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Create A/B Test</h1>
        <Form form={form} onSubmit={onSubmit}>
          {/* Basic Info */}
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">Test Details</h2>
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Name *</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      placeholder="e.g., Homepage CTA Color Test"
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
                      rows={2}
                      placeholder="What hypothesis are you testing?"
                      className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="testType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Type</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const testType = e.target.value as keyof typeof DEFAULT_METRICS;
                          form.setValue('targetMetric', DEFAULT_METRICS[testType]);
                        }}
                        className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      >
                        {TEST_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="targetMetric" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Metric *</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        placeholder="e.g., click_through"
                        className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="trafficAllocation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Traffic Allocation ({field.value}%)</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      type="range"
                      min={1}
                      max={100}
                      className="w-full accent-primary"
                    />
                  </FormControl>
                  <p className="text-xs text-[var(--color-text-secondary)]">Percentage of total users who will be included in this test</p>
                </FormItem>
              )} />
            </div>
          </div>

          {/* Variants */}
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Variants</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={distributeWeightsEvenly}
                  className="text-xs px-3 py-1 text-primary border border-primary rounded hover:bg-primary hover:text-white transition-colors"
                >
                  Split Evenly
                </button>
                {variants.length < 5 && (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="text-xs px-3 py-1 bg-primary text-white rounded hover:opacity-90"
                  >
                    + Add Variant
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {variants.map((variant, idx) => (
                <div key={idx} className="border border-border-light rounded-lg p-4 bg-surface-elevated">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Name *</label>
                          <input
                            value={variant.name}
                            onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-surface-paper border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                          />
                        </div>
                        <div className="w-28">
                          <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Weight %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={variant.trafficWeight}
                            onChange={(e) => updateVariant(idx, 'trafficWeight', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 text-sm bg-surface-paper border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Description</label>
                        <input
                          value={variant.description}
                          onChange={(e) => updateVariant(idx, 'description', e.target.value)}
                          placeholder="What makes this variant different?"
                          className="w-full px-3 py-1.5 text-sm bg-surface-paper border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                        />
                      </div>
                    </div>
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="mt-5 p-1.5 text-[var(--color-text-secondary)] hover:text-error rounded"
                        title="Remove variant"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className={`mt-3 text-sm font-medium ${totalWeight === 100 ? 'text-success' : 'text-error'}`}>
              Total weight: {totalWeight}% {totalWeight !== 100 && '(must equal 100%)'}
            </div>
            {variantError && <p className="mt-2 text-sm text-error">{variantError}</p>}
          </div>

          {/* Actions */}
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
              {form.formState.isSubmitting ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
