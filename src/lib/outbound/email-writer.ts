/**
 * AI Email Writer Service
 * Generates personalized cold emails using AI and prospect research
 */

import { generatePersonalizationTokens, type ProspectData, type ProspectResearch } from './prospect-research';
import { logger } from '@/lib/logger/logger';

export interface EmailGenerationRequest {
  prospect: ProspectData;
  research?: ProspectResearch;
  template: EmailTemplate;
  tone: EmailTone;
  valueProposition?: string;
  cta?: string; // Call to action
  organizationId?: string; // For checking AI usage settings
}

export type EmailTemplate = 'AIDA' | 'PAS' | 'BAB' | 'custom';
export type EmailTone = 'professional' | 'casual' | 'friendly' | 'direct';

export interface GeneratedEmail {
  subject: string;
  body: string;
  subjectVariants: string[]; // Alternative subject lines for A/B testing
  preview: string; // Email preview text
  personalizationScore: number; // 0-100, how personalized it is
  tokens: Record<string, string>; // Personalization tokens used
}

/**
 * Generate a personalized cold email using AI
 */
export async function generateColdEmail(
  request: EmailGenerationRequest
): Promise<GeneratedEmail> {
  logger.info('Email Writer Generating email for request.prospect.name} at request.prospect.company}', { file: 'email-writer.ts' });

  // Generate personalization tokens
  const tokens = request.research 
    ? generatePersonalizationTokens(request.prospect, request.research)
    : {
        firstName: request.prospect.name.split(' ')[0],
        company: request.prospect.company,
        title:(request.prospect.title !== '' && request.prospect.title != null) ? request.prospect.title : 'there',
      };

  // Build the email based on template
  const emailContent = await buildEmail(request, tokens);

  // Generate subject line variants for A/B testing
  const subjectVariants = generateSubjectVariants(request, tokens);

  // Calculate personalization score
  const personalizationScore = calculatePersonalizationScore(request, tokens);

  return {
    subject: subjectVariants[0],
    body: emailContent.body,
    subjectVariants: subjectVariants.slice(1, 4), // Additional 3 variants
    preview: emailContent.preview,
    personalizationScore,
    tokens,
  };
}

/**
 * Build email content based on template
 */
async function buildEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<{ body: string; preview: string }> {
  let body: string;
  let preview: string;

  switch (request.template) {
    case 'AIDA':
      // Attention, Interest, Desire, Action
      body = await buildAIDAEmail(request, tokens);
      preview = `${tokens.firstName}, quick question about ${tokens.company}...`;
      break;

    case 'PAS':
      // Problem, Agitate, Solve
      body = await buildPASEmail(request, tokens);
      preview = `Solving ${tokens.company}'s biggest challenge...`;
      break;

    case 'BAB':
      // Before, After, Bridge
      body = await buildBABEmail(request, tokens);
      preview = `${tokens.firstName}, imagine if ${tokens.company} could...`;
      break;

    case 'custom':
      body = await buildCustomEmail(request, tokens);
      preview = `Personalized message for ${tokens.firstName}...`;
      break;

    default:
      body = await buildAIDAEmail(request, tokens);
      preview = `${tokens.firstName}, quick question...`;
  }

  return { body, preview };
}

/**
 * AIDA Template: Attention, Interest, Desire, Action
 */
async function buildAIDAEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<string> {
  const { valueProposition = 'increase sales productivity', cta = 'book a 15-minute call' } = request;
  
  // Use AI to generate if enabled for this organization
  const useAI = await shouldUseAI(request.organizationId);
  
  if (useAI) {
    return generateWithAI(request, tokens, 'AIDA');
  }

  // Template-based fallback
  const attention = `Hi ${tokens.firstName},\n\nI noticed ${tokens.insight1 || `${tokens.company} is growing in the ${tokens.industry} space`}.`;
  
  const interest = `We've helped similar ${tokens.industry} companies ${valueProposition} by 40% on average.`;
  
  const desire = `Imagine if your team could:\n• Close deals 2x faster\n• Automate repetitive tasks\n• Get real-time insights on every prospect`;
  
  const action = `Would you be open to a quick ${cta.includes('call') ? '15-minute call' : 'conversation'} to see if this makes sense for ${tokens.company}?\n\nBest regards`;
  
  return `${attention}\n\n${interest}\n\n${desire}\n\n${action}`;
}

/**
 * PAS Template: Problem, Agitate, Solve
 */
async function buildPASEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<string> {
  if (await shouldUseAI(request.organizationId)) {
    return generateWithAI(request, tokens, 'PAS');
  }

  const problem = `Hi ${tokens.firstName},\n\nMost ${tokens.industry} companies struggle with manual sales processes that slow down their team.`;
  
  const agitate = `This means:\n• Reps spending hours on data entry instead of selling\n• Missed follow-ups and lost deals\n• No visibility into what's working`;
  
  const solve = `We've built an AI-powered platform that automates 80% of this work. Companies like yours typically see a 3x ROI in the first quarter.\n\nWant to see how it works? I can show you a quick demo this week.`;
  
  return `${problem}\n\n${agitate}\n\n${solve}`;
}

/**
 * BAB Template: Before, After, Bridge
 */
async function buildBABEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<string> {
  if (await shouldUseAI(request.organizationId)) {
    return generateWithAI(request, tokens, 'BAB');
  }

  const before = `Hi ${tokens.firstName},\n\nBefore working with us, ${tokens.industry} companies were losing 30% of leads due to slow follow-up.`;
  
  const after = `After implementing our system, they're:\n• Responding to leads in under 2 minutes\n• Converting 40% more prospects\n• Saving 15 hours per week per rep`;
  
  const bridge = `The difference? AI-powered automation that works 24/7.\n\nInterested in seeing how this could work for ${tokens.company}? Let's chat for 15 minutes.`;
  
  return `${before}\n\n${after}\n\n${bridge}`;
}

/**
 * Custom template using full AI generation
 */
async function buildCustomEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<string> {
  return generateWithAI(request, tokens, 'custom');
}

/**
 * Generate email using AI (GPT-4, Claude, or Gemini)
 */
async function generateWithAI(
  request: EmailGenerationRequest,
  tokens: Record<string, string>,
  template: string
): Promise<string> {
  // Build AI prompt
  const prompt = buildAIPrompt(request, tokens, template);
  
  try {
    // Use unified AI service
    const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4-turbo', // Use GPT-4 for best quality cold emails
      messages: [
        {
          role: 'user',
          content: prompt,
        }
      ],
      temperature: 0.7, // Some creativity but not too much
      maxTokens: 500,
    });

    return response.text.trim();
  } catch (error) {
    logger.error('[Email Writer] AI generation failed:', error instanceof Error ? error : undefined, { file: 'email-writer.ts' });
    // Fallback to template
    return buildAIDAEmail(request, tokens);
  }
}

/**
 * Build prompt for AI email generation
 */
function buildAIPrompt(
  request: EmailGenerationRequest,
  tokens: Record<string, string>,
  template: string
): string {
  const researchContext = request.research 
    ? `\n\nProspect Research:\n${request.research.insights.map(i => `- ${i}`).join('\n')}`
    : '';

  const templateInstructions = {
    AIDA: 'Use the AIDA framework (Attention, Interest, Desire, Action). Grab attention, build interest, create desire, and include a clear call to action.',
    PAS: 'Use the PAS framework (Problem, Agitate, Solve). Identify their problem, agitate it, then present your solution.',
    BAB: 'Use the Before-After-Bridge framework. Show their current state, paint the picture of a better future, then bridge the gap with your solution.',
    custom: 'Write a highly personalized email that addresses their specific situation and pain points.',
  };

  return `You are an expert cold email writer. Write a personalized cold email with these requirements:

PROSPECT INFORMATION:
- Name: ${tokens.firstName} ${tokens.lastName}
- Company: ${tokens.company}
- Title: ${tokens.title}
- Industry: ${tokens.industry}
${researchContext}

EMAIL REQUIREMENTS:
- Template: ${template} (${templateInstructions[template as keyof typeof templateInstructions]})
- Tone: ${request.tone}
- Value Proposition: ${(request.valueProposition !== '' && request.valueProposition != null) ? request.valueProposition : 'help them grow their business'}
- Call to Action: ${(request.cta !== '' && request.cta != null) ? request.cta : 'book a 15-minute call'}
- Length: 150-200 words maximum
- Personalization: Use the prospect research insights naturally

RULES:
1. No generic "hope this email finds you well" openers
2. Start with a specific, relevant observation about their company
3. Focus on THEIR problems, not your product features
4. Make it conversational and human
5. Include ONE clear next step
6. Don't mention competitors
7. No hype or exaggeration
8. Professional but friendly
9. Use "I" not "we" (sounds less corporate)
10. End with a simple question, not a demand

Write only the email body. Don't include subject line or signature.`;
}

/**
 * Generate subject line variants for A/B testing
 */
function generateSubjectVariants(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): string[] {
  const variants: string[] = [];
  
  // Insight-based subject
  if (tokens.insight1) {
    variants.push(`${tokens.firstName}, quick question about ${tokens.company}`);
  }
  
  // Value-based subject
  variants.push(`${tokens.company} + ${(request.valueProposition !== '' && request.valueProposition != null) ? request.valueProposition : 'growth'}`);
  
  // Curiosity-based subject
  variants.push(`${tokens.firstName}, saw this about ${tokens.company}`);
  
  // Direct subject
  variants.push(`Helping ${tokens.industry} companies scale faster`);
  
  // Personal subject
  variants.push(`${tokens.firstName}, 15 minutes?`);
  
  return variants;
}

/**
 * Calculate how personalized the email is (0-100)
 */
function calculatePersonalizationScore(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): number {
  let score = 30; // Base score
  
  // Has research insights
  if (request.research && request.research.insights.length > 0) {
    score += 20;
  }
  
  // Has recent news
  if (request.research && request.research.recentNews.length > 0) {
    score += 15;
  }
  
  // Has title
  if (tokens.title && tokens.title !== 'there') {
    score += 10;
  }
  
  // Has industry
  if (tokens.industry && tokens.industry !== 'Unknown') {
    score += 10;
  }
  
  // Has company size
  if (tokens.companySize && tokens.companySize !== 'Unknown') {
    score += 10;
  }
  
  // Has custom value prop
  if (request.valueProposition) {
    score += 5;
  }
  
  return Math.min(100, score);
}

/**
 * Check if we should use AI or template based on organization settings
 */
async function shouldUseAI(organizationId?: string): Promise<boolean> {
  // If no organizationId provided, default to true
  if (!organizationId) {
    return true;
  }
  
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    interface OrganizationSettings {
      emailGeneration?: {
        useAI?: boolean;
      };
    }

    interface OrganizationDoc {
      settings?: OrganizationSettings;
    }

    // Get organization document
    const orgDoc = await FirestoreService.get<OrganizationDoc>(
      'organizations',
      organizationId
    );

    if (!orgDoc) {
      // Organization not found, default to true
      return true;
    }

    // Check if AI email generation is enabled
    // Settings structure: settings.emailGeneration.useAI (default: true)
    const useAI = orgDoc.settings?.emailGeneration?.useAI;
    
    // Default to true if setting doesn't exist (backwards compatible)
    return useAI !== false;
  } catch (error) {
    const { logger } = await import('@/lib/logger/logger');
    logger.warn('Failed to check AI setting, defaulting to true', {
      organizationId,
      error: (error as Error).message,
    });
    // On error, default to true
    return true;
  }
}

/**
 * Validate email before sending
 */
export function validateEmail(email: GeneratedEmail): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Subject line checks
  if (email.subject.length > 60) {
    errors.push('Subject line too long (max 60 characters)');
  }
  
  if (email.subject.length < 10) {
    errors.push('Subject line too short (min 10 characters)');
  }
  
  // Body checks
  if (email.body.length < 100) {
    errors.push('Email body too short (min 100 characters)');
  }
  
  if (email.body.length > 1000) {
    errors.push('Email body too long (max 1000 characters)');
  }
  
  // Spam word checks
  const spamWords = ['free', 'guaranteed', 'no risk', 'act now', 'limited time', 'click here', 'buy now'];
  const bodyLower = email.body.toLowerCase();
  const foundSpamWords = spamWords.filter(word => bodyLower.includes(word));
  
  if (foundSpamWords.length > 0) {
    errors.push(`Contains spam words: ${foundSpamWords.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}






















