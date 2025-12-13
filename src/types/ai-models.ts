/**
 * AI Model Types
 * Unified types for multiple AI providers
 */

export type AIProvider = 'openai' | 'anthropic' | 'google';

export type ModelName =
  // OpenAI
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  // Anthropic
  | 'claude-3-5-sonnet'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  // Google
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.0-pro';

export interface ModelCapabilities {
  provider: AIProvider;
  name: ModelName;
  displayName: string;
  
  // Capabilities
  maxTokens: number;
  contextWindow: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFineTuning: boolean;
  
  // Performance
  averageResponseTime: number; // milliseconds
  qualityScore: number; // 0-100
  costPerInputToken: number; // USD
  costPerOutputToken: number; // USD
  
  // Use cases
  bestFor: string[];
  
  // Metadata
  releaseDate: string;
  isDeprecated: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string; // For function calls
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: ModelName;
  
  // Optional parameters
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  
  // Function calling
  functions?: AIFunction[];
  functionCall?: 'auto' | 'none' | { name: string };
  
  // Streaming
  stream?: boolean;
  
  // Metadata
  user?: string; // User ID for tracking
}

export interface ChatResponse {
  id: string;
  model: ModelName;
  provider: AIProvider;
  
  // Response
  content: string;
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
  
  // Function calling
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  
  // Usage
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number; // USD
  };
  
  // Metadata
  responseTime: number; // milliseconds
  timestamp: string;
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

/**
 * Confidence Score
 * How confident the AI is in its response
 */
export interface ConfidenceScore {
  overall: number; // 0-100
  
  // Breakdown
  knowledgeCoverage: number; // How much relevant context was found
  modelAgreement: number; // Do multiple models agree?
  semanticConsistency: number; // Does answer match knowledge?
  historicalAccuracy: number; // Has model been right about similar questions?
  
  // Reasoning
  reasoning: string;
  shouldEscalate: boolean; // Should we get a human?
}

/**
 * Reasoning Step
 * For chain-of-thought reasoning
 */
export interface ReasoningStep {
  step: number;
  type: 'understanding' | 'analysis' | 'retrieval' | 'synthesis' | 'verification';
  description: string;
  input: string;
  output: string;
  confidence: number;
  duration: number; // milliseconds
}

/**
 * Model Response with Reasoning
 */
export interface IntelligentResponse {
  // Final answer
  answer: string;
  
  // Intelligence metadata
  confidence: ConfidenceScore;
  reasoning: ReasoningStep[];
  
  // Model info
  model: ModelName;
  provider: AIProvider;
  
  // Alternative responses (if using ensemble)
  alternatives?: Array<{
    model: ModelName;
    response: string;
    confidence: number;
  }>;
  
  // Corrections (if self-corrected)
  corrections?: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  
  // Usage
  usage: {
    totalTokens: number;
    totalCost: number;
    responseTime: number;
  };
}

/**
 * Fine-Tuning Configuration
 */
export interface FineTuningConfig {
  provider: AIProvider;
  baseModel: ModelName;
  organizationId: string;
  
  // Training data
  trainingDataPath: string;
  validationDataPath?: string;
  
  // Hyperparameters
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  
  // Metadata
  name: string;
  description: string;
}

export interface FineTuningJob {
  id: string;
  config: FineTuningConfig;
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  
  // Results
  fineTunedModel?: string;
  metrics?: {
    trainingLoss: number;
    validationLoss: number;
    accuracy: number;
  };
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Cost
  estimatedCost: number;
  actualCost?: number;
}

/**
 * Model Selection Strategy
 */
export type ModelSelectionStrategy =
  | 'fastest' // Prioritize speed
  | 'cheapest' // Prioritize cost
  | 'best-quality' // Prioritize accuracy
  | 'balanced' // Balance speed/cost/quality
  | 'ensemble' // Use multiple models
  | 'adaptive'; // Learn which model works best

/**
 * Model Configuration for Organization
 */
export interface OrganizationModelConfig {
  organizationId: string;
  
  // Primary model
  primaryModel: ModelName;
  
  // Fallback models (in order of preference)
  fallbackModels: ModelName[];
  
  // Strategy
  selectionStrategy: ModelSelectionStrategy;
  
  // Ensemble settings (if using ensemble)
  ensembleConfig?: {
    models: ModelName[];
    votingStrategy: 'majority' | 'weighted' | 'confidence';
    minAgreement: number; // 0-100, minimum % of models that must agree
  };
  
  // Fine-tuned models
  fineTunedModels: Array<{
    baseModel: ModelName;
    fineTunedId: string;
    useForProduction: boolean;
  }>;
  
  // Budget & limits
  budgetLimits?: {
    dailyBudget: number; // USD
    monthlyBudget: number; // USD
    maxCostPerRequest: number; // USD
  };
  
  // Performance requirements
  performanceRequirements?: {
    maxResponseTime: number; // milliseconds
    minConfidence: number; // 0-100
    requireSelfCorrection: boolean;
  };
}

/**
 * Model capabilities database
 */
export const MODEL_CAPABILITIES: Record<ModelName, ModelCapabilities> = {
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 3000,
    qualityScore: 95,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00003,
    bestFor: ['Complex reasoning', 'Code generation', 'Creative writing'],
    releaseDate: '2023-11-06',
    isDeprecated: false,
  },
  'gpt-4': {
    provider: 'openai',
    name: 'gpt-4',
    displayName: 'GPT-4',
    maxTokens: 8192,
    contextWindow: 8192,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsFineTuning: true,
    averageResponseTime: 4000,
    qualityScore: 93,
    costPerInputToken: 0.00003,
    costPerOutputToken: 0.00006,
    bestFor: ['Complex reasoning', 'Analysis', 'Problem solving'],
    releaseDate: '2023-03-14',
    isDeprecated: false,
  },
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    name: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 2500,
    qualityScore: 96,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    bestFor: ['Analysis', 'Writing', 'Reasoning', 'Coding'],
    releaseDate: '2024-06-20',
    isDeprecated: false,
  },
  'claude-3-opus': {
    provider: 'anthropic',
    name: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 3500,
    qualityScore: 97,
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    bestFor: ['Complex tasks', 'Highest quality', 'Critical decisions'],
    releaseDate: '2024-03-04',
    isDeprecated: false,
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    name: 'claude-3-sonnet',
    displayName: 'Claude 3 Sonnet',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 2000,
    qualityScore: 90,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    bestFor: ['Balanced performance', 'General use', 'Cost-effective'],
    releaseDate: '2024-03-04',
    isDeprecated: false,
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    name: 'claude-3-haiku',
    displayName: 'Claude 3 Haiku',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 800,
    qualityScore: 85,
    costPerInputToken: 0.00000025,
    costPerOutputToken: 0.00000125,
    bestFor: ['Speed', 'Low cost', 'Simple tasks'],
    releaseDate: '2024-03-04',
    isDeprecated: false,
  },
  'gemini-1.5-pro': {
    provider: 'google',
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: true,
    averageResponseTime: 2800,
    qualityScore: 92,
    costPerInputToken: 0.00000125,
    costPerOutputToken: 0.00000375,
    bestFor: ['Long context', 'Multimodal', 'Analysis'],
    releaseDate: '2024-02-15',
    isDeprecated: false,
  },
  'gemini-1.5-flash': {
    provider: 'google',
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsFineTuning: false,
    averageResponseTime: 1200,
    qualityScore: 87,
    costPerInputToken: 0.000000125,
    costPerOutputToken: 0.000000375,
    bestFor: ['Speed', 'Cost-effective', 'High volume'],
    releaseDate: '2024-05-14',
    isDeprecated: false,
  },
  'gemini-1.0-pro': {
    provider: 'google',
    name: 'gemini-1.0-pro',
    displayName: 'Gemini 1.0 Pro',
    maxTokens: 8192,
    contextWindow: 32000,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsFineTuning: true,
    averageResponseTime: 2000,
    qualityScore: 88,
    costPerInputToken: 0.000000125,
    costPerOutputToken: 0.000000375,
    bestFor: ['General use', 'Cost-effective'],
    releaseDate: '2023-12-06',
    isDeprecated: false,
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 4096,
    contextWindow: 16385,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsFineTuning: true,
    averageResponseTime: 1500,
    qualityScore: 82,
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.0000015,
    bestFor: ['Simple tasks', 'High volume', 'Low cost'],
    releaseDate: '2023-03-01',
    isDeprecated: false,
  },
};














