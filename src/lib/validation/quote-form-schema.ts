import { z } from 'zod';

const lineItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Item name is required'),
  description: z.string().optional().default(''),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Price must be non-negative'),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
  tax: z.coerce.number().min(0).max(100).optional().default(0),
});

export const quoteFormSchema = z.object({
  title: z.string().min(1, 'Quote title is required'),
  dealId: z.string().optional().default(''),
  contactId: z.string().optional().default(''),
  companyId: z.string().optional().default(''),
  companyName: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  contactEmail: z.string().optional().default(''),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  validUntil: z.string().optional().default(''),
  terms: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  currency: z.string().default('USD'),
});

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
