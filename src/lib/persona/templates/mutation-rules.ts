/**
 * Template Mutation Rules
 * 
 * Defines industry-specific mutation rules that customize templates based on onboarding data.
 * 
 * Rules are organized by template ID and define how to adjust:
 * - Signal weights (mathematical adjustments)
 * - Persona tone (communication style)
 * - Cognitive frameworks (sales methodology)
 * - Conversion rhythms (closing aggressiveness)
 * 
 * Each template can have 0-N mutation rules that are conditionally applied.
 */

import type { MutationRule } from './types';
import type { OnboardingData } from '@/types/agent-memory';

// ============================================================================
// HEALTHCARE TEMPLATES (Templates 1-6)
// ============================================================================

/**
 * Dental Practices Mutation Rules
 */
export const dentalPracticesMutations: MutationRule[] = [
  {
    id: 'dental_enterprise',
    name: 'Multi-Location Dental Group',
    description: 'Boost hiring and new location signals for dental groups',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('multi-location') || target.includes('dental group') || target.includes('enterprise');
    },
    mutations: [
      {
        path: 'research.highValueSignals[hiring_hygienists].scoreBoost',
        operation: 'add',
        value: 10,
        skipIfMissing: true
      },
      {
        path: 'research.highValueSignals[new_location].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      }
    ],
    priority: 1
  },
  {
    id: 'dental_cosmetic_focus',
    name: 'Cosmetic Dentistry Focus',
    description: 'Emphasize cosmetic signals for high-end practices',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('cosmetic') || product.includes('veneers') || product.includes('whitening');
    },
    mutations: [
      {
        path: 'research.highValueSignals[cosmetic_dentistry].scoreBoost',
        operation: 'add',
        value: 12,
        skipIfMissing: true
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Premium cosmetic dentistry - beauty and confidence building'
      }
    ],
    priority: 2
  },
  {
    id: 'dental_aggressive_booking',
    name: 'Aggressive Appointment Booking',
    description: 'Direct booking emphasis for high-conversion practices',
    condition: (onboarding: OnboardingData) => {
      return (onboarding.closingStyle || 0) > 7;
    },
    mutations: [
      {
        path: 'tacticalExecution.conversionRhythm',
        operation: 'set',
        value: 'Every interaction ends with "Let me check our calendar - how about Tuesday at 2pm?" or similar direct booking'
      }
    ],
    priority: 3
  }
];

/**
 * Plastic Surgery Mutation Rules
 */
export const plasticSurgeryMutations: MutationRule[] = [
  {
    id: 'plastic_luxury',
    name: 'Luxury Client Focus',
    description: 'Adjust for high-net-worth clientele',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('luxury') || target.includes('high-net-worth') || target.includes('premium');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Discreet, sophisticated, confidence-building'
      },
      {
        path: 'research.highValueSignals[celebrity_clientele].scoreBoost',
        operation: 'add',
        value: 20,
        skipIfMissing: true
      }
    ],
    priority: 1
  }
];

/**
 * Med Spas & Aesthetics Mutation Rules
 */
export const medSpasMutations: MutationRule[] = [
  {
    id: 'medspa_membership',
    name: 'Membership Model',
    description: 'Emphasize subscription/membership signals',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('membership') || product.includes('subscription') || product.includes('package');
    },
    mutations: [
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Membership Enrollment'
      },
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Recurring Revenue Framework - emphasize membership benefits and long-term value'
      }
    ],
    priority: 1
  }
];

/**
 * Mental Health & Therapy Mutation Rules
 */
export const mentalHealthMutations: MutationRule[] = [
  {
    id: 'therapy_telehealth',
    name: 'Telehealth Focus',
    description: 'Emphasize virtual therapy capabilities',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('telehealth') || product.includes('virtual') || product.includes('online');
    },
    mutations: [
      {
        path: 'research.highValueSignals[telehealth].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Accessible mental health care - anywhere, anytime'
      }
    ],
    priority: 1
  }
];

/**
 * Gyms & CrossFit Mutation Rules
 */
export const gymsMutations: MutationRule[] = [
  {
    id: 'gym_transformation',
    name: 'Transformation-Focused',
    description: 'Emphasize results and transformations',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('transformation') || value.includes('results') || value.includes('weight loss');
    },
    mutations: [
      {
        path: 'tacticalExecution.conversionRhythm',
        operation: 'set',
        value: 'Lead with transformation stories, then offer free consultation to assess goals'
      },
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Results-Driven Framework - focus on before/after, measurable outcomes'
      }
    ],
    priority: 1
  }
];

/**
 * Yoga & Pilates Mutation Rules
 */
export const yogaMutations: MutationRule[] = [
  {
    id: 'yoga_wellness',
    name: 'Holistic Wellness Focus',
    description: 'Emphasize mind-body-spirit connection',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('wellness') || value.includes('mindfulness') || value.includes('holistic');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Calm, mindful, nurturing, holistic'
      }
    ],
    priority: 1
  }
];

// ============================================================================
// HEALTHCARE TEMPLATES (Templates 7-10)
// ============================================================================

/**
 * Chiropractic Mutation Rules
 */
export const chiropracticMutations: MutationRule[] = [
  {
    id: 'chiro_sports',
    name: 'Sports Medicine Focus',
    description: 'Target athletes and sports injuries',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('sports') || product.includes('athlete') || product.includes('injury');
    },
    mutations: [
      {
        path: 'research.highValueSignals[sports_chiropractic].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Performance optimization and injury prevention for athletes'
      }
    ],
    priority: 1
  }
];

/**
 * Personal Training Mutation Rules
 */
export const personalTrainingMutations: MutationRule[] = [
  {
    id: 'training_online',
    name: 'Online Training',
    description: 'Virtual/hybrid training model',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('online') || product.includes('virtual') || product.includes('remote');
    },
    mutations: [
      {
        path: 'tacticalExecution.secondaryActions',
        operation: 'prepend',
        value: 'Virtual consultation booking'
      }
    ],
    priority: 1
  }
];

/**
 * Nutritional Coaching Mutation Rules
 */
export const nutritionalCoachingMutations: MutationRule[] = [
  {
    id: 'nutrition_weight_loss',
    name: 'Weight Loss Focus',
    description: 'Emphasize weight management programs',
    condition: (onboarding: OnboardingData) => {
      const problem = onboarding.problemSolved?.toLowerCase() || '';
      return problem.includes('weight loss') || problem.includes('obesity') || problem.includes('fat loss');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Sustainable Weight Loss Framework - habit-based, long-term approach'
      }
    ],
    priority: 1
  }
];

/**
 * Veterinary Practices Mutation Rules
 */
export const veterinaryMutations: MutationRule[] = [
  {
    id: 'vet_emergency',
    name: 'Emergency Services',
    description: 'Highlight 24/7 emergency care',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('emergency') || product.includes('24/7') || product.includes('urgent');
    },
    mutations: [
      {
        path: 'research.highValueSignals[emergency_services].scoreBoost',
        operation: 'add',
        value: 18,
        skipIfMissing: true
      },
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Emergency Triage & Appointment'
      }
    ],
    priority: 1
  }
];

// ============================================================================
// EXPORT ALL MUTATION RULES BY TEMPLATE ID
// ============================================================================

export const TEMPLATE_MUTATION_RULES: Record<string, MutationRule[]> = {
  'dental-practices': dentalPracticesMutations,
  'plastic-surgery': plasticSurgeryMutations,
  'med-spas-aesthetics': medSpasMutations,
  'mental-health-therapy': mentalHealthMutations,
  'gyms-crossfit': gymsMutations,
  'yoga-pilates': yogaMutations,
  'chiropractic': chiropracticMutations,
  'personal-training': personalTrainingMutations,
  'nutritional-coaching': nutritionalCoachingMutations,
  'veterinary-practices': veterinaryMutations
};

/**
 * Get mutation rules for a template
 */
export function getMutationRules(templateId: string): MutationRule[] {
  return TEMPLATE_MUTATION_RULES[templateId] || [];
}

/**
 * Check if template has mutation rules
 */
export function hasMutationRules(templateId: string): boolean {
  return templateId in TEMPLATE_MUTATION_RULES;
}
