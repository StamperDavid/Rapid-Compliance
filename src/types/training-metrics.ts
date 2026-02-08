/**
 * Training Metrics and Scenarios
 * Defines the comprehensive metrics clients can select and track during training
 */

export interface TrainingMetric {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: 'core' | 'advanced' | 'customer' | 'strategic';
}

/**
 * Available Training Metrics (20 options, client picks 5-6)
 */
export const AVAILABLE_TRAINING_METRICS: TrainingMetric[] = [
  // ===== CORE SALES SKILLS =====
  {
    id: 'objection-handling',
    label: 'Objection Handling',
    icon: '🛡️',
    description: 'How well the agent addresses and resolves customer objections',
    category: 'core',
  },
  {
    id: 'product-knowledge',
    label: 'Product Knowledge',
    icon: '📚',
    description: 'Accuracy and depth of product information provided',
    category: 'core',
  },
  {
    id: 'tone-professionalism',
    label: 'Tone & Professionalism',
    icon: '🎭',
    description: 'Appropriate communication style and professional demeanor',
    category: 'core',
  },
  {
    id: 'closing-skills',
    label: 'Closing Skills',
    icon: '🎯',
    description: 'Effectiveness at moving customers toward purchase decisions',
    category: 'core',
  },
  {
    id: 'discovery-questions',
    label: 'Discovery Questions',
    icon: '❓',
    description: 'Quality and relevance of questions asked to understand customer needs',
    category: 'core',
  },
  {
    id: 'empathy-rapport',
    label: 'Empathy & Rapport',
    icon: '🤝',
    description: 'Ability to build trust and connect with customers',
    category: 'core',
  },
  
  // ===== ADVANCED SALES TECHNIQUES =====
  {
    id: 'response-speed',
    label: 'Response Speed',
    icon: '⚡',
    description: 'Timeliness and efficiency of responses',
    category: 'advanced',
  },
  {
    id: 'active-listening',
    label: 'Active Listening',
    icon: '🧠',
    description: 'Demonstration of understanding customer needs and concerns',
    category: 'advanced',
  },
  {
    id: 'value-communication',
    label: 'Value Communication',
    icon: '💰',
    description: 'Clarity in articulating product/service value and ROI',
    category: 'advanced',
  },
  {
    id: 'urgency-creation',
    label: 'Urgency Creation',
    icon: '🔥',
    description: 'Ability to create appropriate sense of urgency without pressure',
    category: 'advanced',
  },
  {
    id: 'storytelling',
    label: 'Storytelling Ability',
    icon: '🎪',
    description: 'Use of examples, case studies, and narratives to illustrate value',
    category: 'advanced',
  },
  {
    id: 'problem-identification',
    label: 'Problem Identification',
    icon: '🤔',
    description: 'Skill at uncovering and articulating customer pain points',
    category: 'advanced',
  },
  
  // ===== CUSTOMER MANAGEMENT =====
  {
    id: 'difficult-customer-handling',
    label: 'Difficult Customer Handling',
    icon: '😡',
    description: 'Patience and de-escalation skills with frustrated customers',
    category: 'customer',
  },
  {
    id: 'needs-assessment',
    label: 'Needs Assessment',
    icon: '📊',
    description: 'Accuracy in identifying what customer truly needs',
    category: 'customer',
  },
  {
    id: 'qualification-accuracy',
    label: 'Qualification Accuracy',
    icon: '🔍',
    description: 'Proper assessment of customer budget, authority, need, and timeline',
    category: 'customer',
  },
  {
    id: 'follow-up-effectiveness',
    label: 'Follow-Up Effectiveness',
    icon: '🚀',
    description: 'Quality of suggested next steps and follow-up timing',
    category: 'customer',
  },
  {
    id: 'customer-satisfaction',
    label: 'Customer Satisfaction',
    icon: '😊',
    description: 'Overall customer experience and satisfaction with interaction',
    category: 'customer',
  },
  {
    id: 'solution-matching',
    label: 'Solution Matching',
    icon: '🧩',
    description: 'Recommending products/services that truly fit customer needs',
    category: 'customer',
  },
  
  // ===== STRATEGIC =====
  {
    id: 'competitive-positioning',
    label: 'Competitive Positioning',
    icon: '🏆',
    description: 'Effectiveness at differentiating from competitors',
    category: 'strategic',
  },
  {
    id: 'upsell-crosssell',
    label: 'Upsell/Cross-sell Ability',
    icon: '📈',
    description: 'Natural and appropriate suggestions for additional value',
    category: 'strategic',
  },
];

/**
 * Training Scenario Types for tracking coverage
 */
export interface ScenarioType {
  id: string;
  label: string;
  icon: string;
  description: string;
  examples: string[];
}

export const SCENARIO_TYPES: ScenarioType[] = [
  {
    id: 'price-objections',
    label: 'Price Objections',
    icon: '💸',
    description: 'Customer concerns about cost and budget',
    examples: ['Too expensive', 'Need a discount', 'Can\'t afford it', 'Competitor is cheaper'],
  },
  {
    id: 'competitor-comparisons',
    label: 'Competitor Comparisons',
    icon: '⚔️',
    description: 'Questions comparing to competitor offerings',
    examples: ['Why not [competitor]?', 'What makes you different?', 'Competitor has feature X'],
  },
  {
    id: 'product-knowledge',
    label: 'Product Knowledge',
    icon: '📦',
    description: 'Technical questions and feature inquiries',
    examples: ['How does it work?', 'What are the specs?', 'Does it have X feature?'],
  },
  {
    id: 'discovery-qualification',
    label: 'Discovery/Qualification',
    icon: '🔎',
    description: 'Uncovering customer needs and qualifying the lead',
    examples: ['What are you looking for?', 'Tell me about your needs', 'Budget qualification'],
  },
  {
    id: 'angry-difficult',
    label: 'Angry/Difficult Customers',
    icon: '😠',
    description: 'Frustrated, upset, or challenging customers',
    examples: ['Complaint handling', 'Refund requests', 'Service failures'],
  },
  {
    id: 'ready-to-buy',
    label: 'Ready-to-Buy',
    icon: '🛒',
    description: 'Closing scenarios with interested customers',
    examples: ['How do I order?', 'What\'s the next step?', 'Ready to purchase'],
  },
  {
    id: 'timing-objections',
    label: 'Timing Objections',
    icon: '⏰',
    description: 'Not ready to buy now, timing concerns',
    examples: ['Call me next month', 'Not ready yet', 'Need more time to think'],
  },
  {
    id: 'authority-objections',
    label: 'Authority Objections',
    icon: '👔',
    description: 'Need approval from decision maker',
    examples: ['Need to ask my boss', 'Not the decision maker', 'Committee decides'],
  },
];

/**
 * Training Session Record
 */
export interface TrainingSession {
  id: string;
  baseModelId: string;

  // Session Info
  startedAt: string;
  completedAt?: string;
  duration?: number; // seconds
  
  // Scenario
  scenarioType?: string; // ID from SCENARIO_TYPES
  scenarioLabel?: string;
  topic?: string; // Free-form topic description
  
  // Conversation
  messages: TrainingMessage[];
  messageCount: number;
  
  // Scoring
  metricScores: Record<string, MetricScore>; // metricId → score
  overallScore: number; // 0-100
  sessionNotes?: string;
  
  // Metadata
  createdBy: string;
  goldenMasterVersion?: string; // If training from a GM
}

export interface TrainingMessage {
  id: string;
  role: 'trainer' | 'agent';
  content: string;
  timestamp: string;
  
  // Feedback on agent messages
  hasFeedback?: boolean;
  feedbackType?: 'correct' | 'could-improve' | 'incorrect';
  feedbackReason?: string;
  betterResponse?: string;
}

export interface MetricScore {
  metricId: string;
  score: number; // 1-10
  explanation: string; // WHY this score - required
  timestamp: string;
}

/**
 * Scenario Coverage Tracking
 */
export interface ScenarioCoverage {
  baseModelId: string;
  coverage: Record<string, number>; // scenarioTypeId → count of sessions
  totalSessions: number;
  coveragePercentage: number; // 0-100
  lastUpdated: string;
}

/**
 * Training Requirements for Golden Master Creation
 */
export interface TrainingRequirements {
  minimumScore: number; // Default: 70
  minimumSessions: number; // Default: 5
  minimumTotalTurns: number; // Default: 30
  minimumScenarioCoverage: number; // Default: 4 different scenario types
  
  // Current progress
  currentScore: number;
  currentSessions: number;
  currentTotalTurns: number;
  currentScenarioCoverage: number;
  
  // Status
  scoreRequirementMet: boolean;
  sessionsRequirementMet: boolean;
  turnsRequirementMet: boolean;
  coverageRequirementMet: boolean;
  allRequirementsMet: boolean;
}








