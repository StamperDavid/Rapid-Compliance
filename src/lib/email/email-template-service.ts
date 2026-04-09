/**
 * User Email Template Service
 * CRUD for user-editable email templates stored in Firestore
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type {
  UserEmailTemplate,
  EmailTemplateFilters,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from '@/types/email-template';

interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Get email templates with pagination and filtering
 */
export async function getEmailTemplates(
  filters?: EmailTemplateFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<UserEmailTemplate>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.category && filters.category !== 'all') {
      constraints.push(where('category', '==', filters.category));
    }

    if (filters?.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }

    if (filters?.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<UserEmailTemplate>(
      getSubCollection('emailTemplates'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Email templates retrieved', { count: result.data.length });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get email templates', error instanceof Error ? error : undefined);
    throw new Error(`Failed to retrieve email templates: ${errorMessage}`);
  }
}

/**
 * Get a single email template
 */
export async function getEmailTemplate(templateId: string): Promise<UserEmailTemplate | null> {
  try {
    const template = await FirestoreService.get<UserEmailTemplate>(
      getSubCollection('emailTemplates'),
      templateId
    );

    if (!template) {
      logger.warn('Email template not found', { templateId });
      return null;
    }

    return template;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get email template', error instanceof Error ? error : undefined, { templateId });
    throw new Error(`Failed to retrieve email template: ${errorMessage}`);
  }
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(data: CreateEmailTemplateInput): Promise<UserEmailTemplate> {
  try {
    const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const template: UserEmailTemplate = {
      ...data,
      id: templateId,
      category: data.category ?? 'custom',
      variables: data.variables ?? [],
      isActive: data.isActive ?? true,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('emailTemplates'),
      templateId,
      template,
      false
    );

    logger.info('Email template created', { templateId, name: template.name });
    return template;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create email template', error instanceof Error ? error : undefined);
    throw new Error(`Failed to create email template: ${errorMessage}`);
  }
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
  templateId: string,
  updates: UpdateEmailTemplateInput
): Promise<UserEmailTemplate> {
  try {
    await FirestoreService.update(
      getSubCollection('emailTemplates'),
      templateId,
      { ...updates, updatedAt: new Date() }
    );

    logger.info('Email template updated', { templateId, updatedFields: Object.keys(updates) });

    const template = await getEmailTemplate(templateId);
    if (!template) {
      throw new Error('Email template not found after update');
    }
    return template;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update email template', error instanceof Error ? error : undefined, { templateId });
    throw new Error(`Failed to update email template: ${errorMessage}`);
  }
}

/**
 * Delete an email template
 */
export async function deleteEmailTemplate(templateId: string): Promise<void> {
  try {
    await FirestoreService.delete(getSubCollection('emailTemplates'), templateId);
    logger.info('Email template deleted', { templateId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete email template', error instanceof Error ? error : undefined, { templateId });
    throw new Error(`Failed to delete email template: ${errorMessage}`);
  }
}

/**
 * Render a template body by replacing {{variable}} placeholders with values
 */
export function renderTemplate(
  body: string,
  variables: Record<string, string>
): string {
  let rendered = body;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return rendered;
}
