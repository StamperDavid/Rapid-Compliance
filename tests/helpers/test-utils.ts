/**
 * Test Utilities
 * Shared helper functions for tests
 */

/**
 * FirestoreTimestamp type (matches Worker 1's type definition)
 */
export type FirestoreTimestamp = {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
};

/**
 * Create a mock FirestoreTimestamp from a Date
 * 
 * @param date - Date to convert to FirestoreTimestamp mock
 * @returns Mock FirestoreTimestamp object
 */
export function createMockFirestoreTimestamp(date: Date = new Date()): FirestoreTimestamp {
  const milliseconds = date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const nanoseconds = (milliseconds % 1000) * 1000000;
  
  return {
    toDate: () => date,
    toMillis: () => milliseconds,
    seconds,
    nanoseconds,
  };
}

/**
 * Create a mock FirestoreTimestamp from a date string
 * 
 * @param dateString - ISO date string
 * @returns Mock FirestoreTimestamp object
 */
export function createMockFirestoreTimestampFromString(dateString: string): FirestoreTimestamp {
  return createMockFirestoreTimestamp(new Date(dateString));
}

/**
 * Convert Firebase Timestamp to mock FirestoreTimestamp
 * Compatible with both firebase/firestore and firebase-admin/firestore Timestamps
 */
export function convertTimestampToMock(timestamp: { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }): FirestoreTimestamp {
  return {
    toDate: () => timestamp.toDate(),
    toMillis: () => timestamp.toMillis(),
    seconds: timestamp.seconds,
    nanoseconds: timestamp.nanoseconds,
  };
}
