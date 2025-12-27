/**
 * Customer Memory Schema
 * 
 * This defines how we store customer interactions and history
 * separate from the Golden Master agent template.
 * 
 * Each customer gets a persistent memory record that any agent
 * instance can load to provide continuity across sessions.
 */

export interface CustomerMemory {
  // Identity
  customerId: string;
  orgId: string;
  email?: string;
  phone?: string;
  name?: string;
  
  // Session History
  sessions: CustomerSession[];
  
  // Conversation History (all messages across all sessions)
  conversationHistory: ConversationMessage[];
  
  // Learned Preferences
  preferences: CustomerPreferences;
  
  // Purchase History
  purchaseHistory: Purchase[];
  
  // Lead Information
  leadInfo: LeadInfo;
  
  // Agent Notes (insights the agent has learned)
  agentNotes: AgentNote[];
  
  // Context Flags (important status indicators)
  contextFlags: ContextFlags;
  
  // Metadata
  firstSeen: string; // ISO timestamp
  lastInteraction: string; // ISO timestamp
  totalInteractions: number;
  lifetimeValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  sessionId: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  duration?: number; // seconds
  goldenMasterVersion: string; // e.g., "v3", "v4"
  messageCount: number;
  outcome: 'sale' | 'qualified_lead' | 'support_resolved' | 'escalated' | 'abandoned' | 'ongoing';
  outcomeDetails?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1.0 to 1.0
  flaggedForTraining: boolean;
  trainingReason?: string;
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
  };
}

export interface ConversationMessage {
  messageId: string;
  sessionId: string;
  timestamp: string; // ISO timestamp
  role: 'customer' | 'agent' | 'human_agent';
  content: string;
  metadata?: {
    intent?: string; // detected customer intent
    entities?: Record<string, any>; // extracted entities (product names, prices, etc.)
    sentiment?: number;
    confidence?: number;
  };
}

export interface CustomerPreferences {
  // Shopping Behavior
  budget?: 'low' | 'medium' | 'high' | 'luxury';
  priceRange?: { min: number; max: number };
  
  // Product Interests
  interests: string[]; // ["camping", "hiking", "winter gear"]
  favoriteProducts: string[]; // Product IDs
  viewedProducts: string[]; // Product IDs
  
  // Communication Style
  preferredTone?: 'brief' | 'detailed' | 'technical';
  responseSpeed?: 'fast' | 'thorough';
  
  // Buying Patterns
  typicalPurchaseFrequency?: string; // "monthly", "seasonal", etc.
  averageOrderValue?: number;
  preferredPaymentMethod?: string;
  
  // Special Needs
  sensitiveTopics?: string[]; // Topics to avoid
  specialRequirements?: string[]; // Accessibility, delivery preferences, etc.
}

export interface Purchase {
  orderId: string;
  orderDate: string; // ISO timestamp
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'completed' | 'refunded' | 'cancelled';
  paymentMethod: string;
  shippingAddress?: Address;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface LeadInfo {
  status: 'cold' | 'warm' | 'hot' | 'qualified' | 'customer' | 'churned';
  source: string; // "website", "referral", "ad", etc.
  qualificationScore: number; // 0-100
  qualificationCriteria: {
    hasBudget: boolean;
    hasNeed: boolean;
    hasTimeline: boolean;
    isDecisionMaker: boolean;
  };
  nextFollowUp?: string; // ISO timestamp
  followUpReason?: string;
  assignedTo?: string; // Human agent ID if escalated
}

export interface AgentNote {
  noteId: string;
  sessionId: string;
  timestamp: string; // ISO timestamp
  category: 'preference' | 'objection' | 'insight' | 'warning' | 'opportunity';
  content: string;
  confidence: number; // 0-1, how confident is this insight
  
  // Examples:
  // { category: 'preference', content: 'Prefers detailed technical explanations' }
  // { category: 'objection', content: 'Concerned about shipping time to Alaska' }
  // { category: 'insight', content: 'Buying for entire family - upsell opportunity' }
  // { category: 'warning', content: 'Frustrated with previous support experience' }
  // { category: 'opportunity', content: 'Planning large camping trip in June - follow up in May' }
}

export interface ContextFlags {
  // Active Status
  hasActiveCart: boolean;
  cartValue?: number;
  cartAbandoned?: boolean;
  
  // Support Status
  hasOpenTicket: boolean;
  ticketId?: string;
  waitingOnRefund: boolean;
  
  // Account Status
  isVIP: boolean;
  hasComplaint: boolean;
  isBlacklisted: boolean;
  
  // Behavior Flags
  isPriceShoppers: boolean; // Frequently compares prices
  isResearcher: boolean; // Asks many questions before buying
  isBulkBuyer: boolean;
  isImpulseBuyer: boolean;
  
  // Risk Flags
  hasReturnedMultipleItems: boolean;
  hasDisputedCharges: boolean;
  requiresHumanApproval: boolean; // For large orders or special cases
}

/**
 * Agent Instance
 * 
 * Ephemeral instance spawned from Golden Master for each customer session.
 * Lives only for the duration of one customer interaction.
 */
export interface AgentInstance {
  instanceId: string;
  sessionId: string;
  customerId: string;
  orgId: string;
  
  // Configuration
  goldenMasterId: string;
  goldenMasterVersion: string;
  
  // Loaded Data
  systemPrompt: string; // From Golden Master
  knowledgeBase: string[]; // References to knowledge docs
  customerMemory: CustomerMemory; // Loaded at spawn
  
  // State
  status: 'initializing' | 'active' | 'idle' | 'escalated' | 'terminated';
  spawnedAt: string; // ISO timestamp
  terminatedAt?: string; // ISO timestamp
  currentContext: ConversationMessage[]; // Current session messages
  
  // Monitoring
  messageCount: number;
  lastActivityAt: string; // ISO timestamp
  escalationTriggered: boolean;
  escalationReason?: string;
  humanTookOver: boolean;
  humanAgentId?: string;
}

/**
 * Base Model
 * 
 * The working draft of the AI agent created from onboarding.
 * This is editable and used for training. NOT a Golden Master yet.
 * Client trains and refines this until satisfied, then saves as Golden Master.
 */
export interface BaseModel {
  id: string;
  orgId: string;
  status: 'draft' | 'training' | 'ready';
  
  // Core Configuration (editable - from onboarding + persona)
  businessContext: OnboardingData;
  agentPersona: AgentPersona;
  behaviorConfig: BehaviorConfig;
  
  // Knowledge Base (editable)
  knowledgeBase: KnowledgeBase;
  
  // Compiled System Prompt (regenerated when config changes)
  systemPrompt: string;
  
  // Training Progress (not a Golden Master yet)
  trainingScenarios: string[]; // IDs of completed training scenarios
  trainingScore: number; // 0-100, average across all training
  lastTrainingAt?: string; // ISO timestamp
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  notes?: string;
}

/**
 * Golden Master
 * 
 * Versioned snapshot of a trained Base Model.
 * Created manually by client when they're satisfied with agent performance.
 * Never modified during customer sessions - only updated by creating new versions.
 */
export interface GoldenMaster {
  id: string;
  version: string; // "v1", "v2", "v3", etc.
  orgId: string;
  baseModelId: string; // Reference to the Base Model this was created from
  
  // Core Configuration (snapshot from Base Model at time of saving)
  businessContext: OnboardingData;
  agentPersona: AgentPersona;
  behaviorConfig: BehaviorConfig;
  
  // Knowledge Base (snapshot)
  knowledgeBase: KnowledgeBase;
  
  // Compiled System Prompt (snapshot)
  systemPrompt: string;
  
  // Training Results (snapshot)
  trainedScenarios: string[]; // IDs of completed training scenarios
  trainingCompletedAt: string; // ISO timestamp when client finished training
  trainingScore: number; // 0-100, final score when saved
  
  // Deployment Status
  isActive: boolean; // Is this the live deployed version?
  deployedAt?: string; // ISO timestamp when deployed to production
  
  // Metadata
  createdBy: string; // User ID who saved this Golden Master
  createdAt: string; // When this version was created
  notes?: string;
  
  // Versioning
  previousVersion?: string; // "v2" if this is "v3"
  changesSummary?: string; // What changed from previous version
}

/**
 * Onboarding Data - Comprehensive business context collected during onboarding
 * Expanded to 20-25 steps including sales methodology
 */
export interface OnboardingData {
  // ===== BUSINESS BASICS (Step 1-3) =====
  businessName: string;
  industry: string;
  website?: string;
  
  // ===== VALUE PROPOSITION (Step 4-5) =====
  problemSolved: string;
  uniqueValue: string;
  targetCustomer: string;
  
  // ===== PRODUCTS & SERVICES (Step 6) =====
  topProducts: string; // Description of main offerings
  
  // ===== PRICING (Step 7) =====
  priceRange?: string;
  discountPolicy?: string;
  
  // ===== SALES PROCESS (Step 8) =====
  typicalSalesFlow?: string;
  
  // ===== DISCOVERY (Step 9) =====
  discoveryQuestions?: string;
  
  // ===== OBJECTIONS (Step 10) =====
  commonObjections?: string;
  priceObjections?: string;
  
  // ===== POLICIES (Step 11-12) =====
  returnPolicy?: string;
  warrantyTerms?: string;
  satisfactionGuarantee?: string;
  
  // ===== COMPLIANCE (Step 13) =====
  requiredDisclosures?: string;
  prohibitedTopics?: string;
  
  // ===== COMPETITORS (Step 14) =====
  competitors?: string[];
  competitiveAdvantages?: string;
  
  // ===== KNOWLEDGE BASE (Step 15) =====
  websiteUrls?: string[];
  faqUrl?: string;
  
  // ===== AGENT IDENTITY (Step 16) =====
  agentName?: string;
  communicationStyle?: string; // 'professional', 'friendly', 'consultative', etc.
  greetingMessage?: string;
  closingMessage?: string;
  personalityTraits?: string[];
  
  // ===== BEHAVIOR (Step 17) =====
  closingStyle?: number; // 1-10 aggressiveness
  discoveryDepth?: number; // 1-7 questions before recommendation
  responseLength?: 'concise' | 'balanced' | 'detailed';
  proactivityLevel?: number; // 1-10
  maxDiscount?: number; // Max discount agent can offer
  idleTimeoutMinutes?: number; // Organization-level setting
  
  // ===== ESCALATION (Step 18) =====
  escalationRules?: string[];
  
  // ===== NEW: OBJECTION HANDLING STRATEGIES (Step 19) =====
  objectionHandling?: {
    priceObjectionStrategy?: string;
    competitorObjectionStrategy?: string;
    timingObjectionStrategy?: string;
    authorityObjectionStrategy?: string;
    needObjectionStrategy?: string;
  };
  
  // ===== NEW: CUSTOMER SENTIMENT ANALYSIS (Step 20) =====
  customerSentimentHandling?: {
    angryCustomerApproach?: string;
    confusedCustomerApproach?: string;
    readyToBuySignals?: string[];
    disengagementSignals?: string[];
    frustratedCustomerApproach?: string;
  };
  
  // ===== NEW: DISCOVERY QUESTION FRAMEWORKS (Step 21) =====
  discoveryFrameworks?: {
    budgetQualificationQuestions?: string[];
    timelineQuestions?: string[];
    authorityQuestions?: string[];
    needIdentificationQuestions?: string[];
    painPointQuestions?: string[];
  };
  
  // ===== NEW: CLOSING TECHNIQUES (Step 22) =====
  closingTechniques?: {
    assumptiveCloseConditions?: string[];
    urgencyCreationTactics?: string[];
    trialCloseTriggers?: string[];
    softCloseApproaches?: string[];
  };
  
  // ===== NEW: RULES & RESTRICTIONS (Step 23) =====
  agentRules?: {
    prohibitedBehaviors?: string[]; // "No sports talk", "No political opinions", etc.
    behavioralBoundaries?: string[];
    mustAlwaysMention?: string[]; // Things agent should always bring up
    neverMention?: string[]; // Things to avoid
  };
  
  // ===== NEW: TRAINING METRICS SELECTION (Step 24) =====
  selectedTrainingMetrics?: string[]; // IDs of metrics client wants to focus on
  
  // ===== NEW: SALES MATERIALS UPLOAD (Step 25) =====
  uploadedSalesMaterials?: {
    id: string;
    filename: string;
    type: 'pdf' | 'document';
    uploadedAt: string;
    extractedMethodology?: SalesMethodology;
  }[];
  
  // ===== METADATA =====
  completedAt?: string;
  completedBy?: string;
  version?: string; // Onboarding form version
  
  // Allow additional properties from form data
  [key: string]: any;
}

/**
 * Sales Methodology extracted from uploaded books/documents
 * (NEPQ, SPIN Selling, Challenger Sale, etc.)
 */
export interface SalesMethodology {
  methodologyName: string; // "NEPQ", "SPIN Selling", etc.
  coreFramework: string; // Summary of the methodology
  discoveryApproach: string; // How to conduct discovery
  objectionHandlingPrinciples: string[];
  closingPhilosophy: string;
  keyQuestions: string[]; // Strategic questions from the methodology
  dosList: string[]; // Best practices
  dontsList: string[]; // Things to avoid
  applicableScenarios: string[]; // When to use this methodology
}

/**
 * Agent Persona - Comprehensive sales agent personality and capabilities
 * Expanded to 50+ fields across sales methodology categories
 */
export interface AgentPersona {
  // ===== BASIC IDENTITY =====
  name?: string;
  tone: string; // 'professional', 'friendly', 'consultative', etc.
  greeting: string;
  closingMessage: string;
  personalityTraits?: string[]; // ['empathetic', 'analytical', 'enthusiastic']
  
  // ===== CORE OBJECTIVES =====
  objectives: string[]; // Primary sales goals
  
  // ===== ESCALATION =====
  escalationRules: string[];
  escalationTriggers?: {
    customerAngerLevel?: number; // 1-10, when to escalate
    complexityThreshold?: string; // Types of questions to escalate
    priceNegotiationLimit?: number; // Above this amount, escalate
  };
  
  // ===== OBJECTION HANDLING STRATEGIES =====
  objectionHandling?: {
    priceObjectionStrategy?: string;
    competitorObjectionStrategy?: string;
    timingObjectionStrategy?: string;
    authorityObjectionStrategy?: string;
    needObjectionStrategy?: string;
    
    // Training adjustable fields
    emphasizeOnPriceObjection?: 'roi' | 'features' | 'testimonials' | 'guarantee';
    competitorComparisonApproach?: 'feature-based' | 'value-based' | 'complement-not-compete';
  };
  
  // ===== CUSTOMER SENTIMENT ANALYSIS =====
  sentimentHandling?: {
    angryCustomerApproach?: string;
    confusedCustomerApproach?: string;
    readyToBuySignals?: string[]; // What to look for
    disengagementSignals?: string[]; // Warning signs
    frustratedCustomerApproach?: string;
    
    // Training adjustable fields
    empathyLevel?: number; // 1-10, how empathetic to be
    patienceLevel?: number; // 1-10, how patient with repeated questions
    reassuranceFrequency?: 'low' | 'medium' | 'high';
  };
  
  // ===== DISCOVERY QUESTION FRAMEWORKS =====
  discoveryFrameworks?: {
    budgetQualificationQuestions?: string[];
    timelineQuestions?: string[];
    authorityQuestions?: string[];
    needIdentificationQuestions?: string[];
    painPointQuestions?: string[];
    
    // Training adjustable fields
    questionsBeforeRecommendation?: number; // How many discovery questions to ask
    discoveryDepth?: 'surface' | 'moderate' | 'deep';
    questioningStyle?: 'direct' | 'consultative' | 'socratic';
  };
  
  // ===== CLOSING TECHNIQUES =====
  closingTechniques?: {
    assumptiveCloseConditions?: string[];
    urgencyCreationTactics?: string[];
    trialCloseTriggers?: string[];
    softCloseApproaches?: string[];
    
    // Training adjustable fields
    closingAggressiveness?: number; // 1-10
    urgencyEmphasis?: 'none' | 'subtle' | 'moderate' | 'strong';
    closeAttemptFrequency?: 'once' | 'multiple' | 'persistent';
    closingLanguageStyle?: 'assumptive' | 'consultative' | 'direct';
  };
  
  // ===== PRODUCT KNOWLEDGE & RECOMMENDATIONS =====
  productKnowledge?: {
    emphasisOnFeatures?: boolean;
    emphasisOnBenefits?: boolean;
    emphasisOnROI?: boolean;
    technicalDepth?: 'basic' | 'intermediate' | 'expert';
    
    // Training adjustable fields
    whenToRecommendProducts?: 'early' | 'after-discovery' | 'when-asked';
    upsellThreshold?: number; // How confident before suggesting upgrades
    crossSellEnabled?: boolean;
  };
  
  // ===== COMMUNICATION STYLE =====
  communicationStyle?: {
    responseLength?: 'concise' | 'balanced' | 'detailed';
    formalityLevel?: number; // 1-10
    humorLevel?: 'none' | 'subtle' | 'moderate';
    storytellingFrequency?: 'never' | 'occasional' | 'frequent';
    technicalJargonUsage?: 'avoid' | 'when-appropriate' | 'freely';
    
    // Training adjustable fields
    activeListeningSignals?: string[]; // Phrases that show listening
    summaryFrequency?: 'never' | 'occasionally' | 'frequently';
    clarificationThreshold?: number; // How often to ask for clarification
  };
  
  // ===== VALUE COMMUNICATION =====
  valuePresentation?: {
    primaryValueDrivers?: string[]; // What to emphasize
    roiCalculationApproach?: string;
    testimonialUsage?: 'never' | 'when-relevant' | 'frequently';
    caseStudyUsage?: 'never' | 'when-relevant' | 'frequently';
    guaranteeEmphasis?: 'subtle' | 'moderate' | 'prominent';
    
    // Training adjustable fields
    valuePropositionTiming?: 'early' | 'mid-conversation' | 'during-objections';
  };
  
  // ===== COMPETITIVE POSITIONING =====
  competitiveStrategy?: {
    competitorMentionApproach?: 'acknowledge-redirect' | 'direct-comparison' | 'feature-focus';
    differentiationEmphasis?: string[]; // What makes you different
    competitorWeaknesses?: Record<string, string>; // Competitor name → their weakness
    
    // Training adjustable fields
    competitiveStanceAggressiveness?: number; // 1-10
  };
  
  // ===== PROACTIVE BEHAVIOR =====
  proactiveBehavior?: {
    proactivityLevel?: number; // 1-10
    followUpSuggestionTiming?: 'immediate' | 'after-delay' | 'end-of-conversation';
    resourceSharingFrequency?: 'never' | 'when-asked' | 'proactively';
    nextStepSuggestions?: boolean; // Suggest next steps?
  };
  
  // ===== RULES & BOUNDARIES =====
  rules?: {
    prohibitedBehaviors?: string[];
    behavioralBoundaries?: string[];
    mustAlwaysMention?: string[];
    neverMention?: string[];
    complianceRequirements?: string[];
  };
  
  // ===== TRAINING-SPECIFIC METADATA =====
  trainingAdjustments?: {
    lastAdjustedAt?: string;
    adjustmentHistory?: {
      field: string;
      oldValue: any;
      newValue: any;
      reason: string;
      timestamp: string;
    }[];
  };
  
  // ===== APPLIED METHODOLOGIES =====
  appliedMethodologies?: SalesMethodology[]; // From uploaded sales books
}

export interface KnowledgeBase {
  documents: KnowledgeDocument[];
  urls: KnowledgeURL[];
  faqs: FAQ[];
  productCatalog?: ProductCatalog;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  type: 'pdf' | 'excel' | 'word' | 'image' | 'text';
  uploadedAt: string;
  processedAt?: string;
  extractedContent: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeURL {
  id: string;
  url: string;
  addedAt: string;
  scrapedAt?: string;
  extractedContent: string;
  title?: string;
  lastUpdated?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  keywords: string[];
}

export interface ProductCatalog {
  products: Product[];
  categories: Category[];
  lastSynced?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  inStock: boolean;
  stockLevel?: number;
  variants?: ProductVariant[];
  specifications?: Record<string, any>;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  attributes: Record<string, string>; // { size: 'Large', color: 'Blue' }
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  productCount: number;
}

export interface BehaviorConfig {
  closingAggressiveness: number; // 1-10
  questionFrequency: number; // 1-7
  responseLength: 'concise' | 'balanced' | 'detailed';
  proactiveLevel: number; // 1-10
  maxMessagesBeforeEscalation?: number;
  idleTimeoutMinutes: number;
}

/**
 * Instance Lifecycle Service
 */
export interface InstanceLifecycleService {
  // Spawn new instance
  spawnInstance(customerId: string, orgId: string): Promise<AgentInstance>;
  
  // Load customer memory into instance
  loadCustomerMemory(instanceId: string, customerId: string): Promise<void>;
  
  // Update customer memory during session
  updateCustomerMemory(instanceId: string, updates: Partial<CustomerMemory>): Promise<void>;
  
  // Terminate instance and save final state
  terminateInstance(instanceId: string, outcome: CustomerSession['outcome']): Promise<void>;
  
  // Monitor instance health
  checkInstanceHealth(instanceId: string): Promise<'healthy' | 'idle' | 'unresponsive'>;
  
  // Handle escalation
  escalateToHuman(instanceId: string, reason: string): Promise<void>;
}





