/**
 * Email Reply Handler
 * AI-powered system to read and respond to prospect email replies
 */

import { logger } from '@/lib/logger/logger';

export interface EmailReply {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo?: string; // Message ID this is replying to
  receivedAt: string;
  headers?: Record<string, string>;
}

export interface ReplyClassification {
  // Intent classification
  intent: ReplyIntent;
  
  // Sentiment analysis
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -100 to 100
  
  // Entity extraction
  entities: ExtractedEntities;
  
  // Confidence
  confidence: number; // 0-100
  
  // AI suggestions
  suggestedResponse?: string;
  suggestedAction: ReplyAction;
  requiresHumanReview: boolean;
  
  // Reasoning
  reasoning: string;
}

export type ReplyIntent = 
  | 'interested'
  | 'not_interested'
  | 'question'
  | 'objection'
  | 'meeting_request'
  | 'meeting_reschedule'
  | 'out_of_office'
  | 'unsubscribe'
  | 'referral'
  | 'not_decision_maker'
  | 'needs_more_info'
  | 'timing_issue'
  | 'budget_concern'
  | 'competitor_mention'
  | 'spam_complaint'
  | 'other';

export type ReplyAction =
  | 'send_response'      // AI will respond
  | 'book_meeting'       // Trigger meeting scheduler
  | 'escalate_to_human'  // Flag for human review
  | 'unenroll'           // Remove from sequence
  | 'mark_as_converted'  // Mark as won
  | 'pause_sequence'     // Pause but don't remove
  | 'ignore'             // No action needed (OOO, etc.)
  | 'schedule_callback'; // Add to callback list

export interface ExtractedEntities {
  requestedInfo?: string[];      // Info they're asking for
  meetingTime?: Date;             // Proposed meeting time
  meetingDuration?: number;       // Minutes
  objectionType?: string;         // Price, time, features, etc.
  competitorMentioned?: string;   // Competitor they mentioned
  decisionMaker?: string;         // Person they referred to
  referralContact?: {             // If they referred someone
    name?: string;
    email?: string;
    title?: string;
  };
}

/**
 * Classify an email reply using AI
 */
export async function classifyReply(reply: EmailReply): Promise<ReplyClassification> {
  logger.info('Reply Handler Classifying reply from reply.from}', { file: 'reply-handler.ts' });

  try {
    // Use AI to classify the reply
    const classification = await classifyWithAI(reply);
    
    return classification;
  } catch (error) {
    logger.error('[Reply Handler] Classification failed:', error, { file: 'reply-handler.ts' });
    
    // Fallback to basic classification
    return fallbackClassification(reply);
  }
}

/**
 * Generate AI response to a reply
 */
export async function generateReply(
  originalReply: EmailReply,
  classification: ReplyClassification,
  context: ProspectContext
): Promise<GeneratedReply> {
  logger.info('Reply Handler Generating reply for classification.intent} intent', { file: 'reply-handler.ts' });

  try {
    const response = await generateWithAI(originalReply, classification, context);
    
    return response;
  } catch (error) {
    logger.error('[Reply Handler] Reply generation failed:', error, { file: 'reply-handler.ts' });
    throw error;
  }
}

export interface ProspectContext {
  prospectName: string;
  companyName: string;
  conversationHistory: EmailReply[];
  originalOutreach: {
    subject: string;
    body: string;
    sentAt: string;
  };
  product?: string;
  valueProposition?: string;
}

export interface GeneratedReply {
  subject: string;
  body: string;
  confidence: number; // 0-100
  requiresApproval: boolean;
  suggestedFollowUps?: string[]; // Suggested follow-up messages if they don't reply
}

/**
 * Classify reply using AI
 */
async function classifyWithAI(reply: EmailReply): Promise<ReplyClassification> {
  const prompt = buildClassificationPrompt(reply);

  const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');

  const response = await sendUnifiedChatMessage({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'user',
        content: prompt,
      }
    ],
    temperature: 0.2, // Low temperature for accurate classification
    maxTokens: 1000,
  });

  // Parse AI response
  return parseClassificationResponse(response.text, reply);
}

/**
 * Build classification prompt
 */
function buildClassificationPrompt(reply: EmailReply): string {
  return `You are an expert email classifier for sales outreach. Analyze this prospect reply and provide detailed classification.

EMAIL FROM PROSPECT:
From: ${reply.from}
Subject: ${reply.subject}
Body:
${reply.body}

CLASSIFY THIS REPLY:

1. INTENT (choose ONE):
- interested: Shows clear interest in product/meeting
- not_interested: Clearly declines or says not interested
- question: Asking for more information
- objection: Raises concerns (price, timing, features, etc.)
- meeting_request: Wants to schedule a call/meeting
- meeting_reschedule: Wants to change scheduled time
- out_of_office: Auto-reply, OOO message
- unsubscribe: Wants to be removed from emails
- referral: Refers to someone else
- not_decision_maker: Says they're not the right person
- needs_more_info: Interested but needs details first
- timing_issue: Interested but wrong timing
- budget_concern: Price-related concern
- competitor_mention: Mentions competitor
- spam_complaint: Complains about unsolicited email
- other: Doesn't fit above categories

2. SENTIMENT:
- positive, neutral, or negative
- Score (-100 to 100)

3. EXTRACTED ENTITIES:
- Requested information (if any)
- Proposed meeting time (if any)
- Objection type (if any)
- Competitor mentioned (if any)
- Referral contact info (if any)

4. RECOMMENDED ACTION:
- send_response: AI should respond
- book_meeting: Trigger meeting scheduler
- escalate_to_human: Needs human attention
- unenroll: Remove from sequence
- mark_as_converted: Won the deal
- pause_sequence: Hold sequence but keep enrolled
- ignore: No action needed
- schedule_callback: Add to follow-up list

5. CONFIDENCE (0-100):
How confident are you in this classification?

6. REQUIRES HUMAN REVIEW:
true/false - Does this need a human to review before responding?

Respond in JSON format:
{
  "intent": "...",
  "sentiment": "...",
  "sentimentScore": ...,
  "entities": {
    "requestedInfo": [],
    "meetingTime": null,
    "objectionType": null,
    "competitorMentioned": null
  },
  "suggestedAction": "...",
  "confidence": ...,
  "requiresHumanReview": ...,
  "reasoning": "..."
}`;
}

/**
 * Parse AI classification response
 */
function parseClassificationResponse(
  aiResponse: string,
  reply: EmailReply
): ReplyClassification {
  try {
    // Extract JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      intent: parsed.intent || 'other',
      sentiment: parsed.sentiment || 'neutral',
      sentimentScore: parsed.sentimentScore || 0,
      entities: parsed.entities || {},
      confidence: parsed.confidence || 50,
      suggestedAction: parsed.suggestedAction || 'escalate_to_human',
      requiresHumanReview: parsed.requiresHumanReview !== false, // Default to true for safety
      reasoning: parsed.reasoning || 'AI classification',
    };
  } catch (error) {
    logger.error('[Reply Handler] Failed to parse AI classification:', error, { file: 'reply-handler.ts' });
    return fallbackClassification(reply);
  }
}

/**
 * Fallback classification (rule-based)
 */
function fallbackClassification(reply: EmailReply): ReplyClassification {
  const bodyLower = reply.body.toLowerCase();
  const subjectLower = reply.subject.toLowerCase();

  // Check for out of office
  if (
    bodyLower.includes('out of office') ||
    bodyLower.includes('away from') ||
    bodyLower.includes('automatic reply') ||
    subjectLower.includes('out of office')
  ) {
    return {
      intent: 'out_of_office',
      sentiment: 'neutral',
      sentimentScore: 0,
      entities: {},
      confidence: 95,
      suggestedAction: 'ignore',
      requiresHumanReview: false,
      reasoning: 'Auto-detected out-of-office message',
    };
  }

  // Check for unsubscribe
  if (
    bodyLower.includes('unsubscribe') ||
    bodyLower.includes('remove me') ||
    bodyLower.includes('stop emailing') ||
    bodyLower.includes('not interested')
  ) {
    return {
      intent: 'unsubscribe',
      sentiment: 'negative',
      sentimentScore: -50,
      entities: {},
      confidence: 90,
      suggestedAction: 'unenroll',
      requiresHumanReview: false,
      reasoning: 'Unsubscribe request detected',
    };
  }

  // Check for interest
  if (
    bodyLower.includes('interested') ||
    bodyLower.includes('let\'s talk') ||
    bodyLower.includes('tell me more') ||
    bodyLower.includes('schedule') ||
    bodyLower.includes('meeting') ||
    bodyLower.includes('call')
  ) {
    return {
      intent: 'interested',
      sentiment: 'positive',
      sentimentScore: 70,
      entities: {},
      confidence: 75,
      suggestedAction: 'book_meeting',
      requiresHumanReview: true,
      reasoning: 'Positive interest signals detected',
    };
  }

  // Default to question
  return {
    intent: 'question',
    sentiment: 'neutral',
    sentimentScore: 0,
    entities: {},
    confidence: 40,
    suggestedAction: 'escalate_to_human',
    requiresHumanReview: true,
    reasoning: 'Unable to confidently classify - needs human review',
  };
}

/**
 * Generate AI response
 */
async function generateWithAI(
  reply: EmailReply,
  classification: ReplyClassification,
  context: ProspectContext
): Promise<GeneratedReply> {
  const prompt = buildReplyPrompt(reply, classification, context);

  const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');

  const response = await sendUnifiedChatMessage({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'user',
        content: prompt,
      }
    ],
    temperature: 0.7,
    maxTokens: 500,
  });

  return {
    subject: `Re: ${reply.subject}`,
    body: response.text.trim(),
    confidence: classification.confidence,
    requiresApproval: classification.requiresHumanReview,
    suggestedFollowUps: [],
  };
}

/**
 * Actually send the reply email
 */
export async function sendReplyEmail(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  threadId?: string
): Promise<{ success: boolean; error?: string }> {
  const { sendEmail } = await import('@/lib/email/sendgrid-service');
  
  return sendEmail({
    to,
    subject,
    html: body,
    tracking: {
      trackOpens: true,
      trackClicks: true,
    },
  });
}

/**
 * Build prompt for reply generation
 */
function buildReplyPrompt(
  reply: EmailReply,
  classification: ReplyClassification,
  context: ProspectContext
): string {
  return `You are a sales development representative responding to a prospect's email reply.

PROSPECT REPLY:
From: ${context.prospectName} at ${context.companyName}
${reply.body}

CLASSIFICATION:
Intent: ${classification.intent}
Sentiment: ${classification.sentiment}
Entities: ${JSON.stringify(classification.entities, null, 2)}

CONTEXT:
Original outreach: "${context.originalOutreach.body.substring(0, 200)}..."
Product/Service: ${context.product || 'Our platform'}
Value Proposition: ${context.valueProposition || 'help them grow'}

INSTRUCTIONS:
1. Address their ${classification.intent} professionally
2. ${classification.intent === 'question' ? 'Answer their questions thoroughly' : ''}
3. ${classification.intent === 'objection' ? 'Handle the objection with empathy' : ''}
4. ${classification.intent === 'interested' ? 'Propose next steps (meeting, demo, etc.)' : ''}
5. Keep it brief (3-4 sentences max)
6. Be helpful and human
7. Include a clear next step

Write only the email body. Don't include "Subject:" or email signature.`;
}

/**
 * Determine if reply should be sent automatically or requires approval
 */
export function shouldAutoSend(
  classification: ReplyClassification,
  confidenceThreshold: number = 85
): boolean {
  // Never auto-send if flagged for human review
  if (classification.requiresHumanReview) {
    return false;
  }

  // Never auto-send for certain intents (risky)
  const riskyIntents: ReplyIntent[] = [
    'spam_complaint',
    'not_decision_maker',
    'competitor_mention',
    'budget_concern',
  ];

  if (riskyIntents.includes(classification.intent)) {
    return false;
  }

  // Only auto-send if confidence is high enough
  if (classification.confidence < confidenceThreshold) {
    return false;
  }

  // Safe intents can auto-send
  const safeIntents: ReplyIntent[] = [
    'out_of_office',      // Can ignore
    'meeting_request',    // Can book meeting
    'question',           // Can answer questions
  ];

  return safeIntents.includes(classification.intent);
}

