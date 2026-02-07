/**
 * Barrel export for all form validation schemas.
 * Each schema is co-located with its Zod-inferred TypeScript type.
 */

export { leadFormSchema, type LeadFormValues } from './lead-form-schema';
export { contactFormSchema, type ContactFormValues } from './contact-form-schema';
export { dealFormSchema, type DealFormValues } from './deal-form-schema';
export { productFormSchema, type ProductFormValues } from './product-form-schema';
export { workflowFormSchema, type WorkflowFormValues, type WorkflowActionValues } from './workflow-form-schema';
export { campaignFormSchema, type CampaignFormValues } from './campaign-form-schema';
export { abTestFormSchema, type ABTestFormValues } from './ab-test-form-schema';
export { nurtureFormSchema, type NurtureFormValues, type NurtureStepValues } from './nurture-form-schema';
export { fineTuningFormSchema, type FineTuningFormValues } from './fine-tuning-form-schema';
