/**
 * Industry Sales Templates
 * 
 * Pre-built sales templates for different industries with:
 * - Industry-specific sales stages
 * - Custom fields and workflows
 * - Best practices and benchmarks
 * - Deal scoring criteria
 * - Revenue forecasting weights
 * 
 * These templates help organizations get started quickly with proven
 * sales processes tailored to their industry.
 * 
 * INTEGRATION:
 * - Used by template-engine.ts for template application
 * - Referenced by deal-scoring-engine.ts for industry-specific scoring
 * - Used by revenue-forecasting-engine.ts for stage weighting
 */

import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesStage {
  id: string;
  name: string;
  description: string;
  probability: number; // 0-100 - likelihood of closing
  averageDuration: number; // Average days in this stage
  requiredActions: string[]; // Actions that should be completed
  exitCriteria: string[]; // What must be true to move to next stage
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select' | 'multiselect' | 'longtext';
  description: string;
  required: boolean;
  options?: string[]; // For select/multiselect
  defaultValue?: unknown;
}

export interface SalesWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: 'stage_change' | 'time_based' | 'field_update' | 'manual';
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
}

export interface WorkflowAction {
  type: 'email' | 'task' | 'notification' | 'field_update' | 'webhook';
  config: Record<string, unknown>;
}

export interface BestPractice {
  id: string;
  category: 'qualification' | 'discovery' | 'presentation' | 'negotiation' | 'closing';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface IndustryBenchmarks {
  avgDealSize: number;
  avgSalesCycle: number; // Days
  avgWinRate: number; // 0-100
  avgDealsPerRep: number; // Per month
  avgConversionRate: number; // 0-100 (lead to deal)
}

export interface SalesIndustryTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  category: 'b2b' | 'b2c' | 'b2b2c' | 'enterprise' | 'smb';
  icon: string;
  
  // Sales process configuration
  stages: SalesStage[];
  fields: CustomField[];
  workflows: SalesWorkflow[];
  bestPractices: BestPractice[];
  
  // Benchmarks for comparison
  benchmarks: IndustryBenchmarks;
  
  // Scoring configuration
  scoringWeights: {
    dealAge: number;
    stageVelocity: number;
    engagement: number;
    decisionMaker: number;
    budget: number;
    competition: number;
    historicalWinRate: number;
  };
  
  // AI configuration
  aiPrompt: string; // Industry-specific AI assistant prompt
  discoveryQuestions: string[]; // Questions to ask prospects
  commonObjections: string[]; // Typical objections in this industry
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// INDUSTRY TEMPLATES
// ============================================================================

/**
 * SaaS (Software as a Service) Template
 * 
 * Optimized for subscription-based software sales with focus on:
 * - Free trial to paid conversion
 * - Annual contract value (ACV)
 * - Customer lifetime value (LTV)
 * - Product-led growth motions
 */
export const SAAS_TEMPLATE: SalesIndustryTemplate = {
  id: 'saas',
  name: 'SaaS Sales Process',
  description: 'Optimized for subscription software sales with trial-to-paid focus',
  industry: 'Software & Technology',
  category: 'b2b',
  icon: '💻',
  
  stages: [
    {
      id: 'trial_started',
      name: 'Trial Started',
      description: 'Prospect has started a free trial',
      probability: 10,
      averageDuration: 14,
      requiredActions: [
        'Send welcome email',
        'Schedule onboarding call',
        'Track product usage'
      ],
      exitCriteria: [
        'Onboarding completed',
        'Key feature used',
        'Demo scheduled'
      ]
    },
    {
      id: 'discovery',
      name: 'Discovery',
      description: 'Understanding customer needs and fit',
      probability: 25,
      averageDuration: 7,
      requiredActions: [
        'Discovery call completed',
        'Identify decision makers',
        'Qualify budget and timeline',
        'Document use cases'
      ],
      exitCriteria: [
        'BANT criteria met',
        'Champion identified',
        'Use case documented'
      ]
    },
    {
      id: 'demo',
      name: 'Demo & Evaluation',
      description: 'Product demonstration and evaluation',
      probability: 40,
      averageDuration: 7,
      requiredActions: [
        'Conduct personalized demo',
        'Share case studies',
        'Address technical questions',
        'Provide trial support'
      ],
      exitCriteria: [
        'Demo completed',
        'Technical objections addressed',
        'Value proposition confirmed'
      ]
    },
    {
      id: 'proposal',
      name: 'Proposal',
      description: 'Proposal sent and under review',
      probability: 60,
      averageDuration: 5,
      requiredActions: [
        'Send customized proposal',
        'Schedule proposal review call',
        'Answer pricing questions',
        'Negotiate terms'
      ],
      exitCriteria: [
        'Proposal reviewed',
        'Pricing agreed',
        'Terms negotiated'
      ]
    },
    {
      id: 'negotiation',
      name: 'Negotiation',
      description: 'Finalizing contract terms',
      probability: 75,
      averageDuration: 5,
      requiredActions: [
        'Negotiate contract',
        'Get legal approval',
        'Finalize pricing',
        'Set implementation timeline'
      ],
      exitCriteria: [
        'Contract approved',
        'Implementation plan agreed',
        'Payment terms confirmed'
      ]
    },
    {
      id: 'closed_won',
      name: 'Closed Won',
      description: 'Deal successfully closed',
      probability: 100,
      averageDuration: 0,
      requiredActions: [
        'Send contract',
        'Schedule kickoff',
        'Handoff to customer success'
      ],
      exitCriteria: []
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      description: 'Deal was lost',
      probability: 0,
      averageDuration: 0,
      requiredActions: [
        'Document loss reason',
        'Request feedback',
        'Add to nurture campaign'
      ],
      exitCriteria: []
    }
  ],
  
  fields: [
    {
      id: 'annual_contract_value',
      name: 'Annual Contract Value (ACV)',
      type: 'currency',
      description: 'Total annual recurring revenue from this deal',
      required: true
    },
    {
      id: 'trial_end_date',
      name: 'Trial End Date',
      type: 'date',
      description: 'When the free trial expires',
      required: false
    },
    {
      id: 'user_seats',
      name: 'Number of Seats',
      type: 'number',
      description: 'How many user licenses',
      required: true
    },
    {
      id: 'plan_tier',
      name: 'Plan Tier',
      type: 'select',
      description: 'Which subscription tier',
      required: true,
      options: ['Starter', 'Professional', 'Business', 'Enterprise']
    },
    {
      id: 'contract_term',
      name: 'Contract Term',
      type: 'select',
      description: 'Length of contract',
      required: true,
      options: ['Monthly', 'Annual', '2-Year', '3-Year']
    },
    {
      id: 'implementation_required',
      name: 'Implementation Required',
      type: 'boolean',
      description: 'Does this deal require custom implementation',
      required: false,
      defaultValue: false
    },
    {
      id: 'competitor',
      name: 'Primary Competitor',
      type: 'text',
      description: 'Main competitor they are evaluating',
      required: false
    },
    {
      id: 'decision_criteria',
      name: 'Decision Criteria',
      type: 'multiselect',
      description: 'What factors matter most in their decision',
      required: false,
      options: ['Price', 'Features', 'Integration', 'Support', 'Security', 'Scalability']
    }
  ],
  
  workflows: [
    {
      id: 'trial_expiring',
      name: 'Trial Expiring Alert',
      description: 'Alert sales rep when trial is expiring soon',
      trigger: 'time_based',
      conditions: [
        { field: 'trial_end_date', operator: 'less_than', value: 3 } // 3 days
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Trial expiring in 3 days - reach out',
            priority: 'high'
          }
        },
        {
          type: 'email',
          config: {
            template: 'trial_expiring_offer',
            to: 'contact'
          }
        }
      ]
    },
    {
      id: 'moved_to_proposal',
      name: 'Proposal Stage Actions',
      description: 'Automated actions when deal moves to proposal',
      trigger: 'stage_change',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'proposal' }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Send customized proposal',
            dueInDays: 1,
            priority: 'high'
          }
        },
        {
          type: 'notification',
          config: {
            message: 'Deal moved to Proposal stage - send proposal ASAP',
            recipients: ['assignedRep']
          }
        }
      ]
    }
  ],
  
  bestPractices: [
    {
      id: 'saas_bp_1',
      category: 'qualification',
      title: 'Qualify early with BANT',
      description: 'Budget, Authority, Need, Timeline - qualify these in discovery to avoid wasting time',
      impact: 'high'
    },
    {
      id: 'saas_bp_2',
      category: 'discovery',
      title: 'Identify the champion',
      description: 'Find an internal advocate who will sell for you when you are not in the room',
      impact: 'high'
    },
    {
      id: 'saas_bp_3',
      category: 'presentation',
      title: 'Demo the outcome, not features',
      description: 'Show how the software solves their specific problem, not a generic feature tour',
      impact: 'high'
    },
    {
      id: 'saas_bp_4',
      category: 'negotiation',
      title: 'Discount cautiously',
      description: 'Discounting sets a bad precedent. Offer value (extra seats, longer contract) instead',
      impact: 'medium'
    },
    {
      id: 'saas_bp_5',
      category: 'closing',
      title: 'Create urgency',
      description: 'Limited-time offers, trial expiring, quarter-end pricing - use urgency ethically',
      impact: 'medium'
    }
  ],
  
  benchmarks: {
    avgDealSize: 15000, // $15K ACV
    avgSalesCycle: 30, // 30 days
    avgWinRate: 25, // 25%
    avgDealsPerRep: 5, // 5 deals/month
    avgConversionRate: 15 // 15% trial to paid
  },
  
  scoringWeights: {
    dealAge: 0.10,
    stageVelocity: 0.20,
    engagement: 0.25,
    decisionMaker: 0.15,
    budget: 0.15,
    competition: 0.10,
    historicalWinRate: 0.05
  },
  
  aiPrompt: `You are a SaaS sales expert. Help sales reps close subscription software deals by:
- Qualifying leads using BANT (Budget, Authority, Need, Timeline)
- Identifying champions and decision makers
- Crafting value-based proposals that focus on ROI
- Handling objections around pricing, security, and integrations
- Creating urgency without being pushy
- Recommending annual contracts over monthly for higher LTV`,
  
  discoveryQuestions: [
    'What problem are you trying to solve?',
    'What is your current solution and why is it not working?',
    'Who else is involved in this decision?',
    'What is your budget and timeline for implementing a solution?',
    'What does success look like in 6 months?',
    'What would prevent you from moving forward?',
    'Are you evaluating other solutions?',
    'How are you currently measuring [problem area]?'
  ],
  
  commonObjections: [
    'Too expensive',
    'Need to check with my boss',
    'Currently using a competitor',
    'Not the right time',
    'Missing a specific feature',
    'Security concerns',
    'Integration complexity',
    'Switching costs too high'
  ]
};

/**
 * E-Commerce Template
 * 
 * Optimized for product-based sales with focus on:
 * - Quick transactional sales
 * - Bulk orders and wholesale
 * - Seasonal purchasing patterns
 * - Customer lifetime value
 */
export const ECOMMERCE_TEMPLATE: SalesIndustryTemplate = {
  id: 'ecommerce',
  name: 'E-Commerce Sales Process',
  description: 'Optimized for product sales, wholesale, and B2B commerce',
  industry: 'E-Commerce & Retail',
  category: 'b2b2c',
  icon: '🛒',
  
  stages: [
    {
      id: 'inquiry',
      name: 'Inquiry',
      description: 'Initial product inquiry or quote request',
      probability: 15,
      averageDuration: 2,
      requiredActions: [
        'Respond within 2 hours',
        'Send product catalog',
        'Provide pricing information'
      ],
      exitCriteria: [
        'Product interest confirmed',
        'Pricing discussed',
        'Volume requirements understood'
      ]
    },
    {
      id: 'quote',
      name: 'Quote Sent',
      description: 'Custom quote or bulk pricing sent',
      probability: 35,
      averageDuration: 3,
      requiredActions: [
        'Send detailed quote',
        'Clarify MOQ (Minimum Order Quantity)',
        'Explain payment terms',
        'Provide samples if needed'
      ],
      exitCriteria: [
        'Quote reviewed',
        'Pricing accepted',
        'Payment terms agreed'
      ]
    },
    {
      id: 'negotiation',
      name: 'Negotiation',
      description: 'Price and terms negotiation',
      probability: 55,
      averageDuration: 3,
      requiredActions: [
        'Negotiate pricing',
        'Clarify shipping terms',
        'Confirm delivery timeline',
        'Finalize payment method'
      ],
      exitCriteria: [
        'Final price agreed',
        'Delivery date confirmed',
        'Payment method confirmed'
      ]
    },
    {
      id: 'order_placed',
      name: 'Order Placed',
      description: 'Purchase order or payment received',
      probability: 85,
      averageDuration: 2,
      requiredActions: [
        'Confirm order',
        'Send order confirmation',
        'Schedule production/fulfillment',
        'Provide tracking information'
      ],
      exitCriteria: [
        'Payment confirmed',
        'Order in production',
        'Estimated ship date confirmed'
      ]
    },
    {
      id: 'closed_won',
      name: 'Closed Won',
      description: 'Order fulfilled and delivered',
      probability: 100,
      averageDuration: 0,
      requiredActions: [
        'Confirm delivery',
        'Request feedback',
        'Upsell related products',
        'Schedule follow-up for reorders'
      ],
      exitCriteria: []
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      description: 'Deal was lost',
      probability: 0,
      averageDuration: 0,
      requiredActions: [
        'Document loss reason',
        'Add to seasonal campaign',
        'Track for future opportunities'
      ],
      exitCriteria: []
    }
  ],
  
  fields: [
    {
      id: 'order_value',
      name: 'Order Value',
      type: 'currency',
      description: 'Total order amount',
      required: true
    },
    {
      id: 'order_quantity',
      name: 'Order Quantity',
      type: 'number',
      description: 'Number of units',
      required: true
    },
    {
      id: 'product_category',
      name: 'Product Category',
      type: 'select',
      description: 'Primary product category',
      required: true,
      options: ['Apparel', 'Electronics', 'Food & Beverage', 'Home Goods', 'Industrial Supplies', 'Other']
    },
    {
      id: 'customer_type',
      name: 'Customer Type',
      type: 'select',
      description: 'Type of customer',
      required: true,
      options: ['Wholesale', 'Distributor', 'Retailer', 'End Customer', 'Corporate']
    },
    {
      id: 'shipping_method',
      name: 'Shipping Method',
      type: 'select',
      description: 'How products will be shipped',
      required: false,
      options: ['Standard', 'Express', 'Freight', 'Pickup']
    },
    {
      id: 'payment_terms',
      name: 'Payment Terms',
      type: 'select',
      description: 'Payment arrangement',
      required: true,
      options: ['Prepay', 'Net 15', 'Net 30', 'Net 60', 'COD']
    },
    {
      id: 'seasonal_buyer',
      name: 'Seasonal Buyer',
      type: 'boolean',
      description: 'Does this customer buy seasonally',
      required: false,
      defaultValue: false
    },
    {
      id: 'reorder_frequency',
      name: 'Reorder Frequency',
      type: 'select',
      description: 'How often they typically reorder',
      required: false,
      options: ['Weekly', 'Monthly', 'Quarterly', 'Annually', 'One-time']
    }
  ],
  
  workflows: [
    {
      id: 'inquiry_response',
      name: 'Rapid Inquiry Response',
      description: 'Alert rep to respond to new inquiries within 2 hours',
      trigger: 'stage_change',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'inquiry' }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Respond to inquiry within 2 hours',
            dueInHours: 2,
            priority: 'high'
          }
        },
        {
          type: 'notification',
          config: {
            message: 'New product inquiry - respond urgently',
            recipients: ['assignedRep']
          }
        }
      ]
    },
    {
      id: 'reorder_reminder',
      name: 'Reorder Reminder',
      description: 'Remind rep to reach out for seasonal reorders',
      trigger: 'time_based',
      conditions: [
        { field: 'seasonal_buyer', operator: 'equals', value: true }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Reach out for seasonal reorder',
            priority: 'medium'
          }
        }
      ]
    }
  ],
  
  bestPractices: [
    {
      id: 'ecom_bp_1',
      category: 'qualification',
      title: 'Respond fast to inquiries',
      description: 'E-commerce buyers expect quick responses. Respond within 2 hours or lose the deal',
      impact: 'high'
    },
    {
      id: 'ecom_bp_2',
      category: 'discovery',
      title: 'Understand volume requirements',
      description: 'Clarify minimum order quantities, bulk discounts, and shipping logistics early',
      impact: 'high'
    },
    {
      id: 'ecom_bp_3',
      category: 'presentation',
      title: 'Provide product samples',
      description: 'For wholesale/B2B, samples de-risk the purchase and speed up decisions',
      impact: 'medium'
    },
    {
      id: 'ecom_bp_4',
      category: 'negotiation',
      title: 'Clarify payment terms upfront',
      description: 'Net 30, prepayment, COD - avoid surprises by discussing early',
      impact: 'high'
    },
    {
      id: 'ecom_bp_5',
      category: 'closing',
      title: 'Upsell and cross-sell',
      description: 'Once they buy, recommend complementary products for additional revenue',
      impact: 'medium'
    }
  ],
  
  benchmarks: {
    avgDealSize: 5000, // $5K per order
    avgSalesCycle: 7, // 7 days
    avgWinRate: 45, // 45%
    avgDealsPerRep: 20, // 20 deals/month
    avgConversionRate: 30 // 30% inquiry to order
  },
  
  scoringWeights: {
    dealAge: 0.15,
    stageVelocity: 0.25,
    engagement: 0.20,
    decisionMaker: 0.10,
    budget: 0.15,
    competition: 0.10,
    historicalWinRate: 0.05
  },
  
  aiPrompt: `You are an e-commerce and wholesale sales expert. Help sales reps close product deals by:
- Responding to inquiries within 2 hours
- Providing detailed product information and specs
- Offering volume discounts and bulk pricing
- Clarifying shipping, MOQ, and payment terms
- Recommending complementary products (upselling)
- Building long-term relationships for repeat orders`,
  
  discoveryQuestions: [
    'What quantity are you looking to order?',
    'When do you need the products delivered?',
    'Is this a one-time purchase or ongoing need?',
    'What is your budget per unit?',
    'Do you need samples before placing a bulk order?',
    'What are your payment terms preferences?',
    'Are you buying for resale or internal use?',
    'What other products do you typically buy?'
  ],
  
  commonObjections: [
    'Price is too high',
    'Minimum order quantity too large',
    'Delivery time too long',
    'Need to see samples first',
    'Found cheaper elsewhere',
    'Payment terms not favorable',
    'Uncertain about quality',
    'Shipping costs too high'
  ]
};

/**
 * Healthcare Template
 * 
 * Optimized for healthcare and medical sales with focus on:
 * - Long sales cycles
 * - Complex stakeholder management
 * - Compliance and regulatory requirements
 * - Evidence-based selling
 */
export const HEALTHCARE_TEMPLATE: SalesIndustryTemplate = {
  id: 'healthcare',
  name: 'Healthcare Sales Process',
  description: 'Optimized for medical devices, healthcare IT, and clinical services',
  industry: 'Healthcare & Life Sciences',
  category: 'b2b',
  icon: '🏥',
  
  stages: [
    {
      id: 'lead',
      name: 'Lead',
      description: 'Initial contact with healthcare organization',
      probability: 10,
      averageDuration: 14,
      requiredActions: [
        'Identify decision makers',
        'Map stakeholder committee',
        'Understand budget cycle',
        'Research compliance requirements'
      ],
      exitCriteria: [
        'Key stakeholders identified',
        'Budget confirmed',
        'Compliance requirements understood'
      ]
    },
    {
      id: 'qualification',
      name: 'Qualification',
      description: 'Qualifying clinical and business needs',
      probability: 20,
      averageDuration: 21,
      requiredActions: [
        'Conduct needs assessment',
        'Review clinical requirements',
        'Identify pain points',
        'Map decision-making process'
      ],
      exitCriteria: [
        'Clinical need validated',
        'Budget authority confirmed',
        'Timeline established',
        'RFP requirements understood'
      ]
    },
    {
      id: 'evaluation',
      name: 'Clinical Evaluation',
      description: 'Product evaluation and clinical trials',
      probability: 35,
      averageDuration: 30,
      requiredActions: [
        'Schedule product demo',
        'Provide clinical evidence',
        'Arrange trial/pilot program',
        'Address safety concerns'
      ],
      exitCriteria: [
        'Clinical efficacy demonstrated',
        'Safety requirements met',
        'User acceptance confirmed',
        'ROI validated'
      ]
    },
    {
      id: 'proposal',
      name: 'Proposal',
      description: 'RFP response or proposal submitted',
      probability: 50,
      averageDuration: 21,
      requiredActions: [
        'Submit comprehensive proposal',
        'Provide clinical data',
        'Include compliance documentation',
        'Present to committee'
      ],
      exitCriteria: [
        'Proposal reviewed',
        'Committee approval obtained',
        'Compliance verified',
        'Budget approved'
      ]
    },
    {
      id: 'negotiation',
      name: 'Negotiation & Contract',
      description: 'Contract negotiation and legal review',
      probability: 70,
      averageDuration: 30,
      requiredActions: [
        'Negotiate pricing',
        'Finalize service level agreements',
        'Complete legal review',
        'Arrange implementation plan'
      ],
      exitCriteria: [
        'Contract terms agreed',
        'Legal approval obtained',
        'Implementation timeline set',
        'Training plan confirmed'
      ]
    },
    {
      id: 'closed_won',
      name: 'Closed Won',
      description: 'Contract signed and implementation started',
      probability: 100,
      averageDuration: 0,
      requiredActions: [
        'Execute contract',
        'Schedule implementation',
        'Begin staff training',
        'Establish success metrics'
      ],
      exitCriteria: []
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      description: 'Deal was lost',
      probability: 0,
      averageDuration: 0,
      requiredActions: [
        'Document loss reason',
        'Request feedback from committee',
        'Maintain relationship for future opportunities',
        'Update competitive intelligence'
      ],
      exitCriteria: []
    }
  ],
  
  fields: [
    {
      id: 'deal_value',
      name: 'Total Contract Value',
      type: 'currency',
      description: 'Total value of the healthcare contract',
      required: true
    },
    {
      id: 'facility_type',
      name: 'Facility Type',
      type: 'select',
      description: 'Type of healthcare facility',
      required: true,
      options: ['Hospital', 'Clinic', 'Practice Group', 'Health System', 'Long-term Care', 'Urgent Care']
    },
    {
      id: 'bed_count',
      name: 'Bed Count',
      type: 'number',
      description: 'Number of beds (for hospitals)',
      required: false
    },
    {
      id: 'clinical_champion',
      name: 'Clinical Champion',
      type: 'text',
      description: 'Name of clinical champion or key physician',
      required: false
    },
    {
      id: 'committee_decision',
      name: 'Committee Decision',
      type: 'boolean',
      description: 'Does this require committee approval',
      required: false,
      defaultValue: true
    },
    {
      id: 'budget_cycle',
      name: 'Budget Cycle',
      type: 'select',
      description: 'When is their budget cycle',
      required: false,
      options: ['Calendar Year', 'Fiscal Year (Oct-Sep)', 'Fiscal Year (Jul-Jun)', 'Rolling']
    },
    {
      id: 'compliance_requirements',
      name: 'Compliance Requirements',
      type: 'multiselect',
      description: 'Regulatory compliance needed',
      required: false,
      options: ['HIPAA', 'FDA', 'Joint Commission', 'CMS', 'State Licensing', 'ISO Certification']
    },
    {
      id: 'implementation_timeline',
      name: 'Implementation Timeline',
      type: 'number',
      description: 'Expected implementation duration (months)',
      required: false
    }
  ],
  
  workflows: [
    {
      id: 'committee_prep',
      name: 'Committee Presentation Prep',
      description: 'Prepare for committee presentation',
      trigger: 'stage_change',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'proposal' },
        { field: 'committee_decision', operator: 'equals', value: true }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Prepare committee presentation with clinical data',
            dueInDays: 7,
            priority: 'high'
          }
        },
        {
          type: 'task',
          config: {
            title: 'Send clinical evidence and ROI analysis to champion',
            dueInDays: 5,
            priority: 'high'
          }
        }
      ]
    }
  ],
  
  bestPractices: [
    {
      id: 'hc_bp_1',
      category: 'qualification',
      title: 'Map the committee early',
      description: 'Healthcare decisions involve committees. Identify all stakeholders (clinical, financial, IT, compliance) upfront',
      impact: 'high'
    },
    {
      id: 'hc_bp_2',
      category: 'discovery',
      title: 'Find your clinical champion',
      description: 'You need a physician or clinical leader to advocate for you internally',
      impact: 'high'
    },
    {
      id: 'hc_bp_3',
      category: 'presentation',
      title: 'Lead with clinical evidence',
      description: 'Healthcare buyers need peer-reviewed studies, clinical outcomes data, and safety evidence',
      impact: 'high'
    },
    {
      id: 'hc_bp_4',
      category: 'negotiation',
      title: 'Understand budget cycles',
      description: 'Healthcare organizations have strict budget cycles. Timing is critical',
      impact: 'high'
    },
    {
      id: 'hc_bp_5',
      category: 'closing',
      title: 'Plan for long implementation',
      description: 'Healthcare implementations take time. Set realistic expectations for training and rollout',
      impact: 'medium'
    }
  ],
  
  benchmarks: {
    avgDealSize: 150000, // $150K
    avgSalesCycle: 120, // 120 days (4 months)
    avgWinRate: 20, // 20%
    avgDealsPerRep: 2, // 2 deals/month
    avgConversionRate: 10 // 10% lead to deal
  },
  
  scoringWeights: {
    dealAge: 0.05,
    stageVelocity: 0.15,
    engagement: 0.20,
    decisionMaker: 0.25,
    budget: 0.20,
    competition: 0.10,
    historicalWinRate: 0.05
  },
  
  aiPrompt: `You are a healthcare sales expert. Help sales reps close deals in healthcare by:
- Identifying and engaging all committee stakeholders
- Providing clinical evidence and peer-reviewed studies
- Navigating complex regulatory requirements (HIPAA, FDA, etc.)
- Building relationships with clinical champions
- Understanding long budget cycles and capital planning
- Addressing patient safety and clinical efficacy concerns`,
  
  discoveryQuestions: [
    'What clinical problem are you trying to solve?',
    'What is your current solution and its limitations?',
    'Who is on the decision-making committee?',
    'What clinical evidence do you need to see?',
    'When is your next budget cycle?',
    'What compliance requirements must we meet?',
    'Who is your clinical champion for this initiative?',
    'What does a successful pilot program look like?',
    'What ROI metrics matter most to your CFO?'
  ],
  
  commonObjections: [
    'Need more clinical evidence',
    'Committee has not approved budget',
    'Competing with existing vendor contract',
    'Implementation timeline too long',
    'Training requirements too complex',
    'Compliance concerns',
    'Integration with existing EMR',
    'Change management resistance from clinicians'
  ]
};

/**
 * Fintech Template
 * 
 * Optimized for financial technology sales with focus on:
 * - Security and compliance
 * - Integration complexity
 * - Financial ROI and cost savings
 * - Regulatory requirements
 */
export const FINTECH_TEMPLATE: SalesIndustryTemplate = {
  id: 'fintech',
  name: 'Fintech Sales Process',
  description: 'Optimized for financial services and payment technology',
  industry: 'Financial Services & Technology',
  category: 'b2b',
  icon: '💳',
  
  stages: [
    {
      id: 'inquiry',
      name: 'Inquiry',
      description: 'Initial contact from prospect',
      probability: 15,
      averageDuration: 7,
      requiredActions: [
        'Understand financial use case',
        'Identify compliance requirements',
        'Assess integration needs',
        'Qualify budget and authority'
      ],
      exitCriteria: [
        'Use case documented',
        'Compliance needs identified',
        'Budget confirmed',
        'Key stakeholders identified'
      ]
    },
    {
      id: 'discovery',
      name: 'Discovery & Requirements',
      description: 'Technical and business requirements gathering',
      probability: 25,
      averageDuration: 10,
      requiredActions: [
        'Conduct technical discovery',
        'Review security requirements',
        'Assess API integration needs',
        'Document compliance requirements'
      ],
      exitCriteria: [
        'Technical requirements documented',
        'Security assessment completed',
        'Integration scope defined',
        'Compliance checklist confirmed'
      ]
    },
    {
      id: 'proof_of_concept',
      name: 'Proof of Concept',
      description: 'Technical POC or sandbox testing',
      probability: 40,
      averageDuration: 21,
      requiredActions: [
        'Set up sandbox environment',
        'Conduct integration testing',
        'Demonstrate security features',
        'Validate compliance controls'
      ],
      exitCriteria: [
        'POC successful',
        'Integration validated',
        'Security approved',
        'Performance benchmarks met'
      ]
    },
    {
      id: 'proposal',
      name: 'Commercial Proposal',
      description: 'Pricing and contract proposal',
      probability: 60,
      averageDuration: 14,
      requiredActions: [
        'Send pricing proposal',
        'Provide SLA documentation',
        'Share compliance certifications',
        'Present to decision makers'
      ],
      exitCriteria: [
        'Pricing approved',
        'SLAs agreed',
        'Compliance verified',
        'Legal review initiated'
      ]
    },
    {
      id: 'legal_security_review',
      name: 'Legal & Security Review',
      description: 'Contract and security assessment',
      probability: 75,
      averageDuration: 21,
      requiredActions: [
        'Complete vendor security questionnaire',
        'Provide SOC 2 / ISO certifications',
        'Negotiate contract terms',
        'Complete penetration testing'
      ],
      exitCriteria: [
        'Security assessment passed',
        'Contract terms finalized',
        'Compliance approved',
        'Data privacy agreement signed'
      ]
    },
    {
      id: 'closed_won',
      name: 'Closed Won',
      description: 'Contract signed, implementation begins',
      probability: 100,
      averageDuration: 0,
      requiredActions: [
        'Execute contract',
        'Schedule technical onboarding',
        'Assign integration engineer',
        'Set up production environment'
      ],
      exitCriteria: []
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      description: 'Deal was lost',
      probability: 0,
      averageDuration: 0,
      requiredActions: [
        'Document loss reason',
        'Request technical feedback',
        'Update competitive intelligence',
        'Maintain relationship for future'
      ],
      exitCriteria: []
    }
  ],
  
  fields: [
    {
      id: 'contract_value',
      name: 'Annual Contract Value',
      type: 'currency',
      description: 'Total annual contract value',
      required: true
    },
    {
      id: 'transaction_volume',
      name: 'Expected Transaction Volume',
      type: 'number',
      description: 'Monthly transaction volume',
      required: false
    },
    {
      id: 'integration_complexity',
      name: 'Integration Complexity',
      type: 'select',
      description: 'Complexity of technical integration',
      required: false,
      options: ['Simple (API only)', 'Moderate (API + SDK)', 'Complex (Custom Integration)', 'Enterprise (Multi-system)']
    },
    {
      id: 'compliance_reqs',
      name: 'Compliance Requirements',
      type: 'multiselect',
      description: 'Regulatory compliance needed',
      required: true,
      options: ['PCI DSS', 'SOC 2', 'GDPR', 'CCPA', 'ISO 27001', 'FINRA', 'SEC', 'Banking Regulations']
    },
    {
      id: 'security_review',
      name: 'Security Review Required',
      type: 'boolean',
      description: 'Does this require formal security review',
      required: false,
      defaultValue: true
    },
    {
      id: 'use_case',
      name: 'Primary Use Case',
      type: 'select',
      description: 'Main use case for the product',
      required: true,
      options: ['Payments', 'Banking', 'Lending', 'Fraud Detection', 'KYC/AML', 'Trading', 'Wealth Management']
    },
    {
      id: 'go_live_date',
      name: 'Target Go-Live Date',
      type: 'date',
      description: 'When they need to be in production',
      required: false
    },
    {
      id: 'deployment_type',
      name: 'Deployment Type',
      type: 'select',
      description: 'How they want to deploy',
      required: false,
      options: ['Cloud (SaaS)', 'Private Cloud', 'On-Premise', 'Hybrid']
    }
  ],
  
  workflows: [
    {
      id: 'security_questionnaire',
      name: 'Security Questionnaire Trigger',
      description: 'Send security questionnaire when deal reaches proposal stage',
      trigger: 'stage_change',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'proposal' }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Send security questionnaire to prospect',
            dueInDays: 1,
            priority: 'high'
          }
        },
        {
          type: 'email',
          config: {
            template: 'security_questionnaire',
            to: 'contact'
          }
        }
      ]
    }
  ],
  
  bestPractices: [
    {
      id: 'ft_bp_1',
      category: 'qualification',
      title: 'Qualify compliance requirements early',
      description: 'Financial services have strict regulatory requirements. Qualify PCI, SOC 2, GDPR needs upfront',
      impact: 'high'
    },
    {
      id: 'ft_bp_2',
      category: 'discovery',
      title: 'Involve security and compliance teams',
      description: 'Fintech deals require security, compliance, and legal approval. Engage these teams early',
      impact: 'high'
    },
    {
      id: 'ft_bp_3',
      category: 'presentation',
      title: 'Showcase security certifications',
      description: 'Lead with SOC 2, PCI DSS, ISO certifications. Security is table stakes in fintech',
      impact: 'high'
    },
    {
      id: 'ft_bp_4',
      category: 'negotiation',
      title: 'Clearly define SLAs',
      description: 'Financial systems need uptime guarantees. Define SLAs (99.9% uptime) and incident response',
      impact: 'high'
    },
    {
      id: 'ft_bp_5',
      category: 'closing',
      title: 'Plan for long legal review',
      description: 'Fintech contracts take time for legal review. Factor in 30-60 days for legal',
      impact: 'medium'
    }
  ],
  
  benchmarks: {
    avgDealSize: 75000, // $75K
    avgSalesCycle: 75, // 75 days
    avgWinRate: 25, // 25%
    avgDealsPerRep: 3, // 3 deals/month
    avgConversionRate: 15 // 15% inquiry to deal
  },
  
  scoringWeights: {
    dealAge: 0.10,
    stageVelocity: 0.20,
    engagement: 0.20,
    decisionMaker: 0.20,
    budget: 0.15,
    competition: 0.10,
    historicalWinRate: 0.05
  },
  
  aiPrompt: `You are a fintech sales expert. Help sales reps close financial technology deals by:
- Qualifying compliance requirements (PCI, SOC 2, GDPR, etc.)
- Engaging security and legal teams early
- Demonstrating technical integration capabilities
- Providing clear SLAs and uptime guarantees
- Addressing data privacy and security concerns
- Navigating regulatory approval processes`,
  
  discoveryQuestions: [
    'What financial use case are you solving?',
    'What compliance requirements do you have? (PCI, SOC 2, etc.)',
    'What is your current payment/financial infrastructure?',
    'What transaction volume do you process monthly?',
    'What security certifications do you require?',
    'What are your integration requirements?',
    'When do you need to be live in production?',
    'Who needs to approve this (security, legal, compliance)?',
    'What are your SLA requirements?'
  ],
  
  commonObjections: [
    'Security concerns',
    'Compliance not verified',
    'Integration too complex',
    'Legal review taking too long',
    'Pricing per transaction too high',
    'Need more uptime guarantees',
    'Competitor has better certifications',
    'Switching costs too high'
  ]
};

/**
 * Manufacturing Template
 * 
 * Optimized for industrial and manufacturing sales with focus on:
 * - Long sales cycles and complex procurement
 * - Technical specifications
 * - Bulk orders and contracts
 * - Supply chain integration
 */
export const MANUFACTURING_TEMPLATE: SalesIndustryTemplate = {
  id: 'manufacturing',
  name: 'Manufacturing Sales Process',
  description: 'Optimized for industrial equipment, materials, and components',
  industry: 'Manufacturing & Industrial',
  category: 'b2b',
  icon: '🏭',
  
  stages: [
    {
      id: 'inquiry',
      name: 'RFQ/Inquiry',
      description: 'Request for quote or initial inquiry',
      probability: 10,
      averageDuration: 7,
      requiredActions: [
        'Review technical specifications',
        'Assess manufacturing capacity',
        'Understand volume requirements',
        'Qualify lead time expectations'
      ],
      exitCriteria: [
        'Specifications understood',
        'Capacity confirmed',
        'Volume requirements documented',
        'Lead time feasible'
      ]
    },
    {
      id: 'technical_review',
      name: 'Technical Review',
      description: 'Engineering and technical evaluation',
      probability: 20,
      averageDuration: 14,
      requiredActions: [
        'Conduct technical assessment',
        'Provide product samples',
        'Review quality standards',
        'Assess certification requirements'
      ],
      exitCriteria: [
        'Technical fit confirmed',
        'Samples approved',
        'Quality standards met',
        'Certifications verified'
      ]
    },
    {
      id: 'quote',
      name: 'Quote Submitted',
      description: 'Formal quote or proposal submitted',
      probability: 35,
      averageDuration: 10,
      requiredActions: [
        'Submit detailed quote',
        'Provide technical drawings',
        'Clarify payment terms',
        'Define delivery schedule'
      ],
      exitCriteria: [
        'Quote reviewed',
        'Technical specs approved',
        'Pricing in budget',
        'Delivery acceptable'
      ]
    },
    {
      id: 'negotiation',
      name: 'Negotiation',
      description: 'Price and contract negotiation',
      probability: 55,
      averageDuration: 14,
      requiredActions: [
        'Negotiate pricing',
        'Finalize technical specifications',
        'Agree on delivery terms',
        'Establish quality metrics'
      ],
      exitCriteria: [
        'Pricing agreed',
        'Specs finalized',
        'Delivery terms set',
        'Quality requirements documented'
      ]
    },
    {
      id: 'purchase_order',
      name: 'Purchase Order',
      description: 'PO received, production scheduled',
      probability: 80,
      averageDuration: 7,
      requiredActions: [
        'Confirm purchase order',
        'Schedule production',
        'Order materials',
        'Set delivery date'
      ],
      exitCriteria: [
        'PO confirmed',
        'Production scheduled',
        'Materials ordered',
        'Delivery date set'
      ]
    },
    {
      id: 'closed_won',
      name: 'Closed Won',
      description: 'Order fulfilled and delivered',
      probability: 100,
      averageDuration: 0,
      requiredActions: [
        'Complete production',
        'Conduct quality inspection',
        'Ship order',
        'Confirm delivery and payment'
      ],
      exitCriteria: []
    },
    {
      id: 'closed_lost',
      name: 'Closed Lost',
      description: 'Deal was lost',
      probability: 0,
      averageDuration: 0,
      requiredActions: [
        'Document loss reason',
        'Update competitive intelligence',
        'Request feedback on quote',
        'Add to future bid opportunities'
      ],
      exitCriteria: []
    }
  ],
  
  fields: [
    {
      id: 'order_value',
      name: 'Order Value',
      type: 'currency',
      description: 'Total order value',
      required: true
    },
    {
      id: 'part_number',
      name: 'Part Number(s)',
      type: 'text',
      description: 'Product or part numbers',
      required: false
    },
    {
      id: 'order_quantity',
      name: 'Order Quantity',
      type: 'number',
      description: 'Number of units',
      required: true
    },
    {
      id: 'lead_time',
      name: 'Required Lead Time',
      type: 'number',
      description: 'Lead time required (weeks)',
      required: false
    },
    {
      id: 'procurement_type',
      name: 'Procurement Type',
      type: 'select',
      description: 'Type of procurement',
      required: false,
      options: ['One-time Order', 'Blanket PO', 'Long-term Contract', 'JIT (Just-in-Time)', 'Consignment']
    },
    {
      id: 'quality_certs',
      name: 'Quality Certifications Required',
      type: 'multiselect',
      description: 'Required certifications',
      required: false,
      options: ['ISO 9001', 'AS9100', 'IATF 16949', 'ISO 13485', 'UL Listing', 'CE Mark', 'RoHS']
    },
    {
      id: 'material_type',
      name: 'Material/Product Type',
      type: 'select',
      description: 'Type of material or product',
      required: false,
      options: ['Raw Materials', 'Components', 'Sub-assemblies', 'Finished Goods', 'Tooling', 'Equipment']
    },
    {
      id: 'incoterms',
      name: 'Incoterms',
      type: 'select',
      description: 'Shipping terms',
      required: false,
      options: ['EXW', 'FOB', 'CIF', 'DDP', 'DAP']
    }
  ],
  
  workflows: [
    {
      id: 'sample_approval',
      name: 'Sample Approval Process',
      description: 'Track sample approval before quote',
      trigger: 'stage_change',
      conditions: [
        { field: 'stage', operator: 'equals', value: 'technical_review' }
      ],
      actions: [
        {
          type: 'task',
          config: {
            title: 'Send product samples to prospect',
            dueInDays: 7,
            priority: 'high'
          }
        },
        {
          type: 'task',
          config: {
            title: 'Follow up on sample approval',
            dueInDays: 14,
            priority: 'medium'
          }
        }
      ]
    }
  ],
  
  bestPractices: [
    {
      id: 'mfg_bp_1',
      category: 'qualification',
      title: 'Understand technical specifications',
      description: 'Get detailed specs early. Manufacturing requires precision - vague requirements cause delays',
      impact: 'high'
    },
    {
      id: 'mfg_bp_2',
      category: 'discovery',
      title: 'Clarify volume and lead time',
      description: 'Volume affects pricing, lead time affects production scheduling. Lock these down early',
      impact: 'high'
    },
    {
      id: 'mfg_bp_3',
      category: 'presentation',
      title: 'Provide samples and certifications',
      description: 'Samples prove quality, certifications (ISO, AS9100) prove capability',
      impact: 'high'
    },
    {
      id: 'mfg_bp_4',
      category: 'negotiation',
      title: 'Establish quality metrics',
      description: 'Define acceptable defect rates, inspection criteria, and recourse for quality issues',
      impact: 'high'
    },
    {
      id: 'mfg_bp_5',
      category: 'closing',
      title: 'Confirm delivery and payment terms',
      description: 'Manufacturing deals need clear Incoterms, payment terms (Net 30/60), and delivery schedules',
      impact: 'medium'
    }
  ],
  
  benchmarks: {
    avgDealSize: 50000, // $50K
    avgSalesCycle: 45, // 45 days
    avgWinRate: 30, // 30%
    avgDealsPerRep: 4, // 4 deals/month
    avgConversionRate: 20 // 20% RFQ to order
  },
  
  scoringWeights: {
    dealAge: 0.15,
    stageVelocity: 0.20,
    engagement: 0.15,
    decisionMaker: 0.15,
    budget: 0.20,
    competition: 0.10,
    historicalWinRate: 0.05
  },
  
  aiPrompt: `You are a manufacturing and industrial sales expert. Help sales reps close deals by:
- Understanding technical specifications and requirements
- Providing accurate quotes based on volume and lead time
- Offering product samples and quality certifications
- Navigating complex procurement processes
- Establishing clear quality metrics and inspection criteria
- Managing long-term supplier relationships`,
  
  discoveryQuestions: [
    'What are the exact technical specifications?',
    'What quantity do you need (initial and ongoing)?',
    'What is your required lead time?',
    'What quality certifications do you require?',
    'Is this a one-time order or long-term contract?',
    'What are your payment terms?',
    'What delivery terms (Incoterms) do you prefer?',
    'What is your inspection and acceptance process?',
    'Who are your current suppliers and why are you looking to change?'
  ],
  
  commonObjections: [
    'Price too high compared to current supplier',
    'Lead time too long',
    'Quality certifications not sufficient',
    'Minimum order quantity too high',
    'No track record with our industry',
    'Payment terms not favorable',
    'Delivery terms unacceptable',
    'Sample quality not satisfactory'
  ]
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const SALES_INDUSTRY_TEMPLATES: Record<string, SalesIndustryTemplate> = {
  saas: SAAS_TEMPLATE,
  ecommerce: ECOMMERCE_TEMPLATE,
  healthcare: HEALTHCARE_TEMPLATE,
  fintech: FINTECH_TEMPLATE,
  manufacturing: MANUFACTURING_TEMPLATE,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): SalesIndustryTemplate | null {
  return SALES_INDUSTRY_TEMPLATES[templateId] || null;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): SalesIndustryTemplate[] {
  return Object.values(SALES_INDUSTRY_TEMPLATES);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): SalesIndustryTemplate[] {
  return getAllTemplates().filter(template => template.category === category);
}

/**
 * Search templates by industry keyword
 */
export function searchTemplates(keyword: string): SalesIndustryTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  return getAllTemplates().filter(template => 
    template.industry.toLowerCase().includes(lowerKeyword) ||
    template.name.toLowerCase().includes(lowerKeyword) ||
    template.description.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get recommended template based on business type
 */
export function getRecommendedTemplate(businessType: string): SalesIndustryTemplate | null {
  const lowerType = businessType.toLowerCase();
  
  if (lowerType.includes('software') || lowerType.includes('saas') || lowerType.includes('tech')) {
    return SAAS_TEMPLATE;
  }
  if (lowerType.includes('ecommerce') || lowerType.includes('retail') || lowerType.includes('shop')) {
    return ECOMMERCE_TEMPLATE;
  }
  if (lowerType.includes('health') || lowerType.includes('medical') || lowerType.includes('clinical')) {
    return HEALTHCARE_TEMPLATE;
  }
  if (lowerType.includes('fintech') || lowerType.includes('payment') || lowerType.includes('financial')) {
    return FINTECH_TEMPLATE;
  }
  if (lowerType.includes('manufact') || lowerType.includes('industrial') || lowerType.includes('factory')) {
    return MANUFACTURING_TEMPLATE;
  }
  
  return null;
}

logger.info('Industry templates loaded', {
  count: Object.keys(SALES_INDUSTRY_TEMPLATES).length,
  templates: Object.keys(SALES_INDUSTRY_TEMPLATES)
});
