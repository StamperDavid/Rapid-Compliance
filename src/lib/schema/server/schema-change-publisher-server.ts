/**
 * Schema Change Event Publisher - SERVER SIDE (Admin SDK)
 * Publishes schema change events from API routes only
 */

import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { SchemaChangeEvent } from '../schema-change-tracker';

// Initialize admin SDK if needed
if (!admin.apps.length) {
  try {
    const serviceAccount = require('@/../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    // Already initialized or missing service account
  }
}

export class SchemaChangeEventPublisherServer {
  /**
   * Publish schema change event (SERVER SIDE with admin SDK)
   */
  static async publishEvent(event: SchemaChangeEvent): Promise<void> {
    const db = getFirestore();
    
    await db
      .collection('organizations')
      .doc(event.organizationId)
      .collection('schemaChangeEvents')
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
    const db = getFirestore();
    
    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('schemaChangeEvents')
      .doc(eventId)
      .update({
        processed: true,
        processedAt: admin.firestore.Timestamp.now(),
      });
  }
}


