/**
 * Email Writer Module - Server-Only Exports
 * 
 * This file exports server-side email generation functions.
 * DO NOT import this in client components - it contains server-only dependencies.
 * 
 * For client-safe exports (types, templates), import from './index' instead.
 */

// Server-only engine functions
export {
  generateSalesEmail,
  generateEmailVariants,
  type EmailGenerationOptions,
  type GeneratedEmail,
  type EmailGenerationResult,
} from './email-writer-engine';

// Email delivery functions
export {
  sendEmail,
  updateDeliveryStatus,
  incrementOpenCount,
  incrementClickCount,
  getDeliveryRecord,
  getDeliveryRecordsForDeal,
  getDeliveryStatsForUser,
  type EmailDeliveryOptions,
  type EmailDeliveryResult,
  type EmailDeliveryStatus,
  type EmailDeliveryRecord,
} from './email-delivery-service';

// HTML template functions
export {
  generateEmailHTML,
  textToHTML,
  wrapEmailBody,
  stripHTML,
  generateSignatureHTML,
  generateCTAButtonHTML,
  type EmailHTMLOptions,
} from './email-html-templates';

// Re-export client-safe exports for convenience
export {
  EMAIL_TEMPLATES,
  getEmailTemplate,
  getAllEmailTypes,
  getRecommendedEmailType,
  type EmailTemplate,
  type EmailType,
} from './email-templates';

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
