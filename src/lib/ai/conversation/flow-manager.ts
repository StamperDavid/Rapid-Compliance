/**
 * Conversation Flow Manager
 * Handle multi-turn conversations with complex flows
 */

import type { ConversationEntities } from '../nlp/entity-extractor';

export interface ConversationFlow {
  id: string;
  name: string;
  description: string;
  
  // Flow steps
  steps: FlowStep[];
  currentStep: number;
  
  // Completion
  isComplete: boolean;
  completedAt?: string;
  
  // Data collected
  collectedData: Record<string, any>;
}

export interface FlowStep {
  id: string;
  type: 'question' | 'action' | 'branch' | 'end';
  
  // Question
  question?: string;
  requiredInfo?: string; // What information we need
  
  // Action
  action?: string; // Function to call
  actionParams?: Record<string, any>;
  
  // Branch
  condition?: string;
  branches?: Array<{
    condition: string;
    nextStepId: string;
  }>;
  
  // Next
  nextStepId?: string;
  
  // Validation
  validator?: (value: any) => boolean;
}

/**
 * Pre-defined flows
 */
export const CONVERSATION_FLOWS: Record<string, Omit<ConversationFlow, 'id' | 'currentStep' | 'isComplete' | 'collectedData'>> = {
  demo_scheduling: {
    name: 'Demo Scheduling',
    description: 'Schedule a product demo',
    steps: [
      {
        id: 'qualify',
        type: 'question',
        question: 'Great! What industry are you in?',
        requiredInfo: 'industry',
        nextStepId: 'company_size',
      },
      {
        id: 'company_size',
        type: 'question',
        question: 'How many people are on your sales team?',
        requiredInfo: 'teamSize',
        nextStepId: 'check_availability',
      },
      {
        id: 'check_availability',
        type: 'action',
        action: 'checkCalendlyAvailability',
        actionParams: { date: 'this_week' },
        nextStepId: 'book_time',
      },
      {
        id: 'book_time',
        type: 'question',
        question: 'I have Tuesday at 2pm or Thursday at 10am. Which works better?',
        requiredInfo: 'selectedTime',
        nextStepId: 'get_email',
      },
      {
        id: 'get_email',
        type: 'question',
        question: 'Perfect! What email should I send the calendar invite to?',
        requiredInfo: 'email',
        nextStepId: 'book_appointment',
      },
      {
        id: 'book_appointment',
        type: 'action',
        action: 'bookCalendlyAppointment',
        actionParams: {},
        nextStepId: 'end',
      },
      {
        id: 'end',
        type: 'end',
      },
    ],
  },
  
  purchase_flow: {
    name: 'Purchase Flow',
    description: 'Guide customer through purchase',
    steps: [
      {
        id: 'identify_need',
        type: 'question',
        question: 'What are you looking to accomplish with our platform?',
        requiredInfo: 'goal',
        nextStepId: 'recommend_plan',
      },
      {
        id: 'recommend_plan',
        type: 'branch',
        branches: [
          {
            condition: 'goal contains "just ai agent"',
            nextStepId: 'recommend_agent_only',
          },
          {
            condition: 'goal contains "crm"',
            nextStepId: 'recommend_starter',
          },
          {
            condition: 'goal contains "ecommerce" or "workflow"',
            nextStepId: 'recommend_professional',
          },
        ],
        nextStepId: 'recommend_starter', // Default
      },
      {
        id: 'recommend_tier1',
        type: 'question',
        question: 'Based on your needs, Tier 1 at $400/month (0-100 records) with ALL features included is perfect. Does that work?',
        requiredInfo: 'planAccepted',
        nextStepId: 'create_checkout',
      },
      {
        id: 'recommend_tier2',
        type: 'question',
        question: 'Our Tier 2 at $650/month (101-250 records) includes everything - unlimited AI agents, full CRM, automation, and more. Sound good?',
        requiredInfo: 'planAccepted',
        nextStepId: 'create_checkout',
      },
      {
        id: 'recommend_tier3',
        type: 'question',
        question: 'For your scale, Tier 3 at $1,000/month (251-500 records) has the entire platform. Ready to get started?',
        requiredInfo: 'planAccepted',
        nextStepId: 'create_checkout',
      },
      {
        id: 'create_checkout',
        type: 'action',
        action: 'createStripeCheckout',
        nextStepId: 'end',
      },
      {
        id: 'end',
        type: 'end',
      },
    ],
  },
};

/**
 * Start a conversation flow
 */
export function startFlow(flowName: string): ConversationFlow {
  const template = CONVERSATION_FLOWS[flowName];
  
  if (!template) {
    throw new Error(`Flow not found: ${flowName}`);
  }
  
  return {
    id: `flow_${Date.now()}`,
    ...template,
    currentStep: 0,
    isComplete: false,
    collectedData: {},
  };
}

/**
 * Advance flow to next step
 */
export function advanceFlow(
  flow: ConversationFlow,
  userResponse: string,
  entities: ConversationEntities
): {
  flow: ConversationFlow;
  currentStep: FlowStep;
  shouldContinue: boolean;
} {
  const currentStep = flow.steps[flow.currentStep];
  
  // Collect data if this was a question step
  if (currentStep.type === 'question' && currentStep.requiredInfo) {
    flow.collectedData[currentStep.requiredInfo] = userResponse;
  }
  
  // Determine next step
  let nextStepId = currentStep.nextStepId;
  
  if (currentStep.type === 'branch' && currentStep.branches) {
    // Evaluate branches
    for (const branch of currentStep.branches) {
      if (evaluateCondition(branch.condition, userResponse, flow.collectedData)) {
        nextStepId = branch.nextStepId;
        break;
      }
    }
  }
  
  // Find next step index
  const nextStepIndex = flow.steps.findIndex(s => s.id === nextStepId);
  
  if (nextStepIndex === -1 || flow.steps[nextStepIndex].type === 'end') {
    flow.isComplete = true;
    flow.completedAt = new Date().toISOString();
    return {
      flow,
      currentStep: flow.steps[nextStepIndex] || currentStep,
      shouldContinue: false,
    };
  }
  
  flow.currentStep = nextStepIndex;
  
  return {
    flow,
    currentStep: flow.steps[nextStepIndex],
    shouldContinue: true,
  };
}

/**
 * Evaluate branch condition
 */
function evaluateCondition(
  condition: string,
  userResponse: string,
  collectedData: Record<string, any>
): boolean {
  // Simple condition evaluation
  // In production, use a proper expression parser
  
  if (condition.includes('contains')) {
    const [, searchTerm] = condition.split('contains');
    return userResponse.toLowerCase().includes(searchTerm.trim().replace(/"/g, ''));
  }
  
  return false;
}

/**
 * Get current step message
 */
export function getCurrentStepMessage(
  flow: ConversationFlow
): string {
  const step = flow.steps[flow.currentStep];
  
  if (step.type === 'question' && step.question) {
    return step.question;
  }
  
  if (step.type === 'action') {
    return `Let me ${step.action} for you...`;
  }
  
  return '';
}




















