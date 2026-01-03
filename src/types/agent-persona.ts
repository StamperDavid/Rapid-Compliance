/**
 * Comprehensive AI Agent Persona Configuration
 * Built from onboarding data, product information, and training sessions
 */

export interface AgentPersona {
  // Core Identity & Expert Role
  agentName: string;
  professionalTitle: string;
  coreMission: string;
  targetKnowledgeDomain: string;
  userExpertiseLevel: string;
  
  // Cognitive & Reasoning Logic
  reasoningFramework: string;
  responseComplexityIndex: number; // 1-10
  uncertaintyHandlingProtocol: string;
  internalThoughtVerification: string;
  
  // Knowledge & RAG Integration
  federatedRAGTags: string[];
  knowledgeSourceHierarchy: string[];
  sourceAuthorityWeighting: string;
  contextRetrievalDepth: number;
  
  // Learning & Adaptation Loops
  feedbackIntegrationStrategy: string;
  dynamicToneRegister: string;
  successfulStrategyMemory: string;
  knowledgeObsolescenceTimer: string;
  
  // Functional & Tactical Execution
  toolAuthorization: ToolAuthorization[];
  mandatoryOutputFormatting: string;
  securityDataFilter: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
}

export interface ToolAuthorization {
  tool: string;
  permissions: 'Read Only' | 'Read/Write' | 'Execute' | 'Execute with Review';
  canExecuteAutonomously: boolean;
  description?: string;
}

/**
 * Maps onboarding data to persona fields
 */
export interface OnboardingToPersonaMapping {
  // Company Info → Core Identity
  companyName: string; // → agentName
  companyDescription: string; // → coreMission
  industry: string; // → targetKnowledgeDomain
  targetCustomer: string; // → userExpertiseLevel
  
  // Products → Knowledge Domain
  products: Array<{
    name: string;
    category: string;
    description: string;
  }>; // → targetKnowledgeDomain + federatedRAGTags
  
  // Brand Voice → Cognitive Logic
  brandVoice: {
    tone: 'professional' | 'friendly' | 'technical' | 'casual';
    formality: 'formal' | 'semi-formal' | 'casual';
    complexity: number; // → responseComplexityIndex
  };
  
  // Sales Process → Reasoning Framework
  salesMethodology: 'challenger' | 'spin' | 'sandler' | 'value-based' | 'consultative';
  
  // Knowledge Sources → RAG Configuration
  knowledgeSources: Array<{
    type: 'document' | 'url' | 'database' | 'api';
    name: string;
    priority: number;
  }>; // → knowledgeSourceHierarchy
  
  // Integrations → Tool Authorization
  integrations: Array<{
    name: string;
    type: 'crm' | 'calendar' | 'email' | 'payment' | 'analytics';
    permissions: string[];
    requiresApproval: boolean;
  }>; // → toolAuthorization
  
  // Security & Compliance
  complianceRequirements: string[]; // → securityDataFilter
  dataRetentionPolicy: string;
}

/**
 * Generator function that creates persona from onboarding data
 */
export function generatePersonaFromOnboarding(
  onboarding: OnboardingToPersonaMapping
): AgentPersona {
  // Map sales methodology to reasoning framework
  const reasoningFrameworkMap = {
    'challenger': 'The Challenger Sale + MEDDPICC',
    'spin': 'SPIN Selling (Situation, Problem, Implication, Need-Payoff)',
    'sandler': 'Sandler Selling System (Pain-Driven Discovery)',
    'value-based': 'Value-Based Selling + ROI Justification',
    'consultative': 'Consultative Selling + Trusted Advisor Approach'
  };

  return {
    // Core Identity
    agentName: `${onboarding.companyName}-AI`,
    professionalTitle: `Senior ${onboarding.industry} Solutions Consultant`,
    coreMission: onboarding.companyDescription,
    targetKnowledgeDomain: `${onboarding.industry}, ${onboarding.products.map(p => p.category).join(', ')}`,
    userExpertiseLevel: onboarding.targetCustomer,
    
    // Cognitive Logic
    reasoningFramework: reasoningFrameworkMap[onboarding.salesMethodology] || 'Consultative Selling',
    responseComplexityIndex: onboarding.brandVoice.complexity,
    uncertaintyHandlingProtocol: `Never speculate. If uncertain, state: "I want to ensure 100% accuracy on this—let me pull the exact information from our knowledge base." Then execute RAG search.`,
    internalThoughtVerification: `Before every response: (1) Does this address a business pain point? (2) Am I creating urgency? (3) Is my tone matching the user's sophistication? (4) Have I qualified the opportunity?`,
    
    // Knowledge & RAG
    federatedRAGTags: [
      `DOMAIN: ${onboarding.industry.toUpperCase().replace(/ /g, '_')}`,
      ...onboarding.products.map(p => `SUB_DOMAIN: ${p.category.toUpperCase().replace(/ /g, '_')}`)
    ],
    knowledgeSourceHierarchy: onboarding.knowledgeSources
      .sort((a, b) => a.priority - b.priority)
      .map((s, i) => `${i + 1}. ${s.name} (${s.type})`),
    sourceAuthorityWeighting: `Prioritize verified customer data and internal documentation. Trust industry reports from reputable sources. Verify competitor data from multiple sources.`,
    contextRetrievalDepth: 3,
    
    // Learning & Adaptation
    feedbackIntegrationStrategy: `On negative feedback: Tag the interaction type, adjust strategy in next turn, log successful pivots for future use.`,
    dynamicToneRegister: `Start ${onboarding.brandVoice.formality}. Mirror user's communication style. Adjust based on sentiment signals.`,
    successfulStrategyMemory: `Log conversation paths that result in qualified opportunities, demos, or trials. Use as templates for similar prospects.`,
    knowledgeObsolescenceTimer: `Industry data: 6 months. Technical specs: Real-time verification. Competitor info: 2 months. Case studies: 12 months.`,
    
    // Tactical Execution
    toolAuthorization: onboarding.integrations.map(integration => ({
      tool: integration.name,
      permissions: integration.permissions.join('/') as 'Read Only' | 'Read/Write' | 'Execute' | 'Execute with Review',
      canExecuteAutonomously: !integration.requiresApproval,
      description: `${integration.type} integration`
    })),
    mandatoryOutputFormatting: `Use bolded key metrics. End significant interactions with a "Recommended Next Step". Use bullet points for lists. Provide concrete examples over abstract descriptions.`,
    securityDataFilter: `NEVER reveal: ${onboarding.complianceRequirements.join(', ')}. Maintain strict compliance with ${onboarding.dataRetentionPolicy}.`,
    
    // Metadata
    createdAt: new Date().toISOString(),
    version: 1
  };
}

