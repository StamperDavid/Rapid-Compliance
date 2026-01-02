/**
 * Email Writer Module - Client-Safe Exports
 * 
 * This file only exports client-safe code (types, templates, validation schemas).
 * For server-side engine functions, import from './server' instead.
 */

// Type-only exports from engine (safe for client)
export type {
  EmailGenerationOptions,
  GeneratedEmail,
  EmailGenerationResult,
} from './email-writer-engine';

// Template exports (safe for client - no server dependencies)
export {
  EMAIL_TEMPLATES,
  getEmailTemplate,
  getAllEmailTypes,
  getRecommendedEmailType,
  type EmailTemplate,
  type EmailType,
} from './email-templates';

// Validation exports (safe for client)
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
