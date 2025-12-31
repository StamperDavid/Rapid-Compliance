/**
 * Global Template Service
 * Manages CRUD operations for global industry templates in Firestore
 */

import { db } from '@/lib/firebase/firebase-admin';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import { logger } from '@/lib/logger/logger';

export interface GlobalTemplateDocument extends IndustryTemplate {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
}

/**
 * Get a template from Firestore
 */
export async function getGlobalTemplate(
  templateId: string
): Promise<GlobalTemplateDocument | null> {
  try {
    const docRef = db.collection(COLLECTIONS.GLOBAL_TEMPLATES).doc(templateId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      ...data,
      createdAt: data?.createdAt?.toDate?.() || new Date(),
      updatedAt: data?.updatedAt?.toDate?.() || new Date(),
    } as GlobalTemplateDocument;
  } catch (error) {
    logger.error('Error getting global template', { templateId, error });
    throw new Error('Failed to get global template');
  }
}

/**
 * Check if a template override exists in Firestore
 */
export async function hasTemplateOverride(templateId: string): Promise<boolean> {
  try {
    const docRef = db.collection(COLLECTIONS.GLOBAL_TEMPLATES).doc(templateId);
    const doc = await docRef.get();
    return doc.exists;
  } catch (error) {
    logger.error('Error checking template override', { templateId, error });
    return false;
  }
}

/**
 * List all global template overrides
 */
export async function listGlobalTemplates(): Promise<GlobalTemplateDocument[]> {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.GLOBAL_TEMPLATES)
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as GlobalTemplateDocument;
    });
  } catch (error) {
    logger.error('Error listing global templates', { error });
    throw new Error('Failed to list global templates');
  }
}

/**
 * Save a global template to Firestore
 */
export async function saveGlobalTemplate(
  template: IndustryTemplate,
  userId: string
): Promise<void> {
  try {
    const docRef = db.collection(COLLECTIONS.GLOBAL_TEMPLATES).doc(template.id);
    const existingDoc = await docRef.get();

    const now = new Date();
    const version = existingDoc.exists ? (existingDoc.data()?.version || 0) + 1 : 1;

    const templateDoc: Omit<GlobalTemplateDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: FirebaseFirestore.FieldValue | Date;
      updatedAt: FirebaseFirestore.FieldValue;
    } = {
      ...template,
      createdAt: existingDoc.exists
        ? existingDoc.data()?.createdAt
        : now,
      updatedAt: db.FieldValue.serverTimestamp(),
      createdBy: existingDoc.exists
        ? existingDoc.data()?.createdBy || userId
        : userId,
      updatedBy: userId,
      version,
    };

    await docRef.set(templateDoc, { merge: false });

    logger.info('Global template saved', {
      templateId: template.id,
      userId,
      version,
    });
  } catch (error) {
    logger.error('Error saving global template', {
      templateId: template.id,
      userId,
      error,
    });
    throw new Error('Failed to save global template');
  }
}

/**
 * Delete a global template (revert to code default)
 */
export async function deleteGlobalTemplate(templateId: string): Promise<void> {
  try {
    const docRef = db.collection(COLLECTIONS.GLOBAL_TEMPLATES).doc(templateId);
    await docRef.delete();

    logger.info('Global template deleted (reverted to default)', { templateId });
  } catch (error) {
    logger.error('Error deleting global template', { templateId, error });
    throw new Error('Failed to delete global template');
  }
}

/**
 * Bulk import templates to Firestore
 */
export async function bulkImportTemplates(
  templates: IndustryTemplate[],
  userId: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const template of templates) {
    try {
      await saveGlobalTemplate(template, userId);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `Failed to import ${template.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  logger.info('Bulk template import completed', results);
  return results;
}

/**
 * Get template metadata (without full content)
 */
export async function getTemplateMetadata(templateId: string): Promise<{
  id: string;
  name: string;
  category: string;
  hasOverride: boolean;
  version?: number;
  updatedAt?: Date;
  updatedBy?: string;
} | null> {
  try {
    const override = await getGlobalTemplate(templateId);
    
    if (override) {
      return {
        id: override.id,
        name: override.name,
        category: override.category,
        hasOverride: true,
        version: override.version,
        updatedAt: override.updatedAt,
        updatedBy: override.updatedBy,
      };
    }

    return null;
  } catch (error) {
    logger.error('Error getting template metadata', { templateId, error });
    return null;
  }
}
