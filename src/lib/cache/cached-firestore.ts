/**
 * Cached Firestore Service
 * Wrapper around Firestore with automatic caching
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { cacheService, CacheKeys, CacheTTL } from './redis-service';

/**
 * Get document with caching
 */
export async function getCached<T>(
  collection: string,
  docId: string,
  ttl: number = CacheTTL.HOUR
): Promise<T | null> {
  const cacheKey = `firestore:${collection}:${docId}`;
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      const doc = await FirestoreService.get<T>(collection, docId);
      return doc;
    },
    { ttl }
  );
}

/**
 * Get all documents with caching
 */
export async function getAllCached<T>(
  collection: string,
  constraints: any[] = [],
  ttl: number = CacheTTL.MINUTE * 5
): Promise<T[]> {
  // Create cache key from collection and constraints
  const cacheKey = `firestore:${collection}:all:${JSON.stringify(constraints)}`;
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      const docs = await FirestoreService.getAll<T>(collection, constraints);
      return docs;
    },
    { ttl }
  );
}

/**
 * Set document and invalidate cache
 */
export async function setCached<T>(
  collection: string,
  docId: string,
  data: T,
  merge: boolean = false
): Promise<void> {
  // Save to Firestore
  await FirestoreService.set(collection, docId, data, merge);
  
  // Invalidate cache
  const cacheKey = `firestore:${collection}:${docId}`;
  await cacheService.delete(cacheKey);
  
  // Also invalidate list caches for this collection
  await cacheService.deletePattern(`firestore:${collection}:all:*`);
}

/**
 * Delete document and invalidate cache
 */
export async function deleteCached(
  collection: string,
  docId: string
): Promise<void> {
  // Delete from Firestore
  await FirestoreService.delete(collection, docId);
  
  // Invalidate cache
  const cacheKey = `firestore:${collection}:${docId}`;
  await cacheService.delete(cacheKey);
  
  // Also invalidate list caches
  await cacheService.deletePattern(`firestore:${collection}:all:*`);
}

/**
 * Invalidate all caches for a collection
 */
export async function invalidateCollection(collection: string): Promise<void> {
  await cacheService.deletePattern(`firestore:${collection}:*`);
}











