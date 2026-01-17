/**
 * Template Resolver Utility
 * 
 * Implements the template resolution logic:
 * 1. Check Firestore for global_templates/{id}
 * 2. If not found, fall back to hardcoded templates from src/lib/persona/templates/
 */

import type { IndustryTemplate } from '@/lib/persona/templates/types';
import { getGlobalTemplate, hasTemplateOverride } from './template-service';
import { logger } from '@/lib/logger/logger';

/**
 * Get industry template with Firestore override support
 * 
 * Logic:
 * - First checks Firestore collection global_templates for document with matching id
 * - If found, returns that data
 * - If not found, uses dynamic import to return hardcoded fallback from src/lib/persona/templates/
 * 
 * @param templateId - The industry template ID (e.g., 'dental-practices')
 * @returns The resolved template or null if not found
 */
export async function getIndustryTemplate(
  templateId: string
): Promise<IndustryTemplate | null> {
  try {
    // Step 1: Check Firestore for override
    const firestoreTemplate = await getGlobalTemplate(templateId);
    
    if (firestoreTemplate) {
      logger.info('Template loaded from Firestore override', { templateId });
      return firestoreTemplate;
    }

    // Step 2: Fall back to hardcoded template
    const codeTemplate = await getHardcodedTemplate(templateId);
    
    if (codeTemplate) {
      logger.debug('Template loaded from hardcoded fallback', { templateId });
      return codeTemplate;
    }

    logger.warn('Template not found in Firestore or code', { templateId });
    return null;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error resolving template', errorObj, { templateId });
    throw new Error(`Failed to resolve template: ${templateId}`);
  }
}

/**
 * Get hardcoded template from code files
 */
async function getHardcodedTemplate(
  templateId: string
): Promise<IndustryTemplate | null> {
  try {
    // Lazy load templates to avoid bundle bloat
    const { getIndustryTemplate: getCodeTemplate } = await import(
      '@/lib/persona/industry-templates'
    );
    
    return await getCodeTemplate(templateId);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error loading hardcoded template', errorObj, { templateId });
    return null;
  }
}

/**
 * Get all industry templates with Firestore overrides applied
 * 
 * @returns Map of all templates with Firestore overrides applied where they exist
 */
export async function getAllIndustryTemplates(): Promise<
  Record<string, IndustryTemplate>
> {
  try {
    // Load all hardcoded templates first
    const { getIndustryOptions } = await import('@/lib/persona/industry-templates');
    const options = await getIndustryOptions();
    
    const templates: Record<string, IndustryTemplate> = {};

    // Resolve each template (Firestore override or code fallback)
    for (const option of options) {
      const template = await getIndustryTemplate(option.value);
      if (template) {
        templates[option.value] = template;
      }
    }

    return templates;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error getting all industry templates', errorObj);
    throw new Error('Failed to get all industry templates');
  }
}

/**
 * Get template with metadata about its source
 */
export async function getTemplateWithSource(templateId: string): Promise<{
  template: IndustryTemplate;
  source: 'firestore' | 'code';
  hasOverride: boolean;
} | null> {
  try {
    const hasOverride = await hasTemplateOverride(templateId);
    
    if (hasOverride) {
      const firestoreTemplate = await getGlobalTemplate(templateId);
      if (firestoreTemplate) {
        return {
          template: firestoreTemplate,
          source: 'firestore',
          hasOverride: true,
        };
      }
    }

    const codeTemplate = await getHardcodedTemplate(templateId);
    if (codeTemplate) {
      return {
        template: codeTemplate,
        source: 'code',
        hasOverride: false,
      };
    }

    return null;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error getting template with source', errorObj, { templateId });
    throw error;
  }
}

/**
 * Get industry options with override status
 */
export async function getIndustryOptionsWithOverrides(): Promise<
  Array<{
    value: string;
    label: string;
    description: string;
    category: string;
    hasOverride: boolean;
  }>
> {
  try {
    const { getIndustryOptions } = await import('@/lib/persona/industry-templates');
    const options = await getIndustryOptions();

    // Check each template for override status
    const optionsWithOverrides = await Promise.all(
      options.map(async option => {
        const hasOverride = await hasTemplateOverride(option.value);
        return {
          ...option,
          hasOverride,
        };
      })
    );

    return optionsWithOverrides;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error getting industry options with overrides', errorObj);
    throw new Error('Failed to get industry options');
  }
}

/**
 * Compare Firestore template with code template
 */
export async function compareTemplateVersions(templateId: string): Promise<{
  firestoreVersion: IndustryTemplate | null;
  codeVersion: IndustryTemplate | null;
  hasChanges: boolean;
} | null> {
  try {
    const firestoreTemplate = await getGlobalTemplate(templateId);
    const codeTemplate = await getHardcodedTemplate(templateId);

    if (!codeTemplate) {
      return null;
    }

    const hasChanges =
      firestoreTemplate !== null &&
      JSON.stringify(firestoreTemplate) !== JSON.stringify(codeTemplate);

    return {
      firestoreVersion: firestoreTemplate,
      codeVersion: codeTemplate,
      hasChanges,
    };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error comparing template versions', errorObj, { templateId });
    throw error;
  }
}
