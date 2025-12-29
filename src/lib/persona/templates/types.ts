import type { ResearchIntelligence } from '@/types/scraper-intelligence';
import type { OnboardingData } from '@/types/agent-memory';

/**
 * Mutation Rule
 * 
 * Defines how to modify an IndustryTemplate based on OnboardingData
 * Example: "If Enterprise customer, boost hiring signals by +3"
 */
export interface MutationRule {
  /**
   * Unique identifier for this rule
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what this rule does
   */
  description: string;

  /**
   * Condition function - return true to apply mutations
   * Has access to full onboarding data
   */
  condition: (onboarding: OnboardingData) => boolean;

  /**
   * Mutations to apply when condition is true
   */
  mutations: MutationOperation[];

  /**
   * Priority (lower number = higher priority)
   * Rules are applied in priority order
   */
  priority: number;
}

/**
 * Mutation Operation
 * 
 * Defines a single mutation to apply to the template
 */
export interface MutationOperation {
  /**
   * Path to the value to mutate (using dot notation)
   * Examples:
   * - "coreIdentity.tone"
   * - "research.highValueSignals[funding].scoreBoost"
   */
  path: string;

  /**
   * Operation type
   */
  operation: 'add' | 'subtract' | 'multiply' | 'set' | 'append' | 'prepend';

  /**
   * Value to use in the operation
   */
  value: any;

  /**
   * Optional: Only apply if path exists
   */
  skipIfMissing?: boolean;
}

/**
 * Template with Mutation Rules
 * 
 * Extends IndustryTemplate to include mutation rules
 */
export interface MutableTemplate extends IndustryTemplate {
  /**
   * Mutation rules for this template
   */
  mutationRules?: MutationRule[];
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  coreIdentity: {
    title: string;
    positioning: string;
    tone: string;
  };
  
  cognitiveLogic: {
    framework: string;
    reasoning: string;
    decisionProcess: string;
  };
  
  knowledgeRAG: {
    static: string[];
    dynamic: string[];
  };
  
  learningLoops: {
    patternRecognition: string;
    adaptation: string;
    feedbackIntegration: string;
  };
  
  tacticalExecution: {
    primaryAction: string;
    conversionRhythm: string;
    secondaryActions: string[];
  };

  research?: ResearchIntelligence;
}
