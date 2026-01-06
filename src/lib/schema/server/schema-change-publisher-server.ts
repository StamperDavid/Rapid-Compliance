/**
 * Schema Change Event Publisher - SERVER SIDE (Admin SDK)
 * Publishes schema change events from API routes only
 */

import { db, admin } from '@/lib/firebase-admin';
import { getOrgSubCollection } from '@/lib/firebase/collections';
import type { SchemaChangeEvent } from '../schema-change-tracker';

export class SchemaChangeEventPublisherServer {
  /**
   * Publish schema change event (SERVER SIDE with admin SDK)
   */
  static async publishEvent(event: SchemaChangeEvent): Promise<void> {
    const schemaChangeEventsPath = getOrgSubCollection(event.organizationId, 'schemaChangeEvents');
    await db
      .collection(schemaChangeEventsPath)
      .doc(event.id)
      .set({
        ...event,
        timestamp: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now(),
      });
  }
  
  /**
   * Publish multiple events
   */
  static async publishEvents(events: SchemaChangeEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEvent(event);
    }
  }
  
  /**
   * Mark event as processed
   */
  static async markEventProcessed(
    organizationId: string,
    eventId: string
  ): Promise<void> {
    const schemaChangeEventsPath = getOrgSubCollection(organizationId, 'schemaChangeEvents');
    await db
      .collection(schemaChangeEventsPath)
      .doc(eventId)
      .update({
        processed: true,
        processedAt: admin.firestore.Timestamp.now(),
      });
  }
}


