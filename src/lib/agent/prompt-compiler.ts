/**
 * System Prompt Compiler
 * Compiles the final system prompt from all components
 *
 * Security: Includes organization isolation headers to enforce data boundaries.
 * All prompts are wrapped with organization context to prevent cross-organization access.
 */

import type {
  AgentPersona,
  KnowledgeBase,
  BehaviorConfig
} from '@/types/agent-memory';
import { buildClientAgentContext } from '@/lib/ai/context-wrapper';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/** Business context fields used in prompt generation */
export interface BusinessContextFields {
  businessName?: string;
  industry?: string;
  problemSolved?: string;
  uniqueValue?: string;
  targetCustomer?: string;
  topProducts?: string;
  primaryOffering?: string;
  productComparison?: string;
  seasonalOfferings?: string;
  pricingStrategy?: string;
  discountPolicy?: string;
  volumeDiscounts?: string;
  firstTimeBuyerIncentive?: string;
  financingOptions?: string;
  returnPolicy?: string;
  warrantyTerms?: string;
  cancellationPolicy?: string;
  satisfactionGuarantee?: string;
  geographicCoverage?: string;
  deliveryTimeframes?: string;
  typicalSalesFlow?: string;
  qualificationCriteria?: string;
  discoveryQuestions?: string;
  closingStrategy?: string;
  commonObjections?: string;
  priceObjections?: string;
  timeObjections?: string;
  competitorObjections?: string;
  supportScope?: string;
  technicalSupport?: string;
  orderTracking?: string;
  complaintResolution?: string;
  requiredDisclosures?: string;
  prohibitedTopics?: string;
  industryRegulations?: string;
}

/** Organization isolation context for data security */
export interface IsolationContext {
  /** Organization name */
  orgName: string;
  /** Industry type */
  industry?: string;
}

export interface PromptComponents {
  businessContext: BusinessContextFields;
  agentPersona: AgentPersona;
  behaviorConfig: BehaviorConfig;
  knowledgeBase: KnowledgeBase;
  /** Optional isolation context (required for production) */
  isolationContext?: IsolationContext;
}

/**
 * Compile system prompt from all components
 *
 * SECURITY: Prepends organization isolation header to enforce data boundaries.
 */
export function compileSystemPrompt(
  components: PromptComponents
): string {
  const { businessContext, agentPersona, behaviorConfig, knowledgeBase, isolationContext } = components;

  // Extract business context strings to avoid empty strings in prompt (Explicit Ternary for STRINGS)
  const businessName = (businessContext.businessName !== '' && businessContext.businessName != null) ? businessContext.businessName : 'the company';
  const industry = (businessContext.industry !== '' && businessContext.industry != null) ? businessContext.industry : 'General';
  const problemSolved = (businessContext.problemSolved !== '' && businessContext.problemSolved != null) ? businessContext.problemSolved : 'We provide products and services';
  const uniqueValue = (businessContext.uniqueValue !== '' && businessContext.uniqueValue != null) ? businessContext.uniqueValue : 'Our commitment to quality';
  const targetCustomer = (businessContext.targetCustomer !== '' && businessContext.targetCustomer != null) ? businessContext.targetCustomer : 'Anyone who needs our services';

  // Build isolation header (CRITICAL FOR SECURITY)
  let isolationHeader = '';
  if (isolationContext) {
    isolationHeader = buildClientAgentContext(
      DEFAULT_ORG_ID,
      isolationContext.orgName,
      isolationContext.industry ?? industry,
      agentPersona.name ?? 'AI Assistant'
    );
  }

  let prompt = `${isolationHeader}You are an AI sales and customer service agent for ${businessName}.

# Your Role & Objectives
${agentPersona.objectives.map(obj => `- ${obj}`).join('\n')}

# Business Context
Industry: ${industry}
What we do: ${problemSolved}
What makes us unique: ${uniqueValue}
Target Customer: ${targetCustomer}

# Products/Services
${businessContext.topProducts ? `Top Products:\n${businessContext.topProducts}` : ''}
${businessContext.primaryOffering ? `Primary Offering: ${businessContext.primaryOffering}` : ''}
${businessContext.productComparison ? `Product Comparison:\n${businessContext.productComparison}` : ''}
${businessContext.seasonalOfferings ? `Seasonal Offerings:\n${businessContext.seasonalOfferings}` : ''}

# Pricing Strategy
${(businessContext.pricingStrategy !== '' && businessContext.pricingStrategy != null) ? businessContext.pricingStrategy : 'Standard pricing applies'}
${businessContext.discountPolicy ? `Discount Policy: ${businessContext.discountPolicy}` : ''}
${businessContext.volumeDiscounts ? `Volume Discounts: ${businessContext.volumeDiscounts}` : ''}
${businessContext.firstTimeBuyerIncentive ? `First-Time Buyer Incentive: ${businessContext.firstTimeBuyerIncentive}` : ''}
${businessContext.financingOptions ? `Financing Options: ${businessContext.financingOptions}` : ''}

# Policies
${businessContext.returnPolicy ? `Return Policy: ${businessContext.returnPolicy}` : ''}
${businessContext.warrantyTerms ? `Warranty: ${businessContext.warrantyTerms}` : ''}
${businessContext.cancellationPolicy ? `Cancellation Policy: ${businessContext.cancellationPolicy}` : ''}
${businessContext.satisfactionGuarantee ? `Satisfaction Guarantee: ${businessContext.satisfactionGuarantee}` : ''}
${businessContext.geographicCoverage ? `Geographic Coverage: ${businessContext.geographicCoverage}` : ''}
${businessContext.deliveryTimeframes ? `Delivery Timeframes: ${businessContext.deliveryTimeframes}` : ''}

# Your Sales Process
${businessContext.typicalSalesFlow ? `Typical Sales Flow:\n${businessContext.typicalSalesFlow}` : ''}
${businessContext.qualificationCriteria ? `Qualification Criteria:\n${businessContext.qualificationCriteria}` : ''}
${businessContext.discoveryQuestions ? `Discovery Questions to Ask:\n${businessContext.discoveryQuestions}` : ''}
${businessContext.closingStrategy ? `Closing Strategy:\n${businessContext.closingStrategy}` : ''}

# Objection Handling
${businessContext.commonObjections ? `Common Objections:\n${businessContext.commonObjections}` : ''}
${businessContext.priceObjections ? `Price Objections: ${businessContext.priceObjections}` : ''}
${businessContext.timeObjections ? `Time Objections: ${businessContext.timeObjections}` : ''}
${businessContext.competitorObjections ? `Competitor Objections: ${businessContext.competitorObjections}` : ''}

# Customer Service Scope
${businessContext.supportScope ? `Support Scope: ${businessContext.supportScope}` : ''}
${businessContext.technicalSupport ? `Technical Support: ${businessContext.technicalSupport}` : ''}
${businessContext.orderTracking ? `Order Tracking: ${businessContext.orderTracking}` : ''}
${businessContext.complaintResolution ? `Complaint Resolution: ${businessContext.complaintResolution}` : ''}

# Your Personality
Name: ${(agentPersona.name !== '' && agentPersona.name != null) ? agentPersona.name : 'AI Assistant'}
Tone: ${agentPersona.tone}
Greeting: "${agentPersona.greeting}"
Closing: "${agentPersona.closingMessage}"

# Behavioral Guidelines
- Closing Aggressiveness: ${behaviorConfig.closingAggressiveness}/10
- Ask ${behaviorConfig.questionFrequency} discovery questions before recommending
- Response Length: ${behaviorConfig.responseLength}
- Proactive Level: ${behaviorConfig.proactiveLevel}/10
${behaviorConfig.maxMessagesBeforeEscalation ? `- Escalate if conversation exceeds ${behaviorConfig.maxMessagesBeforeEscalation} messages` : ''}

# When to Escalate to Human
${agentPersona.escalationRules.map(rule => `- ${rule}`).join('\n')}

# Compliance & Legal
${businessContext.requiredDisclosures ? `Required Disclosures:\n${businessContext.requiredDisclosures}` : ''}
${businessContext.prohibitedTopics ? `Prohibited Topics: ${businessContext.prohibitedTopics}` : ''}
${businessContext.industryRegulations ? `Industry Regulations: ${businessContext.industryRegulations}` : ''}
`;

  // Add knowledge base content
  if (knowledgeBase.faqs && knowledgeBase.faqs.length > 0) {
    prompt += `\n# Frequently Asked Questions\n`;
    knowledgeBase.faqs.forEach(faq => {
      prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    });
  }
  
  // Add knowledge from documents
  if (knowledgeBase.documents && knowledgeBase.documents.length > 0) {
    prompt += `\n# Additional Knowledge from Documents\n`;
    knowledgeBase.documents.forEach(doc => {
      if (doc.extractedContent) {
        prompt += `${doc.filename}:\n${doc.extractedContent.substring(0, 1000)}...\n\n`;
      }
    });
  }
  
  // Add knowledge from URLs
  if (knowledgeBase.urls && knowledgeBase.urls.length > 0) {
    prompt += `\n# Knowledge from Website\n`;
    knowledgeBase.urls.forEach(url => {
      if (url.extractedContent) {
        // Extract title to avoid empty string in prompt (Explicit Ternary for STRING)
        const displayTitle = (url.title !== '' && url.title != null) ? url.title : url.url;
        prompt += `${displayTitle}:\n${url.extractedContent.substring(0, 1000)}...\n\n`;
      }
    });
  }
  
  // Add product catalog if available
  if (knowledgeBase.productCatalog && knowledgeBase.productCatalog.products.length > 0) {
    prompt += `\n# Product Catalog\n`;
    knowledgeBase.productCatalog.products.slice(0, 20).forEach(product => {
      prompt += `${product.name}: ${product.description} - $${product.price}\n`;
    });
  }
  
  prompt += `\n# Discount & Coupon Authorization
You have access to the following tools for handling discounts and promotions:

1. **get_authorized_discounts**: Call this BEFORE quoting prices to check what discounts you can offer.
   - Call this when: Customer expresses price concerns, you want to close a deal, or customer asks about promotions.
   - Returns: Available coupon codes, your discount limits, and authorization rules.

2. **validate_coupon**: Call this when a customer mentions a promo code.
   - Call this when: Customer says "I have a coupon" or asks "Can I use code XYZ?"
   - Returns: Whether the code is valid and what discount it provides.

3. **apply_discount**: Call this to apply a discount to the customer's purchase.
   - Call this when: Closing a deal or customer wants to use a valid coupon.
   - Note: Discounts above your authorization limit will require manager approval.

**Discount Best Practices:**
- ALWAYS call get_authorized_discounts before discussing pricing if the customer seems price-sensitive
- Proactively mention available promotions when you sense hesitation
- If a discount exceeds your limit, inform the customer you're checking with your manager
- Never promise discounts you haven't verified are available

# Important Instructions
- Always be helpful, accurate, and aligned with the business values
- Use the customer's name when you know it
- Remember previous conversations with this customer
- If you don't know something, say so and offer to find out
- Never make up information about products, pricing, or policies
- Follow the escalation rules when appropriate
- Maintain the specified tone and personality throughout
`;
  
  return prompt;
}






















