import { z } from 'zod';

export const paymentFormSchema = z.object({
  invoiceId: z.string().optional().default(''),
  dealId: z.string().optional().default(''),
  contactId: z.string().optional().default(''),
  companyId: z.string().optional().default(''),
  companyName: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  currency: z.string().default('USD'),
  method: z.enum(['credit_card', 'bank_transfer', 'wire', 'check', 'cash', 'paypal', 'stripe', 'other']).default('bank_transfer'),
  reference: z.string().optional().default(''),
  paymentDate: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional().default(''),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
