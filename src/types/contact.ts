/**
 * Shared Contact type definitions for contact management
 */

import type { Timestamp } from 'firebase/firestore';
import type { CustomFields } from './crm-entities';

/**
 * Contact entity from Firestore
 */
export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  company?: string;
  /** FK to the linked Company record. The `company` string above is kept for display/legacy fallback. */
  companyId?: string;
  title?: string;
  linkedIn?: string;
  lastActivity?: Timestamp | { toDate: () => Date };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  customFields?: CustomFields;
}

/**
 * New contact form data — derived from Zod schema (single source of truth)
 */
export type { ContactFormValues as NewContactFormData } from '@/lib/validation/contact-form-schema';

/**
 * Type guard to check if lastActivity is a Firestore Timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as Timestamp).toDate === 'function'
  );
}

/**
 * Helper to safely extract Date from lastActivity
 */
export function getLastActivityDate(contact: Contact): Date | null {
  if (!contact.lastActivity) {
    return null;
  }

  if (isTimestamp(contact.lastActivity)) {
    return contact.lastActivity.toDate();
  }

  if ('toDate' in contact.lastActivity && typeof contact.lastActivity.toDate === 'function') {
    return contact.lastActivity.toDate();
  }

  return null;
}
