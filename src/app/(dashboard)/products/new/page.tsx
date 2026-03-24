'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, type ProductFormValues } from '@/lib/validation/product-form-schema';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createProduct, CATALOG_ITEM_TYPES, CATALOG_TYPE_LABELS, type CatalogItemType } from '@/lib/ecommerce/product-service';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

function isValidCatalogType(value: string): value is CatalogItemType {
  return (CATALOG_ITEM_TYPES as readonly string[]).includes(value);
}

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const typeParam = searchParams.get('type') ?? '';
  const defaultType: CatalogItemType = isValidCatalogType(typeParam) ? typeParam : 'product';

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      type: defaultType,
      description: '',
      price: 0,
      category: '',
      sku: '',
      inStock: true,
      images: [],
      features: [],
    },
  });

  const selectedType = form.watch('type');

  const onSubmit = async (data: ProductFormValues) => {
    try {
      await createProduct({
        name: data.name,
        type: data.type,
        description: data.description,
        price: data.price,
        category: data.category,
        sku: data.sku,
        inStock: data.inStock,
        images: data.images,
      });
      const label = CATALOG_TYPE_LABELS[data.type];
      toast.success(`${label} created successfully`);
      router.push(data.type === 'service' ? '/products/services' : '/products');
    } catch (error: unknown) {
      logger.error('Error creating product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create item');
    }
  };

  const pageTitle = selectedType === 'product'
    ? 'Add New Product'
    : `Add New ${CATALOG_TYPE_LABELS[selectedType]}`;

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">{pageTitle}</h1>
        <Form form={form} onSubmit={onSubmit} className="space-y-6">
          <div className="bg-surface-paper rounded-lg p-6">
            <div className="space-y-4">
              {/* Item Type Selector */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Type *</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATALOG_ITEM_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
                          style={{
                            borderColor: field.value === t ? 'var(--color-primary)' : 'var(--color-border-light)',
                            backgroundColor: field.value === t ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg-elevated)',
                            color: field.value === t ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          }}
                        >
                          {CATALOG_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <input {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedType === 'subscription' ? 'Monthly Price ($) *' : 'Price ($) *'}</FormLabel>
                    <FormControl>
                      <input {...field} type="number" step="0.01" className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <input {...field} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {(selectedType === 'product' || selectedType === 'subscription') && (
                  <FormField control={form.control} name="inStock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Status</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ? 'in_stock' : 'out_of_stock'}
                          onChange={(e) => field.onChange(e.target.value === 'in_stock')}
                          className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                        >
                          <option value="in_stock">In Stock</option>
                          <option value="out_of_stock">Out of Stock</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]">Cancel</button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? 'Creating...' : `Create ${CATALOG_TYPE_LABELS[selectedType]}`}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
