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

export interface OnboardingData {
  // All 15 steps of data from onboarding wizard
  [key: string]: any;
}

export interface AgentPersona {
  name?: string;
  tone: string;
  greeting: string;
  closingMessage: string;
  objectives: string[];
  escalationRules: string[];
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





