export type { IndustryTemplate } from './templates/types';
import type { IndustryTemplate } from './templates/types';
import type { ResearchIntelligence } from '@/types/scraper-intelligence';
import { ResearchIntelligenceSchema } from '@/types/scraper-intelligence';

// Lazy-loaded templates cache to avoid OOM during build
let templatesCache: Record<string, IndustryTemplate> | null = null;

/**
 * Dynamically load all templates (lazy-loaded to avoid webpack OOM)
 */
async function loadTemplates(): Promise<Record<string, IndustryTemplate>> {
  if (templatesCache) {
    return templatesCache;
  }

  // Dynamic imports - loaded only when needed, not during webpack build
  const [
    { realEstateTemplates },
    { healthcareTemplates1 },
    { healthcareTemplates2 },
    { healthcareTemplates3 },
    { homeServicesTemplates1 },
    { homeServicesTemplates2 },
    { homeServicesTemplates3 },
  ] = await Promise.all([
    import('./templates/real-estate'),
    import('./templates/healthcare-1'),
    import('./templates/healthcare-2'),
    import('./templates/healthcare-3'),
    import('./templates/home-services-1'),
    import('./templates/home-services-2'),
    import('./templates/home-services-3'),
  ]);

  templatesCache = {
    ...realEstateTemplates,
    ...healthcareTemplates1,
    ...healthcareTemplates2,
    ...healthcareTemplates3,
    ...homeServicesTemplates1,
    ...homeServicesTemplates2,
    ...homeServicesTemplates3,
  };

  return templatesCache;
}

/**
 * Synchronously get templates (throws if not loaded yet)
 * @deprecated Use async functions instead
 */
export function getTemplatesSync(): Record<string, IndustryTemplate> {
  if (!templatesCache) {
    throw new Error('Templates not loaded. Call loadTemplates() first or use async functions.');
  }
  return templatesCache;
}

// Export for backward compatibility (will be empty until loaded)
export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {};

// Helper functions (async to support lazy loading)
export async function getIndustryOptions(): Promise<Array<{ 
  value: string; 
  label: string; 
  description: string;
  category: string;
}>> {
  const templates = await loadTemplates();
  return Object.entries(templates).map(([id, template]) => ({
    value: id,
    label: template.name,
    description: template.description,
    category: template.category
  }));
}

/**
 * Get template by industry ID
 */
export async function getIndustryTemplate(industryId: string): Promise<IndustryTemplate | null> {
  const templates = await loadTemplates();
  return templates[industryId] || null;
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(category: string): Promise<IndustryTemplate[]> {
  const templates = await loadTemplates();
  return Object.values(templates).filter(t => t.category === category);
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  const templates = await loadTemplates();
  const categories = new Set(Object.values(templates).map(t => t.category));
  return Array.from(categories).sort();
}

/**
 * Check if an industry has a specialized template
 */
export async function hasTemplate(industryId: string): Promise<boolean> {
  const templates = await loadTemplates();
  return industryId in templates;
}

/**
 * Get template count
 */
export async function getTemplateCount(): Promise<{ total: number; byCategory: Record<string, number> }> {
  const templates = await loadTemplates();
  const byCategory: Record<string, number> = {};
  
  Object.values(templates).forEach(template => {
    byCategory[template.category] = (byCategory[template.category] || 0) + 1;
  });
  
  return {
    total: Object.keys(templates).length,
    byCategory
  };
}

// ============================================================================
// RESEARCH INTELLIGENCE HELPERS
// ============================================================================

/**
 * Check if a template has research intelligence configured
 */
export function hasResearchIntelligence(template: IndustryTemplate): boolean {
  return template.research !== undefined && template.research !== null;
}

/**
 * Get research intelligence from template, or return null
 */
export function getResearchIntelligence(
  template: IndustryTemplate
): ResearchIntelligence | null {
  return template.research ?? null;
}

/**
 * Get industry template by ID
 */
export async function getTemplateById(templateId: string): Promise<IndustryTemplate | null> {
  const templates = await loadTemplates();
  return templates[templateId] ?? null;
}

/**
 * Get research intelligence by industry ID
 */
export async function getResearchIntelligenceById(
  industryId: string
): Promise<ResearchIntelligence | null> {
  const template = await getTemplateById(industryId);
  return template ? getResearchIntelligence(template) : null;
}

/**
 * Get all templates that have research intelligence configured
 */
export async function getTemplatesWithResearch(): Promise<IndustryTemplate[]> {
  const templates = await loadTemplates();
  return Object.values(templates).filter(hasResearchIntelligence);
}

/**
 * Validate research intelligence configuration
 */
export function validateResearchIntelligence(
  research: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    ResearchIntelligenceSchema.parse(research);
    return { valid: true, errors: [] };
  } catch (error: any) {
    if (error.errors) {
      error.errors.forEach((err: any) => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    } else {
      errors.push(error.message || 'Unknown validation error');
    }
    return { valid: false, errors };
  }
}

