import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().default(''),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  category: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  inStock: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
