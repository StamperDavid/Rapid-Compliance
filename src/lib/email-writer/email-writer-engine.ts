/**
 * Email Writer Engine - AI-Powered Sales Email Generation
 * 
 * SOVEREIGN CORPORATE BRAIN - SALES COMMUNICATION MODULE
 * 
 * This engine generates personalized sales emails by leveraging:
 * - Deal scoring (hot/warm/cold/at-risk) for tone and urgency
 * - Battlecard data for competitive positioning
 * - Industry templates for best practices
 * - Contact/company context for personalization
 * 
 * CAPABILITIES:
 * - 5 email types (intro, follow-up, proposal, close, re-engagement)
 * - Score-based personalization (aggressive for hot, salvage for at-risk)
 * - Competitive positioning from battlecards
 * - Industry-specific best practices
 * - Multi-variate testing support
 * - Signal Bus integration for tracking
 * 
 * INTEGRATION:
 * - Uses deal-scoring-engine for deal intelligence
 * - Uses battlecard-engine for competitive insights
 * - Uses industry-templates for industry best practices
 * - Emits email.generated signals to Signal Bus
 */

import { logger } from '@/lib/logger/logger';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { calculateDealScore, type DealScore } from '@/lib/templates/deal-scoring-engine';
import { discoverCompetitor, generateBattlecard, type Battlecard } from '@/lib/battlecard/battlecard-engine';
import { getTemplateById, type SalesIndustryTemplate } from '@/lib/templates/industry-templates';
import type { Deal } from '@/lib/crm/deal-service';
import { EMAIL_TEMPLATES, type EmailTemplate, type EmailType } from './email-templates';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Email Generation Options
 */
export interface EmailGenerationOptions {
  organizationId: string;
  workspaceId: string;
  userId: string; // Sales rep generating the email
  
  // Email configuration
  emailType: EmailType;
  
  // Deal context
  dealId: string;
  deal?: Deal; // Optional if you already have the deal
  dealScore?: DealScore; // Optional if you already have the score
  
  // Recipient context
  recipientName?: string;
  recipientEmail?: string;
  recipientTitle?: string;
  companyName?: string;
  
  // Competitive context
  competitorDomain?: string; // Optional competitor for battlecard positioning
  battlecard?: Battlecard; // Optional if you already have the battlecard
  
  // Template context
  templateId?: string; // Industry template for best practices
  industryTemplate?: SalesIndustryTemplate; // Optional if you already have it
  
  // Customization
  tone?: 'professional' | 'casual' | 'consultative' | 'urgent' | 'friendly';
  length?: 'short' | 'medium' | 'long'; // Email length preference
  includeCompetitive?: boolean; // Include competitive positioning
  includeSocialProof?: boolean; // Include case studies, testimonials
  customInstructions?: string; // Additional AI instructions
}

/**
 * Generated Email
 */
export interface GeneratedEmail {
  id: string; // Unique email ID
  organizationId: string;
  workspaceId: string;
  userId: string;
  
  // Email content
  subject: string;
  body: string; // HTML email body
  bodyPlain: string; // Plain text version
  
  // Context used for generation
  emailType: EmailType;
  dealId: string;
  dealScore?: number; // 0-100
  dealTier?: 'hot' | 'warm' | 'cold' | 'at-risk';
  templateId?: string;
  competitorDomain?: string;
  
  // Metadata
  tone: string;
  length: string;
  includeCompetitive: boolean;
  includeSocialProof: boolean;
  
  // AI metadata
  model: string; // AI model used
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  
  // Versioning (for A/B testing)
  version: number;
  variants?: GeneratedEmail[]; // Alternative versions for testing
  
  // Timestamps
  generatedAt: Date;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
}

/**
 * Email Generation Result
 */
export interface EmailGenerationResult {
  success: boolean;
  email?: GeneratedEmail;
  error?: string;
  suggestedImprovements?: string[]; // AI suggestions for improvement
}

// ============================================================================
// EMAIL GENERATION ENGINE
// ============================================================================

/**
 * Generate AI-powered sales email
 * 
 * This is the main entry point for email generation.
 * 
 * @param options - Email generation options
 * @returns Generated email with subject and body
 */
export async function generateSalesEmail(
  options: EmailGenerationOptions
): Promise<EmailGenerationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Generating sales email', {
      organizationId: options.organizationId,
      dealId: options.dealId,
      emailType: options.emailType,
      includeCompetitive: options.includeCompetitive,
    });
    
    // 1. Get email template
    const template = EMAIL_TEMPLATES[options.emailType];
    if (!template) {
      throw new Error(`Email template not found: ${options.emailType}`);
    }
    
    // 2. Get deal score (for personalization)
    let dealScore: DealScore | undefined = options.dealScore;
    if (!dealScore && options.deal) {
      dealScore = await calculateDealScore({
        organizationId: options.organizationId,
        workspaceId: options.workspaceId,
        dealId: options.dealId,
        deal: options.deal,
        templateId: options.templateId,
      });
    }
    
    // 3. Get battlecard (if competitive positioning requested)
    let battlecard: Battlecard | undefined = options.battlecard;
    if (options.includeCompetitive && options.competitorDomain && !battlecard) {
      try {
        // First, discover the competitor to get their profile
        const competitorProfile = await discoverCompetitor(
          options.competitorDomain,
          options.organizationId
        );
        
        // Then generate the battlecard using the profile
        battlecard = await generateBattlecard(competitorProfile, {
          ourProduct: options.companyName || 'Our Product',
        });
      } catch (error) {
        logger.warn('Failed to generate battlecard, continuing without competitive positioning', {
          error,
          competitorDomain: options.competitorDomain,
        });
      }
    }
    
    // 4. Get industry template (for best practices)
    let industryTemplate: SalesIndustryTemplate | undefined = options.industryTemplate;
    if (options.templateId && !industryTemplate) {
      industryTemplate = getTemplateById(options.templateId);
    }
    
    // 5. Build AI prompt
    const prompt = buildEmailPrompt({
      options,
      template,
      dealScore,
      battlecard,
      industryTemplate,
    });
    
    // 6. Call LLM for email generation
    const llmResponse = await sendUnifiedChatMessage({
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(options, template, dealScore),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'gpt-4o', // Use GPT-4o for high-quality email generation
      temperature: 0.7, // Balance creativity with consistency
      maxTokens: 1500, // Enough for comprehensive emails
    });
    
    if (!llmResponse.text) {
      throw new Error('Failed to generate email - no response from LLM');
    }
    
    // 7. Parse email from LLM response
    const { subject, body, bodyPlain } = parseEmailResponse(llmResponse.text);
    
    // 8. Create generated email object
    const generatedEmail: GeneratedEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      userId: options.userId,
      
      subject,
      body,
      bodyPlain,
      
      emailType: options.emailType,
      dealId: options.dealId,
      dealScore: dealScore?.score,
      dealTier: dealScore?.tier,
      templateId: options.templateId,
      competitorDomain: options.competitorDomain,
      
      tone: options.tone || determineToneFromScore(dealScore),
      length: options.length || 'medium',
      includeCompetitive: options.includeCompetitive || false,
      includeSocialProof: options.includeSocialProof || false,
      
      model: 'gpt-4o',
      promptTokens: llmResponse.usage?.promptTokens || 0,
      completionTokens: llmResponse.usage?.completionTokens || 0,
      totalTokens: llmResponse.usage?.totalTokens || 0,
      
      version: 1,
      
      generatedAt: new Date(),
    };
    
    // 9. Emit signal to Signal Bus
    await emitEmailGeneratedSignal({
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      email: generatedEmail,
      dealScore,
    });
    
    const duration = Date.now() - startTime;
    logger.info('Email generated successfully', {
      emailId: generatedEmail.id,
      emailType: options.emailType,
      dealScore: dealScore?.score,
      dealTier: dealScore?.tier,
      duration,
    });
    
    return {
      success: true,
      email: generatedEmail,
      suggestedImprovements: extractImprovementSuggestions(llmResponse.text),
    };
    
  } catch (error) {
    logger.error('Failed to generate email', {
      error,
      organizationId: options.organizationId,
      dealId: options.dealId,
      emailType: options.emailType,
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build system prompt based on email type and deal context
 */
function buildSystemPrompt(
  options: EmailGenerationOptions,
  template: EmailTemplate,
  dealScore?: DealScore
): string {
  const tier = dealScore?.tier || 'warm';
  const score = dealScore?.score || 50;
  
  let systemPrompt = `You are an expert B2B sales email writer. Your goal is to write ${template.name} that:

1. ${template.goal}
2. Uses a ${options.tone || determineToneFromScore(dealScore)} tone
3. Is ${options.length || 'medium'} length (${getLengthGuidance(options.length || 'medium')})
4. Follows email best practices (clear subject, strong opening, value proposition, clear CTA)

DEAL CONTEXT:
- Deal Score: ${score}/100 (Tier: ${tier})
- Deal Tier Strategy: ${getTierStrategy(tier)}
`;

  if (dealScore?.riskFactors && dealScore.riskFactors.length > 0) {
    systemPrompt += `\nRISK FACTORS TO ADDRESS:\n${dealScore.riskFactors.map(r => `- ${r.description}: ${r.mitigation}`).join('\n')}`;
  }
  
  if (dealScore?.recommendations && dealScore.recommendations.length > 0) {
    systemPrompt += `\nRECOMMENDED ACTIONS:\n${dealScore.recommendations.map(r => `- ${r}`).join('\n')}`;
  }
  
  systemPrompt += `\n\nFORMAT YOUR RESPONSE AS:
SUBJECT: [email subject line]
---
BODY:
[HTML email body]
---
PLAIN:
[Plain text version]
---
IMPROVEMENTS:
[Optional: 1-3 suggestions for improvement]`;
  
  return systemPrompt;
}

/**
 * Build user prompt with all context
 */
function buildEmailPrompt(params: {
  options: EmailGenerationOptions;
  template: EmailTemplate;
  dealScore?: DealScore;
  battlecard?: Battlecard;
  industryTemplate?: SalesIndustryTemplate;
}): string {
  const { options, template, dealScore, battlecard, industryTemplate } = params;
  
  let prompt = `Write a ${template.name} with the following context:

RECIPIENT:
- Name: ${options.recipientName || '[Name]'}
- Title: ${options.recipientTitle || '[Title]'}
- Company: ${options.companyName || '[Company]'}
${options.recipientEmail ? `- Email: ${options.recipientEmail}` : ''}

EMAIL STRUCTURE:
${template.structure.map((section, i) => `${i + 1}. ${section}`).join('\n')}

KEY POINTS TO INCLUDE:
${template.keyPoints.map(point => `- ${point}`).join('\n')}
`;

  // Add deal score context
  if (dealScore) {
    prompt += `\n\nDEAL INTELLIGENCE:
- Score: ${dealScore.score}/100 (${dealScore.tier})
- Close Probability: ${dealScore.closeProbability}%
- Predicted Value: $${dealScore.predictedValue.toLocaleString()}
- Key Factors: ${dealScore.factors.slice(0, 3).map(f => `${f.name} (${f.score}/100)`).join(', ')}
`;
  }
  
  // Add competitive positioning
  if (battlecard && options.includeCompetitive) {
    prompt += `\n\nCOMPETITIVE POSITIONING (vs ${battlecard.competitorDomain}):
`;
    
    if (battlecard.battleTactics?.whenWeWin) {
      prompt += `\nWhen We Win:
${battlecard.battleTactics.whenWeWin.map(s => `- ${s}`).join('\n')}
`;
    }
    
    if (battlecard.battleTactics?.commonObjections && battlecard.battleTactics.commonObjections.length > 0) {
      const topObjection = battlecard.battleTactics.commonObjections[0];
      prompt += `\nObjection Handling:
- Objection: "${topObjection.objection}"
- Response: ${topObjection.response}
- Proof: ${topObjection.proofPoints.join(', ')}
`;
    }
    
    if (battlecard.featureComparison) {
      const ourAdvantages = battlecard.featureComparison
        .filter(f => f.advantage === 'us')
        .slice(0, 3);
      
      if (ourAdvantages.length > 0) {
        prompt += `\nOur Competitive Advantages:
${ourAdvantages.map(f => `- ${f.feature}: ${f.usValue || 'Yes'} (They: ${f.themValue || 'No'})`).join('\n')}
`;
      }
    }
  }
  
  // Add industry best practices
  if (industryTemplate) {
    const relevantBestPractices = industryTemplate.bestPractices
      .filter(bp => bp.category === template.bestPracticeCategory)
      .slice(0, 2);
    
    if (relevantBestPractices.length > 0) {
      prompt += `\n\nINDUSTRY BEST PRACTICES (${industryTemplate.industry}):
${relevantBestPractices.map(bp => `- ${bp.title}: ${bp.description}`).join('\n')}
`;
    }
    
    if (industryTemplate.discoveryQuestions.length > 0 && template.id === 'intro') {
      prompt += `\n\nSUGGESTED DISCOVERY QUESTIONS:
${industryTemplate.discoveryQuestions.slice(0, 2).map(q => `- ${q}`).join('\n')}
`;
    }
  }
  
  // Add custom instructions
  if (options.customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:
${options.customInstructions}
`;
  }
  
  // Add examples from template
  if (template.examples && template.examples.length > 0) {
    prompt += `\n\nEXAMPLE STRUCTURE (adapt, don't copy):
${template.examples[0]}
`;
  }
  
  return prompt;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine tone based on deal score
 */
function determineToneFromScore(dealScore?: DealScore): string {
  if (!dealScore) return 'professional';
  
  const { tier, score } = dealScore;
  
  if (tier === 'hot' && score >= 80) return 'urgent'; // Push for close
  if (tier === 'warm' && score >= 60) return 'consultative'; // Build value
  if (tier === 'at-risk' && score < 40) return 'friendly'; // Salvage relationship
  
  return 'professional'; // Default
}

/**
 * Get tier-specific strategy
 */
function getTierStrategy(tier: string): string {
  const strategies: Record<string, string> = {
    hot: 'Aggressive close - create urgency, emphasize ROI, push for decision',
    warm: 'Build value - educate, demonstrate differentiation, nurture relationship',
    cold: 'Re-engage - pique interest, offer value, low-friction next step',
    'at-risk': 'Salvage - address concerns, offer solutions, rebuild trust',
  };
  
  return strategies[tier] || strategies.warm;
}

/**
 * Get length guidance for AI
 */
function getLengthGuidance(length: string): string {
  const guidance: Record<string, string> = {
    short: '50-100 words, 2-3 paragraphs',
    medium: '100-200 words, 3-5 paragraphs',
    long: '200-300 words, 5-7 paragraphs',
  };
  
  return guidance[length] || guidance.medium;
}

/**
 * Parse email response from LLM
 */
function parseEmailResponse(response: string): {
  subject: string;
  body: string;
  bodyPlain: string;
} {
  // Extract subject
  const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|---)/i);
  const subject = subjectMatch?.[1]?.trim() || 'Your Email Subject';
  
  // Extract HTML body
  const bodyMatch = response.match(/BODY:\s*\n([\s\S]+?)(?:\n---|\nPLAIN:)/i);
  const body = bodyMatch?.[1]?.trim() || response;
  
  // Extract plain text
  const plainMatch = response.match(/PLAIN:\s*\n([\s\S]+?)(?:\n---|\nIMPROVEMENTS:|$)/i);
  const bodyPlain = plainMatch?.[1]?.trim() || stripHTML(body);
  
  return {
    subject,
    body: formatEmailHTML(body),
    bodyPlain,
  };
}

/**
 * Format email body as HTML
 */
function formatEmailHTML(text: string): string {
  // If already HTML, return as-is
  if (text.includes('<html') || text.includes('<div')) {
    return text;
  }
  
  // Convert plain text to HTML
  const paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  
  return `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
${paragraphs}
</body>
</html>`;
}

/**
 * Strip HTML tags for plain text version
 */
function stripHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract improvement suggestions from LLM response
 */
function extractImprovementSuggestions(response: string): string[] {
  const improvementsMatch = response.match(/IMPROVEMENTS:\s*\n([\s\S]+?)$/i);
  if (!improvementsMatch) return [];
  
  const improvements = improvementsMatch[1]
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line.length > 0);
  
  return improvements;
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit email.generated signal to Signal Bus
 */
async function emitEmailGeneratedSignal(params: {
  organizationId: string;
  workspaceId: string;
  email: GeneratedEmail;
  dealScore?: DealScore;
}): Promise<void> {
  try {
    const coordinator = await getServerSignalCoordinator();
    
    await coordinator.emitSignal({
      type: 'email.generated',
      orgId: params.organizationId,
      priority: 'Medium',
      confidence: 0.85, // High confidence in email generation
      metadata: {
        emailId: params.email.id,
        emailType: params.email.emailType,
        dealId: params.email.dealId,
        dealScore: params.dealScore?.score,
        dealTier: params.dealScore?.tier,
        subject: params.email.subject,
        tone: params.email.tone,
        length: params.email.length,
        includeCompetitive: params.email.includeCompetitive,
        model: params.email.model,
        totalTokens: params.email.totalTokens,
        generatedAt: params.email.generatedAt.toISOString(),
      },
    });
    
    logger.info('Email generated signal emitted', {
      emailId: params.email.id,
      organizationId: params.organizationId,
    });
  } catch (error) {
    logger.error('Failed to emit email.generated signal', { error });
  }
}

// ============================================================================
// BATCH EMAIL GENERATION
// ============================================================================

/**
 * Generate multiple email variants for A/B testing
 */
export async function generateEmailVariants(
  options: EmailGenerationOptions,
  variantCount: number = 3
): Promise<EmailGenerationResult> {
  try {
    logger.info('Generating email variants', {
      organizationId: options.organizationId,
      dealId: options.dealId,
      variantCount,
    });
    
    const variants: GeneratedEmail[] = [];
    
    // Generate variants with different tones
    const tones: Array<'professional' | 'casual' | 'consultative' | 'urgent' | 'friendly'> = 
      ['professional', 'consultative', 'friendly'];
    
    for (let i = 0; i < Math.min(variantCount, tones.length); i++) {
      const variantOptions = {
        ...options,
        tone: tones[i],
      };
      
      const result = await generateSalesEmail(variantOptions);
      
      if (result.success && result.email) {
        result.email.version = i + 1;
        variants.push(result.email);
      }
    }
    
    if (variants.length === 0) {
      throw new Error('Failed to generate any email variants');
    }
    
    // Return first variant as main email with others as alternatives
    const mainEmail = variants[0];
    mainEmail.variants = variants.slice(1);
    
    return {
      success: true,
      email: mainEmail,
    };
    
  } catch (error) {
    logger.error('Failed to generate email variants', {
      error,
      organizationId: options.organizationId,
      dealId: options.dealId,
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  EmailGenerationOptions,
  GeneratedEmail,
  EmailGenerationResult,
};
