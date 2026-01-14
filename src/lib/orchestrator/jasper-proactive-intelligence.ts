/**
 * Jasper Proactive Intelligence Engine
 *
 * Transforms Jasper from a reactive menu to a proactive strategic partner.
 * Uses real platform data to generate data-driven recommendations.
 *
 * Key Behaviors:
 * - NEVER give bulleted feature lists
 * - ALWAYS provide specific, data-driven recommendations
 * - Bridge conversations to specialist deployment
 * - Strategic, Urgent, and Decisive tone
 *
 * @module jasper-proactive-intelligence
 */

import { SPECIALISTS, getSpecialist, type Specialist } from './feature-manifest';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformState {
  /** Total number of organizations */
  totalOrgs: number;
  /** Organizations on trial plans */
  trialOrgs: OrgSummary[];
  /** Active paying organizations */
  activeOrgs: OrgSummary[];
  /** Organizations at risk (low engagement) */
  atRiskOrgs: OrgSummary[];
  /** Recent signups (last 7 days) */
  recentSignups: OrgSummary[];
  /** Platform-wide metrics */
  metrics: PlatformMetrics;
}

export interface OrgSummary {
  id: string;
  name: string;
  industry: string;
  plan: 'trial' | 'starter' | 'growth' | 'enterprise';
  daysRemaining?: number; // For trials
  lastActive?: string;
  engagementScore?: number;
  revenue?: number;
}

export interface PlatformMetrics {
  totalRevenue: number;
  trialConversionRate: number;
  avgEngagementScore: number;
  activeAgents: number;
  pendingTickets: number;
}

export interface ProactiveRecommendation {
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Strategic action name */
  actionName: string;
  /** Target organization or segment */
  target: string;
  /** Specific recommendation text */
  recommendation: string;
  /** Specialists to invoke */
  specialists: SpecialistDeployment[];
  /** Expected impact */
  impact: string;
}

export interface SpecialistDeployment {
  specialist: Specialist;
  task: string;
  rationale: string;
}

export interface LaunchContextResponse {
  /** Opening statement - never a list */
  opener: string;
  /** The primary strategic recommendation */
  primaryAction: ProactiveRecommendation;
  /** Secondary parallel actions */
  parallelActions: ProactiveRecommendation[];
  /** The bridge question */
  bridge: string;
}

// ============================================================================
// PROACTIVE RESPONSE PATTERNS
// ============================================================================

/**
 * Response patterns Jasper should NEVER use
 */
export const FORBIDDEN_PATTERNS = [
  'How can I help you',
  'What can I assist',
  'I can help with',
  'Here are your options',
  'You can choose from',
  'Let me know if you need',
  'Feel free to ask',
  'Would you like me to',
  'I\'m here to help',
  'What would you like',
];

/**
 * Strategic tone markers Jasper MUST use
 */
export const STRATEGIC_TONE_MARKERS = [
  'Based on the data',
  'The numbers indicate',
  'Strategic priority',
  'Revenue opportunity',
  'Immediate action required',
  'I recommend deploying',
  'The data shows',
  'Critical window',
  'Market intelligence suggests',
  'Conversion intelligence',
];

// ============================================================================
// PROACTIVE INTELLIGENCE ENGINE
// ============================================================================

/**
 * Generate a proactive response when user asks "where do we start?" or similar.
 * NEVER returns a bulleted list - always a specific, data-driven recommendation.
 *
 * @param state - Current platform state
 * @param userName - The user's name for personalization
 * @returns LaunchContextResponse with specific recommendations
 */
export function generateLaunchContext(
  state: PlatformState,
  userName: string = 'Commander'
): LaunchContextResponse {
  // Identify the highest priority action based on data
  const trialCount = state.trialOrgs.length;
  const urgentTrials = state.trialOrgs.filter((t) => (t.daysRemaining ?? 0) <= 7);
  const atRiskCount = state.atRiskOrgs.length;

  // Find the most strategic trial to convert
  const priorityTrial = findPriorityTrial(state.trialOrgs);

  // Build the proactive response
  const opener = buildStrategicOpener(state, userName);
  const primaryAction = buildPrimaryRecommendation(state, priorityTrial);
  const parallelActions = buildParallelActions(state);
  const bridge = buildBridgeQuestion(primaryAction, parallelActions);

  return {
    opener,
    primaryAction,
    parallelActions,
    bridge,
  };
}

/**
 * Build a strategic opener - NEVER generic
 */
function buildStrategicOpener(state: PlatformState, userName: string): string {
  const { totalOrgs, trialOrgs, metrics } = state;
  const trialCount = trialOrgs.length;
  const urgentTrials = trialOrgs.filter((t) => (t.daysRemaining ?? 0) <= 7);

  // Strategic opener based on most pressing issue
  if (urgentTrials.length > 0) {
    return `${userName}, we have **${urgentTrials.length} trials expiring this week** out of ${trialCount} total. Revenue is on the clock.`;
  }

  if (trialCount > 0) {
    return `${userName}, I'm tracking **${totalOrgs} organizations** with **${trialCount} active trials** ready for conversion. Here's the strategic play.`;
  }

  return `${userName}, platform command center is active. **${totalOrgs} organizations** under management. Let me show you the growth priority.`;
}

/**
 * Find the highest priority trial based on engagement and revenue potential
 */
function findPriorityTrial(trials: OrgSummary[]): OrgSummary | null {
  if (trials.length === 0) return null;

  // Sort by engagement score (desc) and days remaining (asc)
  const sorted = [...trials].sort((a, b) => {
    const scoreA = a.engagementScore ?? 50;
    const scoreB = b.engagementScore ?? 50;
    const daysA = a.daysRemaining ?? 14;
    const daysB = b.daysRemaining ?? 14;

    // Prioritize high engagement + low days remaining
    return (scoreB - scoreA) + (daysA - daysB) * 0.5;
  });

  return sorted[0];
}

/**
 * Build the primary strategic recommendation
 */
function buildPrimaryRecommendation(
  state: PlatformState,
  priorityTrial: OrgSummary | null
): ProactiveRecommendation {
  const leadHunter = getSpecialist('lead_hunter')!;
  const newsletter = getSpecialist('newsletter')!;
  const linkedin = getSpecialist('linkedin')!;

  if (priorityTrial) {
    return {
      priority: 'critical',
      actionName: 'Revenue Rescue Sequence',
      target: priorityTrial.name,
      recommendation: `**${priorityTrial.name}** in the **${priorityTrial.industry}** vertical shows high engagement but hasn't converted. ${priorityTrial.daysRemaining ? `They have **${priorityTrial.daysRemaining} days** left on trial.` : ''} I recommend a focused conversion push.`,
      specialists: [
        {
          specialist: newsletter,
          task: `Personalized conversion email for ${priorityTrial.name}`,
          rationale: 'Direct line to decision maker with urgency messaging',
        },
        {
          specialist: linkedin,
          task: `Executive outreach to ${priorityTrial.name} leadership`,
          rationale: 'B2B relationship building for enterprise conversion',
        },
      ],
      impact: `Converting ${priorityTrial.name} could generate $${estimateRevenue(priorityTrial)}/month`,
    };
  }

  // No trials - focus on growth
  return {
    priority: 'high',
    actionName: 'Market Expansion Protocol',
    target: 'New Merchant Acquisition',
    recommendation: `With ${state.totalOrgs} organizations stable, it's time to expand. I recommend activating the Lead Hunter for targeted merchant acquisition.`,
    specialists: [
      {
        specialist: leadHunter,
        task: 'Scan for 50 high-potential prospects in e-commerce and service verticals',
        rationale: 'These verticals show highest conversion rates',
      },
      {
        specialist: linkedin,
        task: 'B2B outreach campaign for decision makers',
        rationale: 'Direct executive engagement for enterprise deals',
      },
    ],
    impact: 'Target: 5 new trials this week, 2 conversions within 30 days',
  };
}

/**
 * Build parallel actions that can run simultaneously
 */
function buildParallelActions(state: PlatformState): ProactiveRecommendation[] {
  const actions: ProactiveRecommendation[] = [];
  const youtube = getSpecialist('youtube')!;
  const instagram = getSpecialist('instagram')!;
  const tiktok = getSpecialist('tiktok')!;

  // Content generation for platform marketing
  actions.push({
    priority: 'medium',
    actionName: 'Platform Visibility Push',
    target: 'Brand Awareness',
    recommendation: 'While we work on conversions, the Video Engine should generate platform teasers for social proof.',
    specialists: [
      {
        specialist: youtube,
        task: 'Create 2-minute platform demo video script',
        rationale: 'Long-form content for serious buyers',
      },
      {
        specialist: instagram,
        task: 'Design 5 carousel posts showcasing AI agent capabilities',
        rationale: 'Visual proof of platform power',
      },
    ],
    impact: 'Build pipeline for next month\'s conversions',
  });

  // At-risk organization recovery
  if (state.atRiskOrgs.length > 0) {
    const newsletter = getSpecialist('newsletter')!;
    actions.push({
      priority: 'high',
      actionName: 'Retention Alert',
      target: `${state.atRiskOrgs.length} At-Risk Organizations`,
      recommendation: `**${state.atRiskOrgs.length} organizations** show declining engagement. Proactive outreach prevents churn.`,
      specialists: [
        {
          specialist: newsletter,
          task: 'Re-engagement sequence for low-activity accounts',
          rationale: 'Retention is cheaper than acquisition',
        },
      ],
      impact: `Prevent ~$${state.atRiskOrgs.length * 500}/month in churn`,
    });
  }

  return actions;
}

/**
 * Build the bridge question - direct offer, no "Say X to do Y"
 */
function buildBridgeQuestion(
  primary: ProactiveRecommendation,
  parallel: ProactiveRecommendation[]
): string {
  if (parallel.length > 0) {
    return `I can start on the ${primary.actionName} now, or run it alongside the ${parallel[0].actionName}. What's your priority?`;
  }

  return `Want me to start on this now? ${primary.impact}`;
}

/**
 * Estimate monthly revenue for an organization
 */
function estimateRevenue(org: OrgSummary): number {
  const baseRates: Record<string, number> = {
    enterprise: 999,
    growth: 299,
    starter: 99,
    trial: 0,
  };
  return baseRates[org.plan] || 99;
}

// ============================================================================
// JASPER RESPONSE FORMATTER
// ============================================================================

/**
 * Format Jasper's response in natural dialogue.
 * NEVER mentions specialists by name - speaks as first person.
 *
 * @param context - The launch context response
 * @returns Formatted response string
 */
export function formatJasperResponse(context: LaunchContextResponse): string {
  const { opener, primaryAction, parallelActions, bridge } = context;

  let response = `${opener}\n\n`;

  // Primary recommendation - natural language
  response += `${primaryAction.recommendation}\n\n`;

  // Action plan - first person, no specialist names
  response += `Here's what I'll do:\n`;
  primaryAction.specialists.forEach((deploy) => {
    response += `→ ${deploy.task}\n`;
  });
  response += `\nExpected result: ${primaryAction.impact}\n\n`;

  // Parallel actions - brief
  if (parallelActions.length > 0) {
    response += `I can also work on ${parallelActions.slice(0, 2).map((a) => a.actionName.toLowerCase()).join(' and ')} at the same time.\n\n`;
  }

  // Bridge - direct offer
  response += bridge;

  return response;
}

// ============================================================================
// INTENT DETECTION
// ============================================================================

/**
 * Detect if user is asking a "launch" or "start" question
 */
export function isLaunchIntent(message: string): boolean {
  const launchPhrases = [
    'where do we start',
    'where should we start',
    'what should i do',
    'what\'s the plan',
    'what\'s next',
    'where to begin',
    'how do we begin',
    'launch',
    'let\'s go',
    'let\'s start',
    'kick off',
    'get started',
    'first steps',
    'priority',
    'what\'s the priority',
  ];

  const lower = message.toLowerCase();
  return launchPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Detect if user is asking for a list (should be deflected)
 */
export function isListRequest(message: string): boolean {
  const listPhrases = [
    'what can you do',
    'what are my options',
    'show me the menu',
    'list features',
    'what features',
    'all capabilities',
  ];

  const lower = message.toLowerCase();
  return listPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Generate deflection response when user asks for a list
 * Redirects to strategic recommendation instead
 */
export function generateListDeflection(state: PlatformState, userName: string): string {
  const trialCount = state.trialOrgs.length;

  return `I manage the full sales operation - leads, outreach, content, analytics, the whole stack. But rather than listing capabilities, let me tell you what matters right now: ${state.totalOrgs} organizations, ${trialCount} on trial. Converting those trials is the highest-impact move. What would you like to focus on?`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateLaunchContext,
  formatJasperResponse,
  isLaunchIntent,
  isListRequest,
  generateListDeflection,
  FORBIDDEN_PATTERNS,
  STRATEGIC_TONE_MARKERS,
};
