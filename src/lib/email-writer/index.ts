/**
 * Email Writer Module - Exports
 * 
 * AI-powered sales email generation with deal scoring,
 * battlecard integration, and industry templates.
 */

// Main engine exports
export {
  generateSalesEmail,
  generateEmailVariants,
  type EmailGenerationOptions,
  type GeneratedEmail,
  type EmailGenerationResult,
} from './email-writer-engine';

// Template exports
export {
  EMAIL_TEMPLATES,
  getEmailTemplate,
  getAllEmailTypes,
  getRecommendedEmailType,
  type EmailTemplate,
  type EmailType,
} from './email-templates';

// Validation exports
export {
  GenerateEmailSchema,
  GenerateEmailVariantsSchema,
  validateRequestBody,
  validateOrReturnError,
  EmailTypeSchema,
  ToneSchema,
  LengthSchema,
  type GenerateEmailRequest,
  type GenerateEmailVariantsRequest,
} from './validation';
