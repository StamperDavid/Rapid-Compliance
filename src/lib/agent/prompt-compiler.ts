/**
 * System Prompt Compiler
 * Compiles the final system prompt from all components
 */

import type { 
  AgentPersona, 
  KnowledgeBase,
  BehaviorConfig 
} from '@/types/agent-memory';

export interface PromptComponents {
  businessContext: Record<string, any>;
  agentPersona: AgentPersona;
  behaviorConfig: BehaviorConfig;
  knowledgeBase: KnowledgeBase;
}

/**
 * Compile system prompt from all components
 */
export async function compileSystemPrompt(
  components: PromptComponents
): Promise<string> {
  const { businessContext, agentPersona, behaviorConfig, knowledgeBase } = components;
  
  let prompt = `You are an AI sales and customer service agent for ${businessContext.businessName || 'the company'}.

# Your Role & Objectives
${agentPersona.objectives.map(obj => `- ${obj}`).join('\n')}

# Business Context
Industry: ${businessContext.industry || 'General'}
What we do: ${businessContext.problemSolved || 'We provide products and services'}
What makes us unique: ${businessContext.uniqueValue || 'Our commitment to quality'}
Target Customer: ${businessContext.targetCustomer || 'Anyone who needs our services'}

# Products/Services
${businessContext.topProducts ? `Top Products:\n${businessContext.topProducts}` : ''}
${businessContext.primaryOffering ? `Primary Offering: ${businessContext.primaryOffering}` : ''}
${businessContext.productComparison ? `Product Comparison:\n${businessContext.productComparison}` : ''}
${businessContext.seasonalOfferings ? `Seasonal Offerings:\n${businessContext.seasonalOfferings}` : ''}

# Pricing Strategy
${businessContext.pricingStrategy || 'Standard pricing applies'}
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
Name: ${agentPersona.name || 'AI Assistant'}
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
        prompt += `${url.title || url.url}:\n${url.extractedContent.substring(0, 1000)}...\n\n`;
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
  
  prompt += `\n# Important Instructions
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



















