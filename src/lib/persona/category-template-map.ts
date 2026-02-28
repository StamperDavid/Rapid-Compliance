/**
 * Category → Template Mapping for Onboarding
 *
 * Maps 15 onboarding categories to their niche industry templates.
 * Used by the 2-step drill-down in the onboarding flow:
 *   Step 1: Pick a category (e.g., "Healthcare & Medical")
 *   Step 2: Pick a niche template (e.g., "Dental Practices")
 */

import { getIndustryTemplate } from '@/lib/persona/industry-templates';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

export interface OnboardingCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  templateIds: string[];
  defaultPersona?: {
    tone: string;
    objectives: string[];
  };
}

/**
 * 15 onboarding categories with their niche template ID mappings.
 * Order matches the plan table.
 */
export const ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  {
    id: 'real_estate',
    name: 'Real Estate & Property',
    icon: '🏠',
    description: 'Residential, commercial, property management, rentals, and lending',
    color: '#10B981',
    templateIds: [
      'residential-real-estate',
      'commercial-real-estate',
      'property-management',
      'short-term-rentals',
      'mortgage-lending',
      'title-escrow',
    ],
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Qualify buyers/sellers', 'Schedule viewings', 'Build trust'],
    },
  },
  {
    id: 'design_construction',
    name: 'Design & Construction',
    icon: '📐',
    description: 'Home staging, interior design, architecture, and construction',
    color: '#F97316',
    templateIds: [
      'home-staging',
      'interior-design',
      'architecture',
      'construction-development',
    ],
    defaultPersona: {
      tone: 'creative_professional',
      objectives: ['Showcase portfolio', 'Book consultations', 'Demonstrate expertise'],
    },
  },
  {
    id: 'healthcare_medical',
    name: 'Healthcare & Medical',
    icon: '🏥',
    description: 'Dental, surgery, med spas, therapy, chiropractic, and veterinary',
    color: '#06B6D4',
    templateIds: [
      'dental-practices',
      'plastic-surgery',
      'med-spas-aesthetics',
      'mental-health-therapy',
      'chiropractic',
      'veterinary-practices',
    ],
    defaultPersona: {
      tone: 'empathetic_professional',
      objectives: ['Schedule appointments', 'Answer FAQs', 'Provide care information'],
    },
  },
  {
    id: 'fitness_wellness',
    name: 'Fitness & Wellness',
    icon: '🏋️',
    description: 'Gyms, yoga, personal training, and nutrition coaching',
    color: '#EF4444',
    templateIds: [
      'gyms-crossfit',
      'yoga-pilates',
      'personal-training',
      'nutritional-coaching',
    ],
    defaultPersona: {
      tone: 'motivational_friendly',
      objectives: ['Sign up members', 'Book sessions', 'Motivate prospects'],
    },
  },
  {
    id: 'home_services',
    name: 'Home Services',
    icon: '🔧',
    description: 'Solar, HVAC, roofing, plumbing, pest control, cleaning, and more',
    color: '#84CC16',
    templateIds: [
      'solar-energy',
      'hvac',
      'roofing',
      'landscaping-hardscaping',
      'plumbing',
      'pest-control',
      'house-cleaning',
      'pool-maintenance',
      'electrical-services',
      'home-security',
    ],
    defaultPersona: {
      tone: 'friendly_professional',
      objectives: ['Book appointments', 'Provide quotes', 'Schedule follow-ups'],
    },
  },
  {
    id: 'technology_saas',
    name: 'Technology & SaaS',
    icon: '💻',
    description: 'SaaS, cybersecurity, fintech, biotech, managed IT, and edtech',
    color: '#3B82F6',
    templateIds: [
      'saas-software',
      'cybersecurity',
      'fintech',
      'biotech',
      'managed-it-msp',
      'edtech',
    ],
    defaultPersona: {
      tone: 'professional',
      objectives: ['Qualify leads', 'Book demos', 'Reduce churn'],
    },
  },
  {
    id: 'ecommerce_retail',
    name: 'E-commerce & Retail',
    icon: '🛒',
    description: 'Online stores, D2C brands, and retail businesses',
    color: '#8B5CF6',
    templateIds: ['ecommerce-d2c'],
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Convert visitors to buyers', 'Reduce cart abandonment', 'Increase AOV'],
    },
  },
  {
    id: 'marketing_agencies',
    name: 'Marketing & Agencies',
    icon: '📊',
    description: 'Digital marketing, creative studios, and PR firms',
    color: '#A855F7',
    templateIds: ['digital-marketing'],
    defaultPersona: {
      tone: 'creative_professional',
      objectives: ['Qualify leads', 'Showcase portfolio', 'Book discovery calls'],
    },
  },
  {
    id: 'legal_services',
    name: 'Legal Services',
    icon: '⚖️',
    description: 'Personal injury law and family law practices',
    color: '#6366F1',
    templateIds: ['law-personal-injury', 'family-law'],
    defaultPersona: {
      tone: 'professional',
      objectives: ['Qualify prospects', 'Schedule consultations', 'Build trust'],
    },
  },
  {
    id: 'financial_services',
    name: 'Financial Services',
    icon: '🏦',
    description: 'Accounting, financial planning, and insurance',
    color: '#0EA5E9',
    templateIds: ['accounting-tax', 'financial-planning', 'insurance-agency'],
    defaultPersona: {
      tone: 'trustworthy_professional',
      objectives: ['Qualify leads', 'Schedule consultations', 'Build trust'],
    },
  },
  {
    id: 'business_services',
    name: 'Business Services',
    icon: '💼',
    description: 'Business coaching, recruitment, and logistics',
    color: '#14B8A6',
    templateIds: ['business-coaching', 'recruitment-hr', 'logistics-freight'],
    defaultPersona: {
      tone: 'professional',
      objectives: ['Qualify prospects', 'Schedule consultations', 'Showcase expertise'],
    },
  },
  {
    id: 'hospitality_food',
    name: 'Hospitality & Food',
    icon: '🍽️',
    description: 'Restaurants, travel concierge, and event planning',
    color: '#F59E0B',
    templateIds: ['mexican-restaurant', 'travel-concierge', 'event-planning'],
    defaultPersona: {
      tone: 'warm_professional',
      objectives: ['Book reservations', 'Answer inquiries', 'Upsell experiences'],
    },
  },
  {
    id: 'nonprofit',
    name: 'Nonprofit & Charity',
    icon: '❤️',
    description: 'Charitable organizations, NGOs, and community groups',
    color: '#F43F5E',
    templateIds: ['nonprofit-fundraising'],
    defaultPersona: {
      tone: 'warm_passionate',
      objectives: ['Engage donors', 'Share impact stories', 'Recruit volunteers'],
    },
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: '🚗',
    description: 'Dealerships, auto services, and vehicle sales',
    color: '#64748B',
    templateIds: [],
    defaultPersona: {
      tone: 'professional_friendly',
      objectives: ['Schedule test drives', 'Qualify buyers', 'Book service appointments'],
    },
  },
  {
    id: 'social_media',
    name: 'Social Media & Influencers',
    icon: '📱',
    description: 'Content creators, streamers, and digital personalities',
    color: '#EC4899',
    templateIds: [],
    defaultPersona: {
      tone: 'casual_friendly',
      objectives: ['Build authentic connections', 'Drive engagement', 'Convert followers to customers'],
    },
  },
];

/**
 * Get a category by its ID
 */
export function getCategoryById(id: string): OnboardingCategory | undefined {
  return ONBOARDING_CATEGORIES.find((c) => c.id === id);
}

/**
 * Load the full IndustryTemplate objects for a category's template IDs
 */
export async function getTemplatesForCategory(
  categoryId: string
): Promise<Array<{ id: string; name: string; description: string }>> {
  const category = getCategoryById(categoryId);
  if (!category || category.templateIds.length === 0) {
    return [];
  }

  const results: Array<{ id: string; name: string; description: string }> = [];
  for (const templateId of category.templateIds) {
    const template: IndustryTemplate | null = await getIndustryTemplate(templateId);
    if (template) {
      results.push({
        id: template.id,
        name: template.name,
        description: template.description,
      });
    }
  }
  return results;
}

/**
 * Returns true if a category has 2+ templates (needs drill-down step)
 */
export function categoryHasDrillDown(categoryId: string): boolean {
  const category = getCategoryById(categoryId);
  return (category?.templateIds.length ?? 0) >= 2;
}

/**
 * Returns the single template ID if a category has exactly 1 template, else null
 */
export function categorySingleTemplateId(categoryId: string): string | null {
  const category = getCategoryById(categoryId);
  if (category?.templateIds.length === 1) {
    return category.templateIds[0];
  }
  return null;
}
