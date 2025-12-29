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
// TECHNOLOGY & BUSINESS SERVICES (Templates 11-20)
// ============================================================================

/**
 * SaaS Software Mutation Rules
 */
export const saasSoftwareMutations: MutationRule[] = [
  {
    id: 'saas_enterprise',
    name: 'Enterprise SaaS',
    description: 'Target enterprise customers with complex needs',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('enterprise') || target.includes('large') || target.includes('fortune');
    },
    mutations: [
      {
        path: 'research.highValueSignals[enterprise_tier].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'research.highValueSignals[soc2_compliant].scoreBoost',
        operation: 'add',
        value: 10,
        skipIfMissing: true
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Enterprise-grade solutions with dedicated support and compliance'
      }
    ],
    priority: 1
  },
  {
    id: 'saas_high_growth',
    name: 'High-Growth Focus',
    description: 'Target companies showing growth signals',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('growth') || value.includes('scale') || value.includes('expansion');
    },
    mutations: [
      {
        path: 'research.highValueSignals[funding_announcement].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'research.highValueSignals[hiring_engineers].scoreBoost',
        operation: 'add',
        value: 10,
        skipIfMissing: true
      }
    ],
    priority: 2
  }
];

/**
 * Cybersecurity Mutation Rules
 */
export const cybersecurityMutations: MutationRule[] = [
  {
    id: 'cyber_compliance',
    name: 'Compliance-Focused',
    description: 'Emphasize compliance and regulatory requirements',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('compliance') || product.includes('audit') || product.includes('regulation');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Authoritative, security-focused, regulatory expertise'
      },
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Risk Mitigation Framework - quantify vulnerabilities and compliance gaps'
      }
    ],
    priority: 1
  },
  {
    id: 'cyber_enterprise',
    name: 'Enterprise Security',
    description: 'Target enterprise security needs',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('enterprise') || target.includes('corporate') || target.includes('financial');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Enterprise-grade security with 24/7 threat monitoring'
      }
    ],
    priority: 2
  }
];

/**
 * Digital Marketing Mutation Rules
 */
export const digitalMarketingMutations: MutationRule[] = [
  {
    id: 'marketing_roi',
    name: 'ROI-Driven Marketing',
    description: 'Emphasize measurable ROI and performance',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('roi') || value.includes('performance') || value.includes('results');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Performance Marketing Framework - track every dollar to revenue'
      },
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Data-driven, results-oriented, transparent'
      }
    ],
    priority: 1
  }
];

/**
 * Recruitment & HR Mutation Rules
 */
export const recruitmentHrMutations: MutationRule[] = [
  {
    id: 'recruitment_tech',
    name: 'Tech Recruitment',
    description: 'Specialize in technical hiring',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('tech') || product.includes('engineering') || product.includes('software');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Technical talent acquisition - engineers, developers, and tech leaders'
      }
    ],
    priority: 1
  }
];

/**
 * Logistics & Freight Mutation Rules
 */
export const logisticsFreightMutations: MutationRule[] = [
  {
    id: 'logistics_time_sensitive',
    name: 'Time-Sensitive Logistics',
    description: 'Emphasize speed and reliability',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('fast') || value.includes('expedited') || value.includes('time-sensitive');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Urgent, reliable, precision-focused'
      },
      {
        path: 'tacticalExecution.conversionRhythm',
        operation: 'set',
        value: 'Immediate quote turnaround - "Get your rate in 60 seconds"'
      }
    ],
    priority: 1
  }
];

/**
 * FinTech Mutation Rules
 */
export const fintechMutations: MutationRule[] = [
  {
    id: 'fintech_b2b',
    name: 'B2B FinTech',
    description: 'Target business customers',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('business') || target.includes('b2b') || target.includes('enterprise');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Business financial infrastructure - payments, lending, and treasury'
      }
    ],
    priority: 1
  },
  {
    id: 'fintech_consumer',
    name: 'Consumer FinTech',
    description: 'Target individual consumers',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('consumer') || target.includes('individual') || target.includes('personal');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Accessible, empowering, financially educational'
      }
    ],
    priority: 1
  }
];

/**
 * Managed IT / MSP Mutation Rules
 */
export const managedItMspMutations: MutationRule[] = [
  {
    id: 'msp_proactive',
    name: 'Proactive IT Management',
    description: 'Emphasize proactive monitoring',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('proactive') || value.includes('monitoring') || value.includes('prevent');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Prevention Framework - stop problems before they happen'
      }
    ],
    priority: 1
  }
];

/**
 * EdTech Mutation Rules
 */
export const edtechMutations: MutationRule[] = [
  {
    id: 'edtech_k12',
    name: 'K-12 Education',
    description: 'Target schools and districts',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('school') || target.includes('k-12') || target.includes('district');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Empowering educators and students with innovative learning tools'
      }
    ],
    priority: 1
  },
  {
    id: 'edtech_corporate',
    name: 'Corporate Learning',
    description: 'Target corporate training',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('corporate') || target.includes('enterprise') || target.includes('business');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Professional, ROI-focused, skill-building'
      }
    ],
    priority: 1
  }
];

/**
 * Biotech Mutation Rules
 */
export const biotechMutations: MutationRule[] = [
  {
    id: 'biotech_research',
    name: 'Research Focus',
    description: 'Emphasize research and development',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('research') || product.includes('development') || product.includes('discovery');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Scientific, innovative, precision-driven'
      }
    ],
    priority: 1
  }
];

/**
 * Solar Energy Mutation Rules
 */
export const solarEnergyMutations: MutationRule[] = [
  {
    id: 'solar_battery',
    name: 'Battery Storage Emphasis',
    description: 'Highlight energy independence with storage',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('battery') || product.includes('storage') || product.includes('backup');
    },
    mutations: [
      {
        path: 'research.highValueSignals[battery_storage].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Complete energy independence - solar + storage + EV charging'
      }
    ],
    priority: 1
  },
  {
    id: 'solar_commercial',
    name: 'Commercial Solar Focus',
    description: 'Target commercial installations',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('commercial') || target.includes('business') || target.includes('industrial');
    },
    mutations: [
      {
        path: 'research.highValueSignals[commercial_solar].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'ROI Framework - calculate tax benefits, depreciation, and energy savings'
      }
    ],
    priority: 2
  }
];

// ============================================================================
// HOME SERVICES (Templates 21-30)
// ============================================================================

/**
 * HVAC Mutation Rules
 */
export const hvacMutations: MutationRule[] = [
  {
    id: 'hvac_emergency',
    name: 'Emergency Service Focus',
    description: 'Emphasize 24/7 emergency availability',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('emergency') || product.includes('24/7') || product.includes('urgent');
    },
    mutations: [
      {
        path: 'research.highValueSignals[emergency_service].scoreBoost',
        operation: 'add',
        value: 15,
        skipIfMissing: true
      },
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Emergency Dispatch'
      },
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Responsive, reliable, urgency-aware'
      }
    ],
    priority: 1
  },
  {
    id: 'hvac_maintenance',
    name: 'Maintenance Plans',
    description: 'Focus on recurring revenue through maintenance',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('maintenance') || value.includes('plan') || value.includes('membership');
    },
    mutations: [
      {
        path: 'research.highValueSignals[maintenance_plans].scoreBoost',
        operation: 'add',
        value: 12,
        skipIfMissing: true
      },
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Preventive Care Framework - avoid breakdowns with regular service'
      }
    ],
    priority: 2
  }
];

/**
 * Roofing Mutation Rules
 */
export const roofingMutations: MutationRule[] = [
  {
    id: 'roofing_storm',
    name: 'Storm Damage Restoration',
    description: 'Insurance claim and emergency repairs',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('storm') || product.includes('insurance') || product.includes('restoration');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Storm damage restoration - insurance claim experts'
      },
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Emergency Inspection & Insurance Assessment'
      }
    ],
    priority: 1
  }
];

/**
 * Landscaping & Hardscaping Mutation Rules
 */
export const landscapingHardscapingMutations: MutationRule[] = [
  {
    id: 'landscaping_design',
    name: 'Design-Build Focus',
    description: 'Full-service design and installation',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('design') || product.includes('custom') || product.includes('landscape architecture');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Full-service landscape design-build - from concept to completion'
      },
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Design Consultation'
      }
    ],
    priority: 1
  }
];

/**
 * Plumbing Mutation Rules
 */
export const plumbingMutations: MutationRule[] = [
  {
    id: 'plumbing_emergency',
    name: 'Emergency Plumbing',
    description: '24/7 emergency service',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('emergency') || product.includes('24/7') || product.includes('urgent');
    },
    mutations: [
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Emergency Dispatch'
      },
      {
        path: 'tacticalExecution.conversionRhythm',
        operation: 'set',
        value: 'Immediate response for emergencies - "We can be there in 60 minutes"'
      }
    ],
    priority: 1
  }
];

/**
 * Pest Control Mutation Rules
 */
export const pestControlMutations: MutationRule[] = [
  {
    id: 'pest_termite',
    name: 'Termite Specialist',
    description: 'Focus on termite inspections and treatment',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('termite') || product.includes('wood-destroying');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Termite protection specialists - inspection, treatment, and prevention'
      }
    ],
    priority: 1
  }
];

/**
 * House Cleaning Mutation Rules
 */
export const houseCleaningMutations: MutationRule[] = [
  {
    id: 'cleaning_recurring',
    name: 'Recurring Service Model',
    description: 'Weekly/bi-weekly subscription focus',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('recurring') || value.includes('subscription') || value.includes('regular');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Subscription Framework - consistent service, consistent revenue'
      },
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Recurring Service Enrollment'
      }
    ],
    priority: 1
  }
];

/**
 * Pool Maintenance Mutation Rules
 */
export const poolMaintenanceMutations: MutationRule[] = [
  {
    id: 'pool_service_plans',
    name: 'Weekly Service Plans',
    description: 'Recurring pool maintenance',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('weekly') || product.includes('maintenance') || product.includes('service plan');
    },
    mutations: [
      {
        path: 'tacticalExecution.primaryAction',
        operation: 'set',
        value: 'Service Plan Enrollment'
      }
    ],
    priority: 1
  }
];

/**
 * Electrical Services Mutation Rules
 */
export const electricalServicesMutations: MutationRule[] = [
  {
    id: 'electrical_solar',
    name: 'Solar Installation',
    description: 'Electrical + solar integration',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('solar') || product.includes('renewable');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Complete electrical solutions - traditional + solar + EV charging'
      }
    ],
    priority: 1
  }
];

/**
 * Home Security Mutation Rules
 */
export const homeSecurityMutations: MutationRule[] = [
  {
    id: 'security_smart_home',
    name: 'Smart Home Integration',
    description: 'Smart home automation focus',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('smart home') || product.includes('automation') || product.includes('integration');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Complete smart home security - cameras, locks, automation, monitoring'
      }
    ],
    priority: 1
  }
];

// ============================================================================
// LEGAL & PROFESSIONAL SERVICES (Templates 30-36)
// ============================================================================

/**
 * Personal Injury Law Mutation Rules
 */
export const lawPersonalInjuryMutations: MutationRule[] = [
  {
    id: 'pi_no_fee',
    name: 'No Fee Unless We Win',
    description: 'Contingency fee emphasis',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('no fee') || value.includes('contingency') || value.includes('free consultation');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Aggressive, compassionate, fighter mentality'
      },
      {
        path: 'tacticalExecution.conversionRhythm',
        operation: 'set',
        value: 'Every conversation leads to "Free Case Evaluation - No Fee Unless We Win"'
      }
    ],
    priority: 1
  }
];

/**
 * Family Law Mutation Rules
 */
export const familyLawMutations: MutationRule[] = [
  {
    id: 'family_collaborative',
    name: 'Collaborative Divorce',
    description: 'Non-adversarial approach',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('collaborative') || product.includes('mediation') || product.includes('amicable');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Compassionate, diplomatic, solution-focused'
      }
    ],
    priority: 1
  }
];

/**
 * Accounting & Tax Mutation Rules
 */
export const accountingTaxMutations: MutationRule[] = [
  {
    id: 'accounting_cpa',
    name: 'CPA Firm',
    description: 'Certified public accountant services',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('cpa') || value.includes('certified') || value.includes('audit');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Professional, detail-oriented, compliance-focused'
      }
    ],
    priority: 1
  }
];

/**
 * Financial Planning Mutation Rules
 */
export const financialPlanningMutations: MutationRule[] = [
  {
    id: 'financial_retirement',
    name: 'Retirement Planning',
    description: 'Focus on retirement strategies',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('retirement') || product.includes('401k') || product.includes('pension');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Retirement Readiness Framework - calculate gap between current path and retirement goals'
      }
    ],
    priority: 1
  }
];

/**
 * Insurance Agency Mutation Rules
 */
export const insuranceAgencyMutations: MutationRule[] = [
  {
    id: 'insurance_commercial',
    name: 'Commercial Insurance',
    description: 'Business insurance focus',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('business') || target.includes('commercial') || target.includes('company');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Business insurance specialists - protect your company and employees'
      }
    ],
    priority: 1
  }
];

/**
 * Business Coaching Mutation Rules
 */
export const businessCoachingMutations: MutationRule[] = [
  {
    id: 'coaching_scale',
    name: 'Scaling Focus',
    description: 'Help businesses scale',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('scale') || value.includes('growth') || value.includes('expansion');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Scaling Framework - identify bottlenecks and growth levers'
      }
    ],
    priority: 1
  }
];

// ============================================================================
// HOSPITALITY & SERVICES (Templates 37-39)
// ============================================================================

/**
 * Travel Concierge Mutation Rules
 */
export const travelConciergeMutations: MutationRule[] = [
  {
    id: 'travel_luxury',
    name: 'Luxury Travel',
    description: 'High-end travel experiences',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('luxury') || target.includes('high-net-worth') || target.includes('executive');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Sophisticated, exclusive, white-glove service'
      }
    ],
    priority: 1
  }
];

/**
 * Event Planning Mutation Rules
 */
export const eventPlanningMutations: MutationRule[] = [
  {
    id: 'event_corporate',
    name: 'Corporate Events',
    description: 'Business event focus',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('corporate') || target.includes('business') || target.includes('conference');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Corporate event excellence - conferences, retreats, and celebrations'
      }
    ],
    priority: 1
  }
];

/**
 * Nonprofit Fundraising Mutation Rules
 */
export const nonprofitFundraisingMutations: MutationRule[] = [
  {
    id: 'nonprofit_campaign',
    name: 'Campaign Management',
    description: 'Capital campaign focus',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('campaign') || product.includes('capital') || product.includes('major gifts');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Donor Journey Framework - cultivation, solicitation, stewardship'
      }
    ],
    priority: 1
  }
];

/**
 * Mexican Restaurant Mutation Rules
 */
export const mexicanRestaurantMutations: MutationRule[] = [
  {
    id: 'restaurant_catering',
    name: 'Catering Services',
    description: 'Catering and events',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('catering') || product.includes('event') || product.includes('party');
    },
    mutations: [
      {
        path: 'tacticalExecution.secondaryActions',
        operation: 'prepend',
        value: 'Catering quote request'
      }
    ],
    priority: 1
  }
];

// ============================================================================
// REAL ESTATE (Templates 40-49)
// ============================================================================

/**
 * Residential Real Estate Mutation Rules
 */
export const residentialRealEstateMutations: MutationRule[] = [
  {
    id: 'realestate_luxury',
    name: 'Luxury Homes',
    description: 'High-end residential properties',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('luxury') || target.includes('high-end') || target.includes('premium');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Sophisticated, exclusive, market expertise'
      },
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Luxury real estate specialist - exceptional properties and service'
      }
    ],
    priority: 1
  },
  {
    id: 'realestate_firsttime',
    name: 'First-Time Buyers',
    description: 'Focus on first-time homebuyers',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('first-time') || target.includes('first time') || target.includes('new buyer');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Educational, patient, supportive, guiding'
      }
    ],
    priority: 2
  }
];

/**
 * Commercial Real Estate Mutation Rules
 */
export const commercialRealEstateMutations: MutationRule[] = [
  {
    id: 'commercial_investment',
    name: 'Investment Properties',
    description: 'Investment and development focus',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('investment') || product.includes('development') || product.includes('portfolio');
    },
    mutations: [
      {
        path: 'cognitiveLogic.framework',
        operation: 'set',
        value: 'Investment Analysis Framework - cap rates, NOI, and cash-on-cash returns'
      }
    ],
    priority: 1
  }
];

/**
 * Property Management Mutation Rules
 */
export const propertyManagementMutations: MutationRule[] = [
  {
    id: 'property_hoa',
    name: 'HOA Management',
    description: 'Homeowner association focus',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('hoa') || product.includes('association') || product.includes('condo');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Professional HOA and community association management'
      }
    ],
    priority: 1
  }
];

/**
 * Short-Term Rentals Mutation Rules
 */
export const shortTermRentalsMutations: MutationRule[] = [
  {
    id: 'str_fullservice',
    name: 'Full-Service Management',
    description: 'Complete Airbnb/VRBO management',
    condition: (onboarding: OnboardingData) => {
      const value = onboarding.uniqueValue?.toLowerCase() || '';
      return value.includes('full-service') || value.includes('turnkey') || value.includes('complete');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Full-service vacation rental management - we handle everything'
      }
    ],
    priority: 1
  }
];

/**
 * Mortgage Lending Mutation Rules
 */
export const mortgageLendingMutations: MutationRule[] = [
  {
    id: 'mortgage_firsttime',
    name: 'First-Time Homebuyers',
    description: 'FHA and first-time buyer programs',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('first-time') || target.includes('first time') || target.includes('new buyer');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Educational, patient, program expertise'
      }
    ],
    priority: 1
  }
];

/**
 * Home Staging Mutation Rules
 */
export const homeStagingMutations: MutationRule[] = [
  {
    id: 'staging_luxury',
    name: 'Luxury Home Staging',
    description: 'High-end property staging',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('luxury') || target.includes('high-end') || target.includes('premium');
    },
    mutations: [
      {
        path: 'coreIdentity.tone',
        operation: 'set',
        value: 'Sophisticated, design-forward, market-savvy'
      }
    ],
    priority: 1
  }
];

/**
 * Interior Design Mutation Rules
 */
export const interiorDesignMutations: MutationRule[] = [
  {
    id: 'design_residential',
    name: 'Residential Design',
    description: 'Home interior design',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('residential') || target.includes('home') || target.includes('homeowner');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Residential interior design - creating beautiful, functional living spaces'
      }
    ],
    priority: 1
  },
  {
    id: 'design_commercial',
    name: 'Commercial Design',
    description: 'Office and commercial spaces',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('commercial') || target.includes('office') || target.includes('business');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Commercial interior design - productive, branded environments'
      }
    ],
    priority: 1
  }
];

/**
 * Architecture Mutation Rules
 */
export const architectureMutations: MutationRule[] = [
  {
    id: 'architecture_custom',
    name: 'Custom Homes',
    description: 'Custom residential architecture',
    condition: (onboarding: OnboardingData) => {
      const product = onboarding.topProducts?.toLowerCase() || '';
      return product.includes('custom') || product.includes('residential') || product.includes('home');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Custom residential architecture - bringing your dream home to life'
      }
    ],
    priority: 1
  }
];

/**
 * Construction Development Mutation Rules
 */
export const constructionDevelopmentMutations: MutationRule[] = [
  {
    id: 'construction_commercial',
    name: 'Commercial Construction',
    description: 'Commercial building projects',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('commercial') || target.includes('industrial') || target.includes('business');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Commercial construction and development - on time, on budget'
      }
    ],
    priority: 1
  }
];

/**
 * Title & Escrow Mutation Rules
 */
export const titleEscrowMutations: MutationRule[] = [
  {
    id: 'title_commercial',
    name: 'Commercial Transactions',
    description: 'Commercial title and escrow',
    condition: (onboarding: OnboardingData) => {
      const target = onboarding.targetCustomer?.toLowerCase() || '';
      return target.includes('commercial') || target.includes('business') || target.includes('investment');
    },
    mutations: [
      {
        path: 'coreIdentity.positioning',
        operation: 'set',
        value: 'Commercial title and escrow - complex transactions, expert guidance'
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
  'veterinary-practices': veterinaryMutations,
  'saas-software': saasSoftwareMutations,
  'cybersecurity': cybersecurityMutations,
  'digital-marketing': digitalMarketingMutations,
  'recruitment-hr': recruitmentHrMutations,
  'logistics-freight': logisticsFreightMutations,
  'fintech': fintechMutations,
  'managed-it-msp': managedItMspMutations,
  'edtech': edtechMutations,
  'biotech': biotechMutations,
  'solar-energy': solarEnergyMutations,
  'hvac': hvacMutations,
  'roofing': roofingMutations,
  'landscaping-hardscaping': landscapingHardscapingMutations,
  'plumbing': plumbingMutations,
  'pest-control': pestControlMutations,
  'house-cleaning': houseCleaningMutations,
  'pool-maintenance': poolMaintenanceMutations,
  'electrical-services': electricalServicesMutations,
  'home-security': homeSecurityMutations,
  'law-personal-injury': lawPersonalInjuryMutations,
  'family-law': familyLawMutations,
  'accounting-tax': accountingTaxMutations,
  'financial-planning': financialPlanningMutations,
  'insurance-agency': insuranceAgencyMutations,
  'business-coaching': businessCoachingMutations,
  'travel-concierge': travelConciergeMutations,
  'event-planning': eventPlanningMutations,
  'nonprofit-fundraising': nonprofitFundraisingMutations,
  'mexican-restaurant': mexicanRestaurantMutations,
  'residential-real-estate': residentialRealEstateMutations,
  'commercial-real-estate': commercialRealEstateMutations,
  'property-management': propertyManagementMutations,
  'short-term-rentals': shortTermRentalsMutations,
  'mortgage-lending': mortgageLendingMutations,
  'home-staging': homeStagingMutations,
  'interior-design': interiorDesignMutations,
  'architecture': architectureMutations,
  'construction-development': constructionDevelopmentMutations,
  'title-escrow': titleEscrowMutations
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
