/**
 * Lead Scoring System Types
 * 
 * 100% Native AI-powered lead scoring based on Discovery Engine data.
 * 
 * HUNTER-CLOSER COMPLIANCE:
 * - Uses ONLY native discovery data (no third-party APIs)
 * - Analyzes person + company data from our scraping
 * - Configurable scoring rules per organization
 * - Real-time score calculation
 * - Intent signal detection
 * 
 * Scoring Components (0-100 scale):
 * - Company Fit Score (0-40 points)
 * - Person Fit Score (0-30 points)
 * - Intent Signals (0-20 points)
 * - Engagement Score (0-10 points)
 */

import type { DiscoveredCompany, DiscoveredPerson } from '@/lib/services/discovery-engine';

// ============================================================================
// CORE LEAD SCORE TYPES
// ============================================================================

/**
 * Lead score result with breakdown
 */
export interface LeadScore {
  /** Overall lead quality score (0-100) */
  totalScore: number;
  
  /** Score grade: A (90-100), B (75-89), C (60-74), D (40-59), F (0-39) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  
  /** Priority tier: hot, warm, cold */
  priority: 'hot' | 'warm' | 'cold';
  
  /** Component scores breakdown */
  breakdown: {
    companyFit: number;      // 0-40 points
    personFit: number;       // 0-30 points
    intentSignals: number;   // 0-20 points
    engagement: number;      // 0-10 points
  };
  
  /** Detailed reasons for score */
  reasons: LeadScoreReason[];
  
  /** Intent signals detected */
  detectedSignals: IntentSignal[];
  
  /** Metadata */
  metadata: {
    scoredAt: Date;
    version: string;        // Scoring model version
    confidence: number;     // 0-1, confidence in the score
    expiresAt: Date;        // Score expires after 7 days
  };
}

/**
 * Individual scoring reason with explanation
 */
export interface LeadScoreReason {
  category: 'company' | 'person' | 'intent' | 'engagement';
  factor: string;          // e.g., "Industry match", "Seniority level"
  points: number;          // Points awarded
  explanation: string;     // Human-readable explanation
  impact: 'high' | 'medium' | 'low';
}

/**
 * Intent signal detected from discovery data
 */
export interface IntentSignal {
  type: IntentSignalType;
  confidence: number;      // 0-1
  detectedAt: Date;
  source: string;          // Where signal was found
  description: string;
  points: number;          // Points contributed to score
}

export type IntentSignalType =
  | 'hiring'                    // Company is hiring
  | 'funding'                   // Recent funding
  | 'job_change'               // Person recently changed jobs
  | 'tech_stack_match'         // Uses relevant technologies
  | 'expansion'                // Geographic/product expansion
  | 'press_mention'            // Recent press coverage
  | 'website_update'           // Recent website changes
  | 'high_growth'              // Indicators of high growth
  | 'exec_new'                 // New executive hire
  | 'product_launch';          // New product/feature launch

// ============================================================================
// SCORING RULES CONFIGURATION
// ============================================================================

/**
 * Organization-specific scoring rules
 */
export interface ScoringRules {
  id: string;
  name: string;
  description?: string;
  
  /** Company fit rules */
  companyRules: CompanyFitRules;
  
  /** Person fit rules */
  personRules: PersonFitRules;
  
  /** Intent signal weights */
  intentWeights: Record<IntentSignalType, number>;
  
  /** Engagement scoring rules */
  engagementRules: EngagementRules;
  
  /** Active/inactive */
  isActive: boolean;
  
  /** Metadata */
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Company fit scoring rules
 */
export interface CompanyFitRules {
  /** Industry preferences (max 15 points) */
  industries: {
    preferred: string[];     // Full points
    acceptable: string[];    // Partial points
    excluded: string[];      // Auto-disqualify
    preferredPoints: number; // Default: 15
    acceptablePoints: number; // Default: 7
  };
  
  /** Company size preferences (max 10 points) */
  size: {
    preferred: CompanySizeRange[];
    preferredPoints: number; // Default: 10
    notPreferredPoints: number; // Default: 3
  };
  
  /** Tech stack match (max 10 points) */
  techStack: {
    required: string[];      // Technologies that are required
    preferred: string[];     // Technologies that are nice to have
    requiredPoints: number;  // Default: 10
    preferredPoints: number; // Default: 5
  };
  
  /** Growth indicators (max 5 points) */
  growth: {
    fundingStages: string[]; // e.g., ['Series A', 'Series B']
    points: number;          // Default: 5
  };
}

export type CompanySizeRange = 
  | '1-10'
  | '10-50'
  | '50-200'
  | '200-1000'
  | '1000+'
  | 'Enterprise';

/**
 * Person fit scoring rules
 */
export interface PersonFitRules {
  /** Job titles (max 15 points) */
  titles: {
    preferred: string[];     // Exact matches or patterns
    acceptable: string[];
    excluded: string[];      // Auto-disqualify
    preferredPoints: number; // Default: 15
    acceptablePoints: number; // Default: 7
  };
  
  /** Seniority level (max 10 points) */
  seniority: {
    levels: SeniorityLevel[];
    points: Record<SeniorityLevel, number>;
  };
  
  /** Department (max 5 points) */
  department: {
    preferred: Department[];
    points: number;          // Default: 5
  };
}

export type SeniorityLevel =
  | 'C-Level'      // CEO, CTO, CFO, etc.
  | 'VP'           // Vice President
  | 'Director'     // Director level
  | 'Manager'      // Manager level
  | 'Individual';  // Individual contributor

export type Department =
  | 'Sales'
  | 'Marketing'
  | 'Engineering'
  | 'Product'
  | 'Operations'
  | 'Finance'
  | 'HR'
  | 'Customer Success'
  | 'Other';

/**
 * Engagement scoring rules
 */
export interface EngagementRules {
  /** Email engagement (max 5 points) */
  email: {
    openedPoints: number;    // Default: 1
    clickedPoints: number;   // Default: 2
    repliedPoints: number;   // Default: 5
  };
  
  /** LinkedIn engagement (max 5 points) */
  linkedin: {
    viewedPoints: number;    // Default: 1
    connectedPoints: number; // Default: 3
    repliedPoints: number;   // Default: 5
  };
  
  /** Phone/SMS engagement */
  phone: {
    answeredPoints: number;  // Default: 5
    voicemailPoints: number; // Default: 2
  };
}

// ============================================================================
// LEAD SCORE STORAGE
// ============================================================================

/**
 * Stored lead score in Firestore
 */
export interface StoredLeadScore extends LeadScore {
  id: string;
  leadId: string;
  scoringRulesId: string;
  
  /** Discovery data snapshot (for score explanation) */
  snapshot: {
    companyDomain?: string;
    personEmail?: string;
    discoveredAt: Date;
  };
}

// ============================================================================
// LEAD SCORING REQUEST
// ============================================================================

/**
 * Request to calculate lead score
 */
export interface LeadScoreRequest {
  leadId: string;

  /** Optional: Use specific scoring rules (defaults to active rules) */
  scoringRulesId?: string;
  
  /** Optional: Force rescore (ignore cache) */
  forceRescore?: boolean;
  
  /** Optional: Discovery data (if not already in DB) */
  discoveryData?: {
    company?: DiscoveredCompany;
    person?: DiscoveredPerson;
  };
}

/**
 * Batch scoring request
 */
export interface BatchLeadScoreRequest {
  leadIds: string[];
  scoringRulesId?: string;
  forceRescore?: boolean;
}

// ============================================================================
// LEAD SCORE ANALYTICS
// ============================================================================

/**
 * Aggregated scoring analytics
 */
export interface LeadScoreAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  
  /** Score distribution */
  distribution: {
    gradeA: number;  // Count of A-grade leads
    gradeB: number;
    gradeC: number;
    gradeD: number;
    gradeF: number;
  };
  
  /** Priority distribution */
  priorities: {
    hot: number;
    warm: number;
    cold: number;
  };
  
  /** Average scores by component */
  averageScores: {
    total: number;
    companyFit: number;
    personFit: number;
    intentSignals: number;
    engagement: number;
  };
  
  /** Top intent signals detected */
  topSignals: Array<{
    type: IntentSignalType;
    count: number;
    avgPoints: number;
  }>;
  
  /** Score trends over time */
  trends: Array<{
    date: string;
    avgScore: number;
    count: number;
  }>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Default scoring rules template
 */
export const DEFAULT_SCORING_RULES: Omit<ScoringRules, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
  name: 'Default Scoring Rules',
  description: 'Standard lead scoring configuration',
  isActive: true,
  
  companyRules: {
    industries: {
      preferred: ['saas', 'technology', 'software'],
      acceptable: ['ecommerce', 'fintech', 'healthcare'],
      excluded: [],
      preferredPoints: 15,
      acceptablePoints: 7,
    },
    size: {
      preferred: ['50-200', '200-1000'],
      preferredPoints: 10,
      notPreferredPoints: 3,
    },
    techStack: {
      required: [],
      preferred: ['react', 'node', 'aws', 'stripe'],
      requiredPoints: 10,
      preferredPoints: 5,
    },
    growth: {
      fundingStages: ['Series A', 'Series B', 'Series C'],
      points: 5,
    },
  },
  
  personRules: {
    titles: {
      preferred: ['VP', 'Director', 'Head of', 'Chief'],
      acceptable: ['Manager', 'Lead'],
      excluded: ['Intern', 'Analyst'],
      preferredPoints: 15,
      acceptablePoints: 7,
    },
    seniority: {
      levels: ['C-Level', 'VP', 'Director', 'Manager', 'Individual'],
      points: {
        'C-Level': 10,
        'VP': 8,
        'Director': 6,
        'Manager': 4,
        'Individual': 2,
      },
    },
    department: {
      preferred: ['Sales', 'Marketing', 'Product'],
      points: 5,
    },
  },
  
  intentWeights: {
    hiring: 5,
    funding: 8,
    job_change: 6,
    tech_stack_match: 4,
    expansion: 6,
    press_mention: 3,
    website_update: 2,
    high_growth: 7,
    exec_new: 5,
    product_launch: 4,
  },
  
  engagementRules: {
    email: {
      openedPoints: 1,
      clickedPoints: 2,
      repliedPoints: 5,
    },
    linkedin: {
      viewedPoints: 1,
      connectedPoints: 3,
      repliedPoints: 5,
    },
    phone: {
      answeredPoints: 5,
      voicemailPoints: 2,
    },
  },
};

/**
 * Score grade thresholds
 */
export const SCORE_GRADE_THRESHOLDS = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
  F: 0,
} as const;

/**
 * Priority thresholds
 */
export const PRIORITY_THRESHOLDS = {
  hot: 80,
  warm: 60,
  cold: 0,
} as const;
