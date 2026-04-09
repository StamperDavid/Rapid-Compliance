/**
 * User-Editable Email Template - Canonical TypeScript Interface
 *
 * This is the UNIFIED user-editable template type. Distinct from:
 * - ecommerce.ts EmailTemplate (inline notification config — NOT user-facing)
 * - email-builder.ts EmailTemplate (drag-drop block builder — internal to builder)
 * - email-templates.ts EmailTemplate (sales methodology reference — AI training data)
 * - outbound/email-writer.ts EmailTemplate (cold email framework union type)
 *
 * Those existing types remain untouched. This type is for the user-facing
 * template library: reusable email templates that users create, edit, and
 * use across campaigns, sequences, and one-off sends.
 *
 * @module types/email-template
 */

import type { FirestoreDate } from './crm-entities';

// ============================================================================
// USER EMAIL TEMPLATE TYPES
// ============================================================================

/**
 * Template category for organization
 */
export type EmailTemplateCategory =
  | 'sales'
  | 'marketing'
  | 'transactional'
  | 'nurture'
  | 'onboarding'
  | 'follow_up'
  | 'announcement'
  | 'newsletter'
  | 'custom';

export const EMAIL_TEMPLATE_CATEGORIES: readonly EmailTemplateCategory[] = [
  'sales',
  'marketing',
  'transactional',
  'nurture',
  'onboarding',
  'follow_up',
  'announcement',
  'newsletter',
  'custom',
] as const;

/**
 * Template variable definition
 */
export interface TemplateVariable {
  key: string; // e.g. "firstName"
  label: string; // e.g. "First Name"
  defaultValue?: string;
  description?: string;
}

/**
 * User-editable email template
 * Stored in Firestore, editable via the Templates page
 */
export interface UserEmailTemplate {
  // Core identifiers
  id: string;

  // Template content
  name: string;
  subject: string;
  body: string; // HTML content with {{variable}} placeholders
  preheaderText?: string;

  // Classification
  category: EmailTemplateCategory;
  tags?: string[];

  // Variables
  variables: TemplateVariable[];

  // Styling
  styling?: {
    backgroundColor?: string;
    primaryColor?: string;
    fontFamily?: string;
    headerImageUrl?: string;
  };

  // Metadata
  isDefault?: boolean;
  isActive: boolean;
  usageCount?: number;
  lastUsedAt?: FirestoreDate;

  // Ownership
  createdBy?: string;
  createdByName?: string;

  // Timestamps
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/**
 * Filters for querying templates
 */
export interface EmailTemplateFilters {
  category?: EmailTemplateCategory | 'all';
  isActive?: boolean;
  tags?: string[];
  createdBy?: string;
}

export type CreateEmailTemplateInput = Omit<UserEmailTemplate, 'id' | 'createdAt'>;
export type UpdateEmailTemplateInput = Partial<Omit<UserEmailTemplate, 'id' | 'createdAt'>>;
