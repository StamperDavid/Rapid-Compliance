/**
 * Fine-Tuning Types
 * For real model training on customer data
 */

import { Timestamp } from 'firebase/firestore';

export interface TrainingExample {
  id: string;
  organizationId: string;
  
  // Conversation
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  
  // Quality metrics
  confidence: number; // 0-100
  userRating?: number; // 1-5 stars
  didConvert?: boolean; // Did this lead to a sale?
  
  // Feedback
  userFeedback?: string;
  humanCorrection?: string; // If a human corrected the response
  
  // Source
  source: 'training_scenario' | 'real_conversation' | 'human_correction' | 'synthetic';
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'used_in_training';
  approvedBy?: string;
  
  // Metadata
  conversationId?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface FineTuningDataset {
  id: string;
  organizationId: string;
  
  // Dataset info
  name: string;
  description: string;
  
  // Examples
  exampleIds: string[];
  exampleCount: number;
  
  // Quality
  avgConfidence: number;
  avgRating: number;
  conversionRate: number; // % that led to sales
  
  // Format
  format: 'openai' | 'vertex' | 'anthropic';
  
  // Status
  status: 'collecting' | 'ready' | 'in_use';
  
  // Storage
  fileUrl?: string; // Cloud Storage URL
  fileSize?: number; // bytes
  
  // Metadata
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface FineTuningJob {
  id: string;
  organizationId: string;
  
  // Configuration
  provider: 'openai' | 'google';
  baseModel: string;
  datasetId: string;
  
  // Hyperparameters
  hyperparameters: {
    epochs?: number;
    batchSize?: number;
    learningRateMultiplier?: number;
  };
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  
  // Provider job ID
  providerJobId?: string;
  
  // Results
  fineTunedModelId?: string;
  metrics?: {
    trainingLoss: number;
    validationLoss: number;
    accuracy?: number;
  };
  
  // Error
  error?: string;
  
  // Cost
  estimatedCost: number;
  actualCost?: number;
  
  // Timestamps
  createdAt: Timestamp | string;
  startedAt?: Timestamp | string;
  completedAt?: Timestamp | string;
}

export interface FineTunedModel {
  id: string;
  organizationId: string;
  
  // Model info
  provider: 'openai' | 'google';
  baseModel: string;
  fineTunedModelId: string; // Provider's model ID
  
  // Training
  trainingJobId: string;
  datasetId: string;
  
  // Performance
  metrics: {
    accuracy: number;
    avgConfidence: number;
    avgResponseTime: number;
    customerSatisfaction?: number;
  };
  
  // A/B Testing
  isActive: boolean;
  trafficPercentage: number; // 0-100
  
  // Comparison to base
  improvementVsBase: number; // percentage
  
  // Usage
  totalRequests: number;
  totalCost: number;
  
  // Metadata
  createdAt: Timestamp | string;
  lastUsedAt?: Timestamp | string;
}

export interface ModelPerformanceComparison {
  organizationId: string;
  
  // Models being compared
  models: Array<{
    id: string;
    name: string;
    type: 'base' | 'fine_tuned';
  }>;
  
  // Time period
  startDate: string;
  endDate: string;
  
  // Metrics
  metrics: Array<{
    modelId: string;
    accuracy: number;
    avgConfidence: number;
    avgResponseTime: number;
    customerSatisfaction: number;
    conversionRate: number;
    cost: number;
  }>;
  
  // Winner
  recommendedModel: string;
  reason: string;
}

export interface ContinuousLearningConfig {
  organizationId: string;
  
  // Auto-collection
  autoCollectTrainingData: boolean;
  minConfidenceForCollection: number; // 0-100
  minRatingForCollection: number; // 1-5
  
  // Auto-training
  autoTriggerFineTuning: boolean;
  minExamplesForTraining: number;
  trainingFrequency: 'weekly' | 'monthly' | 'quarterly';
  
  // Auto-deployment
  autoDeployFineTunedModels: boolean;
  minImprovementForDeploy: number; // percentage
  
  // Budget
  maxMonthlyTrainingCost: number; // USD
  
  // Quality control
  requireHumanApproval: boolean;
  approvers: string[]; // User IDs
  
  // Metadata
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}














