import { z } from 'zod';
import { CATALOG_ITEM_TYPES } from '@/lib/ecommerce/product-service';

export const catalogItemTypeSchema = z.enum(CATALOG_ITEM_TYPES);

export const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  type: catalogItemTypeSchema.default('product'),
  description: z.string().optional().default(''),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  category: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  inStock: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
