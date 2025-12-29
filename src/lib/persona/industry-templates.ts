export type { IndustryTemplate } from './templates/types';
import type { IndustryTemplate } from './templates/types';
import type { ResearchIntelligence } from '@/types/scraper-intelligence';
import { ResearchIntelligenceSchema } from '@/types/scraper-intelligence';

// Import split template files
// TEMPORARILY COMMENTED OUT TO TEST BUILD
// import { realEstateTemplates } from './templates/real-estate';
// import { healthcareTemplates } from './templates/healthcare';
// import { homeServicesTemplates } from './templates/home-services';

// Merge all templates
export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  // TEMPORARILY EMPTY TO TEST BUILD
  // ...realEstateTemplates,
  // ...healthcareTemplates,
  // ...homeServicesTemplates,
};

// Helper functions
export function getIndustryOptions(): Array<{ 
  value: string; 
  label: string; 
  description: string;
  category: string;
}> {
  return Object.entries(INDUSTRY_TEMPLATES).map(([id, template]) => ({
    value: id,
    label: template.name,
    description: template.description,
    category: template.category
  }));
}

/**
 * Get template by industry ID
 */
export function getIndustryTemplate(industryId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[industryId] || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES).filter(t => t.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  const categories = new Set(Object.values(INDUSTRY_TEMPLATES).map(t => t.category));
  return Array.from(categories).sort();
}

/**
 * Check if an industry has a specialized template
 */
export function hasTemplate(industryId: string): boolean {
  return industryId in INDUSTRY_TEMPLATES;
}

/**
 * Get template count
 */
export function getTemplateCount(): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  
  Object.values(INDUSTRY_TEMPLATES).forEach(template => {
    byCategory[template.category] = (byCategory[template.category] || 0) + 1;
  });
  
  return {
    total: Object.keys(INDUSTRY_TEMPLATES).length,
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
export function getTemplateById(templateId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[templateId] ?? null;
}

/**
 * Get research intelligence by industry ID
 */
export function getResearchIntelligenceById(
  industryId: string
): ResearchIntelligence | null {
  const template = getTemplateById(industryId);
  return template ? getResearchIntelligence(template) : null;
}

/**
 * Get all templates that have research intelligence configured
 */
export function getTemplatesWithResearch(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES).filter(hasResearchIntelligence);
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

