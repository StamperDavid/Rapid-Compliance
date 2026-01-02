/**
 * Email Templates - Pre-built Sales Email Structures
 * 
 * Defines 5 core sales email types with proven structures:
 * 1. Intro Email - First contact with prospect
 * 2. Follow-up Email - After initial contact or meeting
 * 3. Proposal Email - Sending proposal/pricing
 * 4. Close Email - Final push before decision
 * 5. Re-engagement Email - Revive cold/stalled deals
 * 
 * Each template includes:
 * - Structure (sections to include)
 * - Key points (what to cover)
 * - Best practice category (for industry template integration)
 * - Example structure
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Email Type
 */
export type EmailType = 'intro' | 'follow-up' | 'proposal' | 'close' | 're-engagement';

/**
 * Email Template
 */
export interface EmailTemplate {
  id: EmailType;
  name: string;
  description: string;
  goal: string; // What this email aims to achieve
  
  structure: string[]; // Sections of the email
  keyPoints: string[]; // Key points to include
  bestPracticeCategory: 'qualification' | 'discovery' | 'presentation' | 'negotiation' | 'closing';
  
  examples: string[]; // Example emails for AI reference
  
  // Timing guidance
  bestTiming: string; // When to send this email
  
  // CTA guidance
  ctaExamples: string[]; // Example calls-to-action
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Intro Email Template
 * 
 * First contact with a prospect. Goal is to pique interest and get a response.
 * 
 * Best for:
 * - Cold outreach
 * - Warm introductions
 * - Conference follow-ups
 */
export const INTRO_EMAIL_TEMPLATE: EmailTemplate = {
  id: 'intro',
  name: 'Introduction Email',
  description: 'First contact email to introduce yourself and your solution',
  goal: 'Get a response and schedule a discovery call',
  
  structure: [
    'Personalized opening (mention specific trigger/insight about their company)',
    'Brief introduction (who you are, why you\'re reaching out)',
    'Value proposition (the problem you solve)',
    'Social proof (1-2 customers like them)',
    'Clear, low-friction CTA (15-min call, not demo)',
  ],
  
  keyPoints: [
    'Mention something specific about their company (recent news, job posting, etc.)',
    'Focus on their pain point, not your product features',
    'Keep it short (under 100 words)',
    'One clear CTA (don\'t give multiple options)',
    'Make it easy to say yes (offer specific times)',
  ],
  
  bestPracticeCategory: 'qualification',
  
  bestTiming: 'Tuesday-Thursday, 8-10am or 2-4pm in recipient\'s timezone',
  
  ctaExamples: [
    'Are you available for a 15-minute call this Thursday at 2pm?',
    'Would a quick 10-minute conversation next week make sense?',
    'Can we grab 15 minutes on Tuesday to discuss this?',
    'Are you open to a brief chat about how we could help with [specific pain]?',
  ],
  
  examples: [
    `Subject: Quick question about [Company]'s [specific initiative]

Hi [Name],

I noticed [Company] recently [specific trigger - funding, expansion, job posting, etc.]. Congrats!

We help companies like [Similar Customer] solve [specific pain point] by [unique approach]. They saw [specific result] in [timeframe].

Would a quick 15-minute call make sense to explore if we could help [Company] achieve [similar outcome]?

If so, I'm available Thursday at 2pm or Friday at 10am. Would either work?

Best,
[Your Name]

P.S. Here's a 2-minute video of how we helped [Customer]: [link]`,
  ],
};

/**
 * Follow-up Email Template
 * 
 * After initial contact, meeting, or demo. Goal is to maintain momentum.
 * 
 * Best for:
 * - Post-meeting follow-up
 * - After demo/presentation
 * - Non-response follow-up
 */
export const FOLLOWUP_EMAIL_TEMPLATE: EmailTemplate = {
  id: 'follow-up',
  name: 'Follow-up Email',
  description: 'Follow-up after initial contact or meeting',
  goal: 'Maintain momentum and move deal forward',
  
  structure: [
    'Reference previous interaction',
    'Recap key points/next steps discussed',
    'Provide value (answer questions, share resources)',
    'Address potential objections proactively',
    'Clear next step with deadline',
  ],
  
  keyPoints: [
    'Be specific about what was discussed',
    'Add value (don\'t just check in)',
    'Reference timeline discussed',
    'Make next step crystal clear',
    'Create gentle urgency (limited spots, pricing ending, etc.)',
  ],
  
  bestPracticeCategory: 'discovery',
  
  bestTiming: 'Same day after meeting (within 2 hours) or 2-3 days after no response',
  
  ctaExamples: [
    'Based on our conversation, does [next step] by [date] work for you?',
    'To hit your [goal] timeline, we should [action] by [date]. Does that work?',
    'I\'ve attached the ROI analysis we discussed. When can we review it together?',
    'Ready to move forward? Let\'s get you onboarded by [date].',
  ],
  
  examples: [
    `Subject: Re: [Company] + [Your Company] - Next Steps

Hi [Name],

Great connecting yesterday! I loved hearing about your goal to [their goal] by [timeline].

As discussed, I'm attaching:
1. ROI calculator showing your potential [X]% improvement
2. Case study: How [Similar Company] achieved [result] in [timeframe]
3. Implementation timeline (8 weeks to full deployment)

One thing you mentioned - "[their concern]" - I want to address:
[2-3 sentences addressing the concern with proof]

To hit your [goal] timeline, we should [next step] by [date]. Does that work?

I've reserved a slot for Thursday at 2pm to walk through the implementation plan. Confirm?

Best,
[Your Name]

P.S. I'm also sending over the security documentation you requested.`,
  ],
};

/**
 * Proposal Email Template
 * 
 * Sending formal proposal or pricing. Goal is to get approval.
 * 
 * Best for:
 * - Pricing proposals
 * - Contract/SOW sharing
 * - Final terms negotiation
 */
export const PROPOSAL_EMAIL_TEMPLATE: EmailTemplate = {
  id: 'proposal',
  name: 'Proposal Email',
  description: 'Send proposal or pricing information',
  goal: 'Get proposal approved and move to contracts',
  
  structure: [
    'Recap business challenge and desired outcomes',
    'Summarize proposed solution and value',
    'Highlight ROI/business case',
    'Explain pricing/investment clearly',
    'Outline next steps and timeline',
  ],
  
  keyPoints: [
    'Frame as investment, not cost',
    'Tie pricing to ROI and outcomes',
    'Make proposal easy to understand (executive summary)',
    'Include social proof (similar customers)',
    'Create urgency (limited-time discount, Q4 goals, etc.)',
  ],
  
  bestPracticeCategory: 'presentation',
  
  bestTiming: 'Beginning of week (Monday/Tuesday) to allow time for internal review',
  
  ctaExamples: [
    'Can we schedule 30 minutes this week to review and answer questions?',
    'What questions do you have about the proposal?',
    'Are you ready to move forward? We can start implementation next week.',
    'Who else needs to review this on your team? Happy to present it to them.',
  ],
  
  examples: [
    `Subject: [Company] Proposal - [X]% ROI in [Timeframe]

Hi [Name],

Attached is our proposal to help [Company] achieve [specific goal] by [timeline].

EXECUTIVE SUMMARY:
- Challenge: [Their pain point]
- Solution: [Your solution in 1 sentence]
- Expected ROI: [X]% improvement in [metric]
- Investment: $[amount] ([monthly/annually])
- Timeline: [X] weeks to full deployment

WHY THIS MAKES SENSE:
Based on [Similar Company]'s results, you should see:
- [Benefit 1]: [Specific metric improvement]
- [Benefit 2]: [Specific metric improvement]
- [Benefit 3]: [Specific metric improvement]

This means $[amount] in additional revenue/savings in year 1.

INVESTMENT:
- $[amount]/month (or $[annual] annually - save 20%)
- Includes: [Key deliverables]
- Starts: [Date]

NEXT STEPS:
If this looks good, we can:
1. Finalize agreement by [date]
2. Kick off implementation [date]
3. Go live by [date]

I've reserved 30 minutes on Thursday at 2pm to review together. Does that work?

Looking forward to partnering with [Company]!

Best,
[Your Name]

P.S. The 20% annual discount expires [date], so let's aim to finalize by then.`,
  ],
};

/**
 * Close Email Template
 * 
 * Final push before decision. Goal is to close the deal.
 * 
 * Best for:
 * - Deals in final stage
 * - After all objections addressed
 * - Getting verbal or written commitment
 */
export const CLOSE_EMAIL_TEMPLATE: EmailTemplate = {
  id: 'close',
  name: 'Closing Email',
  description: 'Final push to close the deal',
  goal: 'Get signed contract and close the deal',
  
  structure: [
    'Acknowledge progress made together',
    'Recap value and ROI one final time',
    'Address any lingering concerns',
    'Create urgency (deadline, limited availability)',
    'Ask for the business directly',
  ],
  
  keyPoints: [
    'Be direct - ask for the business',
    'Summarize all the work done together',
    'Remind them of timeline pressure (their goals, not yours)',
    'Make signing easy (DocuSign link, clear steps)',
    'Confidence, not desperation',
  ],
  
  bestPracticeCategory: 'closing',
  
  bestTiming: 'End of month/quarter when budgets are being allocated',
  
  ctaExamples: [
    'Are you ready to move forward? I can send the contract today.',
    'Let\'s get you started. I\'ve prepared the agreement - can you review today?',
    'I\'m confident this will deliver the results you need. Ready to sign?',
    'Shall we proceed? I can have everything ready for your signature by EOD.',
  ],
  
  examples: [
    `Subject: Ready to move forward with [Company] + [Your Company]?

Hi [Name],

We've been working together for [timeframe] to solve [pain point]. I'm confident we're the right partner for [Company].

Here's what we've accomplished together:
✓ Identified [X]% potential improvement in [metric]
✓ Aligned on [key requirement/feature]
✓ Got buy-in from [stakeholders]
✓ Addressed [key objection]

To hit your [goal] by [timeline], we need to start by [date] - which means finalizing the agreement this week.

I've prepared everything:
- Contract ready for signature (sent via DocuSign)
- Implementation team reserved for [start date]
- Onboarding plan tailored to [Company]

Are you ready to move forward? 

If so, please review and sign the contract by [deadline]. I'll personally ensure we hit your [timeline] goal.

If you have any last questions, I'm available for a call today at [time] or tomorrow at [time].

Looking forward to making [Company] a success story!

Best,
[Your Name]

P.S. We have limited implementation slots for [month], so let's lock in your start date.`,
  ],
};

/**
 * Re-engagement Email Template
 * 
 * Revive cold or stalled deals. Goal is to restart conversation.
 * 
 * Best for:
 * - Deals gone dark
 * - Lost deals to revisit
 * - Inactive prospects
 */
export const REENGAGEMENT_EMAIL_TEMPLATE: EmailTemplate = {
  id: 're-engagement',
  name: 'Re-engagement Email',
  description: 'Revive cold or stalled deals',
  goal: 'Restart conversation and re-qualify',
  
  structure: [
    'Acknowledge the silence (no guilt trip)',
    'Provide new value/reason to reconnect',
    'Make it easy to re-engage (breakup email technique)',
    'Low-friction ask (yes/no question)',
    'Graceful exit option',
  ],
  
  keyPoints: [
    'Don\'t be needy or desperate',
    'Provide new value (product update, case study, industry insight)',
    'Permission to close - "Is this still a priority?"',
    'Make it easy to say no',
    'Trigger: timing, new feature, competitive threat, industry change',
  ],
  
  bestPracticeCategory: 'qualification',
  
  bestTiming: '3-6 months after last contact, or when there\'s a relevant trigger',
  
  ctaExamples: [
    'Is [goal] still a priority for [Company]? If not, I\'ll close my file.',
    'Should I follow up in Q1, or is this off the table?',
    'Quick question: Still planning to [goal], or has that changed?',
    'Worth a conversation, or should I check back in [timeframe]?',
  ],
  
  examples: [
    `Subject: Is [Company]'s [goal] still a priority?

Hi [Name],

I know we talked a few months ago about [goal], but I haven't heard back.

I wanted to reach out because:
1. We just launched [new feature] that directly addresses [their pain]
2. [Similar Company] achieved [result] using it
3. Your timeline for [goal] is coming up in [timeframe]

Two questions:
1. Is [goal] still a priority for [Company]?
2. If yes, does a quick 15-minute call make sense?

If timing isn't right, no problem - just let me know and I'll check back in [timeframe].

Either way, hope you're well!

Best,
[Your Name]

P.S. If I don't hear back, I'll assume this isn't a priority and close my file. No hard feelings!`,

    `Subject: New data: [X]% improvement now possible for [Company]

Hi [Name],

I know we spoke back in [month] about improving [metric] at [Company].

Wanted to share: [Similar Company] just achieved [specific result] in [timeframe] using our platform. Given your similar challenges with [pain point], thought this might interest you.

The key difference? They focused on [specific approach].

Worth a 10-minute conversation to see if this applies to [Company]?

If not, no worries - I'll stop bothering you!

Best,
[Your Name]`,
  ],
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * All email templates by type
 */
export const EMAIL_TEMPLATES: Record<EmailType, EmailTemplate> = {
  intro: INTRO_EMAIL_TEMPLATE,
  'follow-up': FOLLOWUP_EMAIL_TEMPLATE,
  proposal: PROPOSAL_EMAIL_TEMPLATE,
  close: CLOSE_EMAIL_TEMPLATE,
  're-engagement': REENGAGEMENT_EMAIL_TEMPLATE,
};

/**
 * Get email template by type
 */
export function getEmailTemplate(type: EmailType): EmailTemplate {
  const template = EMAIL_TEMPLATES[type];
  
  if (!template) {
    throw new Error(`Email template not found: ${type}`);
  }
  
  return template;
}

/**
 * Get all email template types
 */
export function getAllEmailTypes(): EmailType[] {
  return Object.keys(EMAIL_TEMPLATES) as EmailType[];
}

/**
 * Get email template recommendations based on deal score
 */
export function getRecommendedEmailType(params: {
  dealScore: number;
  dealTier: 'hot' | 'warm' | 'cold' | 'at-risk';
  lastContactDays?: number;
  hasHadDemo?: boolean;
  hasProposal?: boolean;
}): EmailType {
  const { dealScore, dealTier, lastContactDays = 0, hasHadDemo = false, hasProposal = false } = params;
  
  // Re-engagement: No contact in 30+ days
  if (lastContactDays > 30) {
    return 're-engagement';
  }
  
  // Close: Hot deal with proposal
  if (dealTier === 'hot' && hasProposal && dealScore >= 80) {
    return 'close';
  }
  
  // Proposal: Warm deal after demo
  if ((dealTier === 'hot' || dealTier === 'warm') && hasHadDemo && !hasProposal) {
    return 'proposal';
  }
  
  // Follow-up: After demo or recent contact
  if (hasHadDemo || lastContactDays <= 7) {
    return 'follow-up';
  }
  
  // Intro: New or cold deal
  return 'intro';
}
