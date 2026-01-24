/**
 * Firestore Utility Functions
 *
 * Provides strictly-typed helpers for working with Firebase Firestore,
 * particularly for timestamp handling in mock data and UI contexts.
 *
 * @module utils/firestore-utils
 * @version 1.0.0
 */

import { Timestamp, type FieldValue, serverTimestamp } from 'firebase/firestore';

/**
 * Creates a properly-typed Timestamp for mock data and UI contexts.
 *
 * Use this helper instead of `new Date() as unknown as Timestamp`
 * to avoid unsafe type casts while satisfying the Timestamp interface.
 *
 * @param date - Optional Date to convert. Defaults to current time.
 * @returns A Firebase Timestamp instance
 *
 * @example
 * // Create timestamp for current time
 * const now = createMockTimestamp();
 *
 * // Create timestamp from specific date
 * const pastDate = createMockTimestamp(new Date('2024-01-01'));
 *
 * // Use in mock data
 * const mockMetrics: PlatformMetrics = {
 *   updatedAt: createMockTimestamp(),
 *   // ...
 * };
 */
export function createMockTimestamp(date?: Date): Timestamp {
  return date ? Timestamp.fromDate(date) : Timestamp.now();
}

/**
 * Type-safe wrapper for serverTimestamp() that returns the correct type
 * for Firestore document fields that expect Timestamp values.
 *
 * This helper addresses the type mismatch where serverTimestamp() returns
 * FieldValue but document types often expect Timestamp. When written to
 * Firestore, the server resolves this to an actual Timestamp.
 *
 * Use for database write operations where the server should set the timestamp.
 *
 * @returns A FieldValue that Firestore resolves to a Timestamp on write
 *
 * @example
 * // In document creation
 * const doc = {
 *   createdAt: createServerTimestamp(),
 *   updatedAt: createServerTimestamp(),
 * };
 */
export function createServerTimestamp(): FieldValue {
  return serverTimestamp();
}

/**
 * Safely converts a Timestamp or Date to a Date object.
 *
 * Handles both Timestamp instances (from Firestore) and Date objects
 * (from mock data or local operations).
 *
 * @param value - A Timestamp or Date instance
 * @returns A Date object
 *
 * @example
 * const date = toDate(document.createdAt);
 * console.log(date.toLocaleDateString());
 */
export function toDate(value: Timestamp | Date): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return value;
}

/**
 * Safely extracts milliseconds from a Timestamp or Date.
 *
 * @param value - A Timestamp or Date instance
 * @returns Milliseconds since epoch
 */
export function toMillis(value: Timestamp | Date): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  return value.getTime();
}

/**
 * Type guard to check if a value is a Firebase Timestamp.
 *
 * @param value - Any value to check
 * @returns True if the value is a Timestamp instance
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * Converts any date-like value to a Timestamp.
 *
 * Handles Date, Timestamp, ISO strings, and milliseconds.
 *
 * @param value - A date-like value
 * @returns A Firebase Timestamp
 */
export function toTimestamp(value: Date | Timestamp | string | number): Timestamp {
  if (value instanceof Timestamp) {
    return value;
  }
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  if (typeof value === 'string') {
    return Timestamp.fromDate(new Date(value));
  }
  if (typeof value === 'number') {
    return Timestamp.fromMillis(value);
  }
  throw new Error(`Cannot convert value to Timestamp: ${String(value)}`);
}
