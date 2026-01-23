/**
 * Shared Contact type definitions for contact management
 */

import type { Timestamp } from 'firebase/firestore';

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
  title?: string;
  linkedIn?: string;
  lastActivity?: Timestamp | { toDate: () => Date };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * New contact form data (subset of Contact)
 */
export interface NewContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  linkedIn: string;
}

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
