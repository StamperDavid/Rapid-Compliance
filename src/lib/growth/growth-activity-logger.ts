/**
 * Growth Activity Logger
 *
 * Persists activity events to Firestore for the Growth Command Center
 * activity feed. Every significant action (competitor added, keyword ranked,
 * strategy approved, cron completed) writes an event here.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getGrowthActivityLogCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import type { GrowthActivityType, GrowthActivityEvent } from '@/types/growth';

class GrowthActivityLogger {
  /**
   * Log a growth activity event to Firestore.
   */
  async log(
    type: GrowthActivityType,
    message: string,
    actor: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string | null> {
    if (!adminDb) {
      logger.warn('GrowthActivityLogger: adminDb not available');
      return null;
    }

    try {
      const collectionPath = getGrowthActivityLogCollection();
      const docRef = await adminDb.collection(collectionPath).add({
        type,
        message,
        timestamp: FieldValue.serverTimestamp(),
        actor,
        metadata,
      });

      return docRef.id;
    } catch (err) {
      logger.error(
        'GrowthActivityLogger: Failed to log activity',
        err instanceof Error ? err : new Error(String(err)),
        { type, message, actor }
      );
      return null;
    }
  }

  /**
   * Retrieve recent activity events, optionally filtered by type.
   */
  async getRecentActivity(options: {
    type?: GrowthActivityType;
    limit?: number;
  } = {}): Promise<GrowthActivityEvent[]> {
    if (!adminDb) {
      return [];
    }

    try {
      const collectionPath = getGrowthActivityLogCollection();
      let query: FirebaseFirestore.Query = adminDb
        .collection(collectionPath)
        .orderBy('timestamp', 'desc');

      if (options.type) {
        query = query.where('type', '==', options.type);
      }

      query = query.limit(options.limit ?? 50);

      const snap = await query.get();
      return snap.docs.map((doc) => {
        const data = doc.data();
        const ts = data.timestamp as { toDate: () => Date } | undefined;
        return {
          id: doc.id,
          type: data.type as GrowthActivityType,
          message: data.message as string,
          timestamp: ts?.toDate?.().toISOString() ?? new Date().toISOString(),
          actor: data.actor as string,
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
        };
      });
    } catch (err) {
      logger.error(
        'GrowthActivityLogger: Failed to get activity',
        err instanceof Error ? err : new Error(String(err))
      );
      return [];
    }
  }
}

// Singleton
let instance: GrowthActivityLogger | null = null;

export function getGrowthActivityLogger(): GrowthActivityLogger {
  instance ??= new GrowthActivityLogger();
  return instance;
}
