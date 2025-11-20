import { Timestamp } from 'firebase/firestore';
import { EntityFilter } from './entity';

/**
 * AI Agent Configuration
 * Modular, trainable AI agents for different purposes
 */
export interface AIAgent {
  id: string;
  workspaceId: string;
  
  // Basic info
  name: string;
  description?: string;
  icon?: string;
  type: AIAgentType;
  
  // Model configuration
  model: AIModel;
  modelSettings: ModelSettings;
  
  // Behavior
  systemPrompt: string;
  personality: PersonalityConfig;
  
  // Knowledge base
  knowledgeBase: KnowledgeBase;
  
  // Capabilities & Tools
  capabilities: AgentCapabilities;
  
  // Training
  training: TrainingConfig;
  
  // Golden Master (production version)
  goldenMaster?: GoldenMaster;
  
  // Deployment
  deployment: DeploymentConfig;
  
  // Permissions
  permissions: {
    canUse: string[]; // roles
    canTrain: string[];
    canDeploy: string[];
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  status: 'draft' | 'training' | 'active' | 'paused' | 'archived';
  version: number;
}

export type AIAgentType =
  | 'sales'           // Sales conversations, lead qualification
  | 'support'         // Customer support, troubleshooting
  | 'service'         // Service scheduling, recommendations
  | 'data_entry'      // Form assistance, data validation
  | 'assistant'       // General purpose assistant
  | 'analyst'         // Data analysis, insights
  | 'content'         // Content generation
  | 'custom';         // User-defined

/**
 * AI Model Configuration
 */
export interface AIModel {
  provider: 'google' | 'openai' | 'anthropic' | 'custom';
  modelId: string; // e.g., 'gemini-2.5-flash', 'gpt-4-turbo'
  version?: string;
}

export interface ModelSettings {
  temperature: number;      // 0.0 - 2.0
  topP: number;            // 0.0 - 1.0
  topK?: number;           // For Google models
  maxTokens: number;       // Max response length
  stopSequences?: string[];
  presencePenalty?: number; // -2.0 to 2.0
  frequencyPenalty?: number; // -2.0 to 2.0
}

/**
 * Personality Configuration
 */
export interface PersonalityConfig {
  tone: AgentTone;
  verbosity: 'concise' | 'balanced' | 'detailed';
  formality: 'casual' | 'professional' | 'formal';
  
  // Custom traits
  traits?: string[]; // e.g., ["empathetic", "data-driven", "solution-focused"]
  
  // Response style
  useEmojis: boolean;
  useBulletPoints: boolean;
  includeExamples: boolean;
}

export type AgentTone =
  | 'professional'
  | 'friendly'
  | 'enthusiastic'
  | 'empathetic'
  | 'technical'
  | 'consultative'
  | 'custom';

/**
 * Knowledge Base
 */
export interface KnowledgeBase {
  // Documents
  documents: KnowledgeDocument[];
  
  // URLs & Web content
  urls: KnowledgeURL[];
  
  // Entity data (from CRM objects)
  entitySources: EntityKnowledgeSource[];
  
  // Custom text/instructions
  customInstructions?: string;
  
  // Vector search enabled
  vectorSearchEnabled: boolean;
  lastIndexedAt?: Timestamp;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  url: string; // Cloud Storage URL
  type: string; // mime type
  size: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  
  // Processing
  status: 'processing' | 'ready' | 'failed';
  extractedText?: string;
  embeddingId?: string; // Vertex AI Vector Search ID
  chunks?: number; // Number of text chunks
}

export interface KnowledgeURL {
  id: string;
  url: string;
  title?: string;
  description?: string;
  addedAt: Timestamp;
  
  // Scraping
  lastScrapedAt?: Timestamp;
  content?: string;
  embeddingId?: string;
  
  // Auto-refresh
  autoRefresh: boolean;
  refreshFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface EntityKnowledgeSource {
  schemaId: string;
  schemaName: string;
  
  // Which fields to include in knowledge
  includedFields: string[];
  
  // Filters (only include certain records)
  filters?: EntityFilter[];
  
  // How to format for AI
  template?: string; // e.g., "Product: {name}, Price: {price}"
  
  // Real-time sync
  syncEnabled: boolean;
  lastSyncedAt?: Timestamp;
}

/**
 * Agent Capabilities
 */
export interface AgentCapabilities {
  // Search & retrieval
  googleSearch: boolean;
  vectorSearch: boolean;
  
  // CRM operations
  entityCRUD: EntityCRUDPermissions;
  
  // Communication
  sendEmail: boolean;
  sendSMS: boolean;
  sendSlackMessage: boolean;
  
  // Workflows
  triggerWorkflows: boolean;
  allowedWorkflows?: string[]; // Workflow IDs
  
  // External APIs
  callExternalAPIs: boolean;
  allowedAPIs?: string[]; // Integration IDs
  
  // Scheduling
  scheduleAppointments: boolean;
  
  // File handling
  readFiles: boolean;
  createFiles: boolean;
}

export interface EntityCRUDPermissions {
  enabled: boolean;
  
  // Which schemas the agent can access
  allowedSchemas?: string[]; // Schema IDs
  
  // What operations
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  
  // Field-level restrictions
  restrictedFields?: string[]; // Field IDs agent cannot modify
}

/**
 * Training Configuration
 */
export interface TrainingConfig {
  // Training mode
  enabled: boolean;
  
  // Conversation logs
  conversationLogs: TrainingConversation[];
  
  // Evaluation
  evaluations: TrainingEvaluation[];
  
  // Human feedback
  feedbackEnabled: boolean;
  requireApproval: boolean; // Require human approval for responses
  
  // Auto-improvement
  autoLearn: boolean;
  autoLearnThreshold?: number; // Min rating to learn from conversation
}

export interface TrainingConversation {
  id: string;
  agentId: string;
  
  // Conversation
  messages: ConversationMessage[];
  
  // Context
  userId?: string;
  sessionId?: string;
  
  // Evaluation
  rating?: number; // 1-5 stars
  feedback?: string;
  tags?: string[];
  
  // Status
  isGolden: boolean; // Marked as golden example
  includeInTraining: boolean;
  
  // Metadata
  createdAt: Timestamp;
  duration?: number; // seconds
}

export interface ConversationMessage {
  role: 'user' | 'model' | 'system';
  parts: MessagePart[];
  timestamp: Timestamp;
  
  // Metadata
  tokens?: number;
  latency?: number; // milliseconds
  
  // Feedback on individual message
  helpful?: boolean;
  correctedResponse?: string;
}

export interface MessagePart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface TrainingEvaluation {
  id: string;
  conversationId: string;
  
  // Scores
  scores: {
    accuracy: number;        // 0-100
    helpfulness: number;     // 0-100
    professionalism: number; // 0-100
    responseTime: number;    // 0-100
    overall: number;         // 0-100
  };
  
  // Feedback
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  critique?: string;
  
  // Evaluator
  evaluatedBy: string;
  evaluatedAt: Timestamp;
  
  // Decision
  approvedForGolden: boolean;
}

/**
 * Golden Master
 * Production-ready agent version
 */
export interface GoldenMaster {
  version: number;
  
  // Training data
  baseConversations: string[]; // Training conversation IDs
  avgScore: number;
  totalConversations: number;
  
  // Snapshot
  systemPrompt: string;
  personality: PersonalityConfig;
  modelSettings: ModelSettings;
  
  // Performance metrics
  metrics: GoldenMasterMetrics;
  
  // Deployment
  deployedAt: Timestamp;
  deployedBy: string;
  
  // Status
  status: 'active' | 'superseded' | 'rolled_back';
  supersededBy?: number; // Next version number
  rollbackReason?: string;
}

export interface GoldenMasterMetrics {
  // Usage
  totalInteractions: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  
  // Performance
  avgResponseTime: number; // milliseconds
  avgRating: number; // 1-5
  satisfactionRate: number; // % of positive ratings
  
  // Business impact
  conversionsGenerated?: number;
  revenueImpact?: number;
  
  // Period
  periodStart: Timestamp;
  periodEnd: Timestamp;
}

/**
 * Deployment Configuration
 */
export interface DeploymentConfig {
  // Where the agent is available
  channels: DeploymentChannel[];
  
  // Rate limiting
  rateLimit: {
    enabled: boolean;
    maxRequestsPerMinute?: number;
    maxRequestsPerDay?: number;
  };
  
  // Fallback behavior
  fallback: {
    onError: 'retry' | 'human_handoff' | 'canned_response';
    cannedResponse?: string;
    humanHandoffWebhook?: string;
  };
  
  // Guardrails
  guardrails: Guardrails;
  
  // Monitoring
  monitoring: {
    logAllConversations: boolean;
    alertOnLowRating: boolean;
    alertThreshold?: number;
    alertWebhook?: string;
  };
}

export type DeploymentChannel =
  | 'web_chat'        // Embedded chat widget
  | 'api'             // REST API
  | 'slack'           // Slack integration
  | 'whatsapp'        // WhatsApp
  | 'sms'             // SMS
  | 'email'           // Email
  | 'voice'           // Phone/voice
  | 'custom';         // Custom integration

export interface Guardrails {
  // Content filtering
  filterProfanity: boolean;
  filterPII: boolean; // Personally Identifiable Information
  
  // Topic restrictions
  prohibitedTopics: string[];
  allowedTopics?: string[]; // If set, only these topics allowed
  
  // Compliance
  requireDisclosures: boolean;
  disclosureText?: string; // e.g., "I am an AI assistant"
  
  // Data handling
  allowDataCollection: boolean;
  dataRetentionDays?: number;
  
  // Safety
  maxConsecutiveErrors: number; // Before triggering human handoff
  sensitiveFieldsRedaction: string[]; // Field keys to redact in logs
}

/**
 * Agent Analytics
 */
export interface AgentAnalytics {
  agentId: string;
  period: string; // e.g., "2024-03"
  
  // Usage metrics
  usage: {
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    avgConversationsPerUser: number;
    avgMessagesPerConversation: number;
    avgSessionDuration: number; // seconds
  };
  
  // Performance metrics
  performance: {
    avgResponseTime: number; // milliseconds
    avgTokensPerResponse: number;
    totalTokensUsed: number;
    successRate: number; // % of successful responses
    errorRate: number;
  };
  
  // Quality metrics
  quality: {
    avgRating: number; // 1-5
    totalRatings: number;
    ratingDistribution: Record<number, number>; // rating -> count
    thumbsUpRate: number;
    thumbsDownRate: number;
  };
  
  // Business metrics
  business: {
    conversions?: number;
    leadsGenerated?: number;
    ticketsResolved?: number;
    revenueImpact?: number;
  };
  
  // Top topics/intents
  topIntents: {
    intent: string;
    count: number;
    avgRating: number;
  }[];
  
  // Common issues
  commonErrors: {
    error: string;
    count: number;
    lastOccurrence: Timestamp;
  }[];
  
  updatedAt: Timestamp;
}

