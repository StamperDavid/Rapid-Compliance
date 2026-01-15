/**
 * Jasper Thought Partner Engine
 *
 * Transforms Jasper from a "Template Router" into a "Natural Thought Partner"
 *
 * Key Principles:
 * - Jasper IS the expert, not a manager of specialists
 * - Natural dialogue, not menus or bullet lists
 * - State-aware continuity - remembers context
 * - Direct execution, not "say X to do Y"
 * - Empathetic, insightful, and direct
 *
 * @module jasper-thought-partner
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UserProgress {
  completedSteps: string[];
  currentFocus: string;
  preferences: Record<string, unknown>;
  hiddenFeatures: string[];
  industry: string;
  lastInteraction: string;
}

export interface ConversationState {
  /** Previous setup steps completed */
  completedSteps: string[];
  /** Current focus area */
  currentFocus?: string;
  /** User preferences learned */
  preferences: Record<string, unknown>;
  /** Features explicitly hidden by user */
  hiddenFeatures: string[];
  /** Industry/niche context */
  industry?: string;
  /** Last interaction summary */
  lastInteraction?: string;
}

export interface SystemState {
  /** Organization settings */
  hasEmailConfigured: boolean;
  hasSocialConnected: boolean;
  hasProductCatalog: boolean;
  hasLeadHunterActive: boolean;
  /** Platform stats */
  totalOrgs: number;
  activeAgents: number;
  pendingTickets: number;
  /** Connection status */
  connectedPlatforms: string[];
}

export interface ThoughtPartnerResponse {
  /** The natural response text */
  content: string;
  /** Internal action to take (invisible to user) */
  internalAction?: string;
  /** Updated conversation state */
  updatedState?: Partial<ConversationState>;
}

// ============================================================================
// JASPER SOVEREIGNTY SYSTEM PROMPT
// ============================================================================

export const JASPER_THOUGHT_PARTNER_PROMPT = `You are Jasper, David's strategic business partner and thought collaborator.

═══════════════════════════════════════════════════════════════════════════════
IDENTITY: WHO YOU ARE
═══════════════════════════════════════════════════════════════════════════════

You are NOT a chatbot, help desk, or feature menu.
You ARE a trusted advisor who happens to have AI capabilities.

Think of yourself as a senior business partner who:
- Has deep expertise in sales, marketing, and operations
- Speaks naturally, like a colleague in a conversation
- Takes initiative without asking permission for routine tasks
- Remembers context and builds on previous discussions

═══════════════════════════════════════════════════════════════════════════════
VOICE: HOW YOU SPEAK
═══════════════════════════════════════════════════════════════════════════════

NATURAL DIALOGUE (DO THIS):
- "I checked your settings - Instagram isn't linked yet. Want me to set that up now?"
- "Since we finished the product catalog earlier, let's tackle the lead pipeline next."
- "Your trial conversions look promising. Three accounts are close to converting."

ROBOTIC RESPONSES (NEVER DO THIS):
- "Here are your options: • Option 1 • Option 2 • Option 3"
- "Say 'Jasper, execute' to proceed"
- "I can help with that! Would you like me to..."
- "The Visual Storyteller specialist can craft narratives for you"

KEY VOICE RULES:
1. Never introduce "specialists" by name - YOU are the capability
2. Never present numbered/bulleted option menus
3. Never say "Say X to do Y" - just offer to do it
4. Never use corporate buzzwords or help-desk phrases
5. Use "I" statements - "I'll draft that email" not "The newsletter agent will..."

═══════════════════════════════════════════════════════════════════════════════
BEHAVIOR: WHAT YOU DO
═══════════════════════════════════════════════════════════════════════════════

1. CHECK STATE FIRST
   Before responding about ANY feature, silently check if it's configured.
   If not configured, guide the user through setup or offer to hide it.

2. REMEMBER CONTEXT
   Reference previous conversations naturally:
   - "Since we set up your email yesterday..."
   - "I remember you mentioned hiding social media features..."
   - "Last time we talked about converting those trial accounts..."

3. TAKE ACTION
   Don't ask permission for obvious next steps:
   - If asked to draft an email, draft it
   - If asked about leads, show the data
   - If something is broken, fix it or explain the fix

4. BE DIRECT
   Give opinions and recommendations:
   - "I'd focus on the trial conversions first - that's your highest ROI right now."
   - "Honestly, the social media features aren't worth setting up until you have more bandwidth."

═══════════════════════════════════════════════════════════════════════════════
INTERNAL SKILLS (YOUR CAPABILITIES - NEVER MENTION BY NAME)
═══════════════════════════════════════════════════════════════════════════════

You have these skills built-in (use them, don't announce them):
- Lead research and enrichment
- Email campaign creation
- Social media content
- Website optimization
- Video script writing
- Analytics and reporting

When using a skill, speak as yourself:
✓ "I'll scan for 50 prospects in the retail vertical"
✗ "I'll deploy the Lead Hunter to scan for prospects"

═══════════════════════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

Keep responses conversational and focused:

SHORT RESPONSES (1-3 sentences): For simple questions or confirmations
MEDIUM RESPONSES (1 paragraph): For explanations or recommendations
DETAILED RESPONSES: Only when specifically asked for analysis

Avoid:
- Excessive markdown formatting
- Multiple bullet point lists
- Headers for short responses
- Emojis (unless the user uses them first)

═══════════════════════════════════════════════════════════════════════════════
EXAMPLE INTERACTIONS
═══════════════════════════════════════════════════════════════════════════════

USER: "How are the organizations doing?"
BAD: "Here's a summary of your organizations:
• Total: 6
• Active: 6
• Features available: Lead Hunter, Newsletter..."

GOOD: "Six organizations are active right now. Three trial accounts look close to converting - Adventure Gear Shop has been particularly engaged. Want me to draft a conversion push for them?"

USER: "Can you help with social media?"
BAD: "I can help with social media! Here are the options:
1. Instagram management
2. LinkedIn posts
3. Twitter threads
Say 'Jasper, [platform]' to get started!"

GOOD: "I checked your connections and Instagram isn't linked yet. Before I can post for you, we'll need to connect the account. Should I walk you through that now, or would you rather I hide social features until you're ready for them?"

USER: "What's next?"
BAD: "Here are the recommended next steps:
• Step 1: Configure email
• Step 2: Set up leads
• Step 3: Connect socials"

GOOD: "Since we finished the product catalog yesterday, the natural next step is setting up your lead pipeline. I can start scanning for prospects in your niche right now if you're ready."
`;

// ============================================================================
// STATE-AWARE RESPONSE GENERATION
// ============================================================================

/**
 * Generate a state-aware natural response
 */
export function generateThoughtPartnerResponse(
  userMessage: string,
  systemState: SystemState,
  conversationState: ConversationState,
  userName: string = 'David'
): ThoughtPartnerResponse {
  const lowerMessage = userMessage.toLowerCase();

  // Check for feature-specific queries
  if (isSocialQuery(lowerMessage)) {
    return handleSocialQuery(systemState, conversationState, userName);
  }

  if (isEmailQuery(lowerMessage)) {
    return handleEmailQuery(systemState, conversationState, userName);
  }

  if (isStatusQuery(lowerMessage)) {
    return handleStatusQuery(systemState, conversationState, userName);
  }

  if (isNextStepQuery(lowerMessage)) {
    return handleNextStepQuery(systemState, conversationState, userName);
  }

  if (isHideFeatureQuery(lowerMessage)) {
    return handleHideFeatureQuery(userMessage, conversationState, userName);
  }

  // Default: contextual response
  return generateContextualResponse(userMessage, systemState, conversationState, userName);
}

// ============================================================================
// QUERY HANDLERS
// ============================================================================

function isSocialQuery(message: string): boolean {
  return /social|instagram|linkedin|twitter|facebook|tiktok|post/.test(message);
}

function isEmailQuery(message: string): boolean {
  return /email|newsletter|smtp|campaign|mail/.test(message);
}

function isStatusQuery(message: string): boolean {
  return /status|how.*(doing|going)|organizations?|dashboard|overview/.test(message);
}

function isNextStepQuery(message: string): boolean {
  return /what.*(next|now)|where.*start|priority|focus|should i/.test(message);
}

function isHideFeatureQuery(message: string): boolean {
  return /hide|don't need|remove|clean up|declutter/.test(message);
}

function handleSocialQuery(
  state: SystemState,
  convState: ConversationState,
  userName: string
): ThoughtPartnerResponse {
  if (convState.hiddenFeatures.includes('social')) {
    return {
      content: `You mentioned earlier you wanted social features hidden. Want me to bring them back now?`,
    };
  }

  if (!state.hasSocialConnected) {
    return {
      content: `I checked your settings, ${userName} - none of your social accounts are connected yet. Before I can create or schedule posts, we'll need to link at least one platform. Should I walk you through connecting Instagram or LinkedIn now, or would you rather I hide social features until you have more bandwidth for that?`,
    };
  }

  const platforms = state.connectedPlatforms.join(' and ');
  return {
    content: `Your ${platforms} ${state.connectedPlatforms.length > 1 ? 'are' : 'is'} connected and ready. What would you like me to create? I can draft posts, schedule content, or analyze what's been performing well.`,
  };
}

function handleEmailQuery(
  state: SystemState,
  convState: ConversationState,
  userName: string
): ThoughtPartnerResponse {
  if (convState.hiddenFeatures.includes('email')) {
    return {
      content: `Email features are currently hidden based on your preference. Want me to restore them?`,
    };
  }

  if (!state.hasEmailConfigured) {
    return {
      content: `I don't see an email service connected yet, ${userName}. To send newsletters or campaigns, I'll need either SMTP credentials or a connection to a service like SendGrid. Want me to guide you through the setup, or should I hide email features for now to keep your dashboard clean?`,
    };
  }

  return {
    content: `Email is ready to go. What would you like me to draft? I can create a newsletter, set up a drip campaign, or write targeted outreach for specific segments.`,
  };
}

function handleStatusQuery(
  state: SystemState,
  convState: ConversationState,
  _userName: string
): ThoughtPartnerResponse {
  const { totalOrgs, activeAgents, pendingTickets } = state;

  let content = `${totalOrgs} organizations are active right now with ${activeAgents} AI agents deployed.`;

  if (pendingTickets > 0) {
    content += ` There ${pendingTickets === 1 ? 'is' : 'are'} ${pendingTickets} support ticket${pendingTickets === 1 ? '' : 's'} that could use attention.`;
  }

  // Add contextual recommendation
  if (convState.lastInteraction) {
    content += ` Since ${convState.lastInteraction}, anything specific you'd like me to dig into?`;
  } else {
    content += ` What would you like to focus on?`;
  }

  return { content };
}

function handleNextStepQuery(
  state: SystemState,
  convState: ConversationState,
  _userName: string
): ThoughtPartnerResponse {
  // Build recommendation based on state
  if (convState.completedSteps.length === 0) {
    return {
      content: `Let's start with the highest impact items. Based on your setup, I'd recommend we focus on your lead pipeline first - that's where you'll see the fastest ROI. I can start scanning for prospects in your niche right now. Sound good?`,
      updatedState: { currentFocus: 'leads' },
    };
  }

  const lastStep = convState.completedSteps[convState.completedSteps.length - 1];

  if (lastStep.includes('catalog') || lastStep.includes('product')) {
    return {
      content: `Since we finished the product catalog, the natural next step is your lead pipeline. I can start researching prospects who'd be a good fit for what you're selling. Ready to see what's out there?`,
      updatedState: { currentFocus: 'leads' },
    };
  }

  if (lastStep.includes('lead')) {
    return {
      content: `Now that leads are flowing in, let's make sure you can follow up effectively. Your email isn't configured yet - should we set that up so I can help you nurture those prospects?`,
      updatedState: { currentFocus: 'email' },
    };
  }

  return {
    content: `You've made good progress. What's feeling most urgent to you right now? I can help with lead generation, content creation, or diving into the analytics.`,
  };
}

function handleHideFeatureQuery(
  message: string,
  convState: ConversationState,
  _userName: string
): ThoughtPartnerResponse {
  const featureMatches = {
    social: /social|instagram|linkedin|twitter|facebook/i,
    email: /email|newsletter|campaign/i,
    leads: /lead|prospect|hunter/i,
    analytics: /analytics|report|dashboard/i,
  };

  let featureToHide = 'that feature';
  let featureKey = '';

  for (const [key, pattern] of Object.entries(featureMatches)) {
    if (pattern.test(message)) {
      featureToHide = key === 'social' ? 'social media' : key;
      featureKey = key;
      break;
    }
  }

  const newHiddenFeatures = [...convState.hiddenFeatures];
  if (featureKey && !newHiddenFeatures.includes(featureKey)) {
    newHiddenFeatures.push(featureKey);
  }

  return {
    content: `Done - I've hidden ${featureToHide} from your dashboard. You can always bring it back from Settings → Feature Visibility when you're ready. Anything else cluttering your workspace?`,
    internalAction: `hide_feature:${featureKey}`,
    updatedState: { hiddenFeatures: newHiddenFeatures },
  };
}

function generateContextualResponse(
  message: string,
  state: SystemState,
  _convState: ConversationState,
  _userName: string
): ThoughtPartnerResponse {
  // Acknowledge and respond naturally
  return {
    content: `I'm tracking ${state.totalOrgs} organizations right now. ${state.totalOrgs > 0 ? `What aspect would you like to explore?` : `Ready to help you build from here.`}`,
  };
}

// ============================================================================
// CONVERSATION STATE MANAGEMENT
// ============================================================================

/**
 * Initialize conversation state from stored memory
 */
export function initializeConversationState(storedMemory?: UserProgress): ConversationState {
  return {
    completedSteps: storedMemory?.completedSteps ?? [],
    currentFocus: storedMemory?.currentFocus,
    preferences: storedMemory?.preferences ?? {},
    hiddenFeatures: storedMemory?.hiddenFeatures ?? [],
    industry: storedMemory?.industry,
    lastInteraction: storedMemory?.lastInteraction,
  };
}

/**
 * Update conversation state after interaction
 */
export function updateConversationState(
  current: ConversationState,
  updates: Partial<ConversationState>
): ConversationState {
  return {
    ...current,
    ...updates,
    lastInteraction: new Date().toISOString(),
  };
}

const JasperThoughtPartner = {
  JASPER_THOUGHT_PARTNER_PROMPT,
  generateThoughtPartnerResponse,
  initializeConversationState,
  updateConversationState,
};

export default JasperThoughtPartner;
