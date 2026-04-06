/**
 * Intent Expander — LLM-based query understanding for non-technical users
 *
 * Replaces brittle regex keyword matching with actual intelligence.
 * Takes natural language from small business owners and produces a structured
 * action plan with the correct tools, phases, and parameters.
 *
 * Uses Claude Haiku for speed (~800ms) — this is a pre-processing step
 * that runs before the main Jasper tool-calling loop.
 */

import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Types
// ============================================================================

export interface ExpandedIntent {
  /** Tools that should be called to fulfill the user's request */
  tools: string[];
  /** URLs to scrape (if user mentions specific websites) */
  scrapeUrls: string[];
  /** Whether this is a complex multi-tool request (3+ tools) */
  isComplex: boolean;
  /** Brief reasoning for the tool selection (for logging) */
  reasoning: string;
}

// ============================================================================
// Tool Catalog — what the expander knows about our system
// ============================================================================

const TOOL_CATALOG = `
## AVAILABLE TOOLS & WHAT THEY DO

### Research & Discovery (Phase 1 — always do research BEFORE creating content)
- scrape_website: Fetches and parses a specific URL. Use when the user mentions a website by name or URL. Call ONCE per URL.
- delegate_to_intelligence: Deep market research — competitor analysis, trend signals, market gaps. Uses Serper search API. Use for broad research like "what are my competitors doing" or "trending topics in X".
- research_trending_topics: Find trending topics in an industry. Use when user wants to know what's hot.
- get_seo_config: Read the business's current SEO settings. Use when creating content (helps align keywords).

### Lead Generation (Phase 1 — runs parallel with research)
- scan_leads: Search Apollo.io for companies matching criteria. Use when user wants to find prospects, leads, or target companies.
- enrich_lead: Add detailed data to a specific lead. Use after scanning to fill in gaps.
- score_leads: Score all leads by engagement and fit. Use after scanning to prioritize.

### Content Creation (Phase 3 — AFTER research and leads are done)
- delegate_to_content: Creates blog posts and long-form content via AI. Use for blog posts, articles, case studies.
- delegate_to_marketing: Creates social media posts for Twitter, LinkedIn, etc. Use for social media content.
- produce_video: AI Video Director — creates a video storyboard with scenes, scripts, and thumbnails. Use for any video content.
- delegate_to_builder: Creates landing pages with conversion-optimized copy. Use for landing pages, lead magnets, opt-in pages.
- delegate_to_architect: Creates website page architecture. Use for full site designs.

### Outreach (Phase 4 — AFTER leads are scored and content is ready)
- delegate_to_outreach: Creates email sequences (cold outreach, drip campaigns, nurture sequences). Use for any email-based outreach or email campaigns.

### Campaign Management
- create_campaign: Creates a campaign container to group deliverables. Use when multiple content pieces should be tracked together.
- orchestrate_campaign: Runs a full content pipeline (blog + video + social + email + landing page). Use as a shortcut for "do everything".

### Other Tools
- delegate_to_commerce: E-commerce actions (products, pricing, inventory).
- delegate_to_trust: Reputation management, review responses.
- voice_agent: AI phone calls (prospecting, closing).
- social_post: Direct social media posting (not content creation — actual posting).
- save_blog_draft: Direct blog save (use delegate_to_content instead for AI-generated blogs).

## TOOL COMPOSITION BEST PRACTICES

When a user wants a "marketing campaign" or "full campaign", include ALL of these:
- delegate_to_intelligence (research competitors/market first)
- scan_leads (find target audience)
- score_leads (prioritize leads)
- delegate_to_content (blog post)
- delegate_to_marketing (social posts)
- produce_video (video storyboard)
- delegate_to_builder (landing page)
- delegate_to_outreach (email sequence)
- get_seo_config (align keywords)
- create_campaign (group everything)

When a user wants to "beat competitors" or "competitive analysis":
- scrape_website (for each competitor URL mentioned)
- delegate_to_intelligence (deep research)
- scan_leads (find their customers)

When a user wants "content" or "blog post":
- delegate_to_content (the blog)
- get_seo_config (keyword alignment)

When a user wants "social media" or "posts":
- delegate_to_marketing (create posts)

When a user wants "email campaign" or "outreach" or "drip sequence":
- delegate_to_outreach (email sequences)
- scan_leads (if they don't have leads yet)

When a user wants "video" or "storyboard":
- produce_video (video storyboard)

When a user wants "landing page" or "lead magnet":
- delegate_to_builder (landing page)

## PHASE ORDER (dependency-based)
Phase 1: Research (scrape_website, delegate_to_intelligence, scan_leads, get_seo_config, research_trending_topics)
Phase 2: Analysis (enrich_lead, score_leads)
Phase 3: Content (delegate_to_content, delegate_to_marketing, produce_video, delegate_to_builder, create_campaign)
Phase 4: Outreach (delegate_to_outreach)

CRITICAL: Research MUST complete before content creation. Leads MUST be scanned before outreach.
`;

// ============================================================================
// System prompt for the expander
// ============================================================================

function buildExpanderPrompt(brandContext: string): string {
  return `You are a Campaign Planning Expert for an AI-powered sales and marketing platform called SalesVelocity.ai.

Your job: Take a message from a small business owner (who is NOT a prompt engineer and may be vague) and determine EXACTLY which tools should be called to fulfill their request.

${brandContext}

${TOOL_CATALOG}

## YOUR RULES — MATCH SCOPE TO INTENT

**CRITICAL: Only include tools that directly serve what the user ASKED FOR.** Do NOT assume they want more than they said. Do NOT add lead scanning, campaigns, or content creation unless they explicitly asked for it.

### Rule 1: Classify the request type FIRST
- **Advisory/Question** ("what do you recommend", "what should I", "how would you", "what's the best way", "can you help me understand", "any suggestions", "what do you think"): ALWAYS return EMPTY tools []. The user is asking for advice, not requesting execution. Jasper should DISCUSS strategy, not launch campaigns. This is the MOST IMPORTANT rule — never execute tools for a question.
- **Research/Analysis** ("check out", "look into", "what are they doing", "analyze", "how much traffic"): ONLY research tools. Return findings. Let the USER decide next steps.
- **Specific action** ("write a blog", "create a video", "send emails"): ONLY the tools for that specific action.
- **Campaign/Full suite** ("marketing campaign", "full campaign", "I need everything", "launch a campaign"): THEN and ONLY THEN use the full tool suite.
- **Conversational** (greeting, thanks, question about the system): Empty tools.

### Rule 2: Do NOT create data the user didn't ask for
- NEVER call scan_leads unless the user asks to find leads/prospects
- NEVER call create_campaign unless the user asks to build a campaign
- NEVER call enrich_lead or score_leads unless the user has leads they want analyzed
- NEVER call content/marketing/video/outreach tools for a research request
- These tools CREATE DATA in the user's system. Unwanted data pollutes their workspace.

### Rule 3: Specific tool routing
- If the user mentions a competitor or website by name → scrape_website for that URL
- If the user mentions email, drip, sequence, or nurture → delegate_to_outreach (NOT delegate_to_marketing)
- If the user mentions video, storyboard, or visual content → produce_video (NOT delegate_to_content)
- Extract specific URLs/domains mentioned (e.g., "gohighlevel.com" → scrapeUrls)

### Rule 4: When creating content, include research
- If the user DOES ask for content creation (blog, social, etc.), include delegate_to_intelligence so the content is informed
- But do NOT include content tools just because research was requested

### Rule 5: Never guess tools
- NEVER suggest tools that don't exist in the catalog above
- When in doubt, use FEWER tools — the user can always ask for more

## EXAMPLES

User: "Check out what gohighlevel.com is doing and tell me how we can beat them"
→ {"tools":["scrape_website","delegate_to_intelligence"],"scrapeUrls":["gohighlevel.com"],"isComplex":false,"reasoning":"Research request — analyze competitor, report findings. No content or leads requested."}

User: "How much traffic is clientsite.com getting?"
→ {"tools":["scrape_website"],"scrapeUrls":["clientsite.com"],"isComplex":false,"reasoning":"Simple website lookup — just scrape and report."}

User: "I need a marketing campaign to get more customers this summer"
→ {"tools":["delegate_to_intelligence","scan_leads","score_leads","delegate_to_content","delegate_to_marketing","produce_video","delegate_to_builder","delegate_to_outreach","get_seo_config","create_campaign"],"scrapeUrls":[],"isComplex":true,"reasoning":"Full campaign explicitly requested — activate full suite."}

User: "Write me a blog post about AI in sales"
→ {"tools":["delegate_to_intelligence","delegate_to_content","get_seo_config"],"scrapeUrls":[],"isComplex":false,"reasoning":"Specific content request — research for context, then write the blog."}

User: "Help me get more customers"
→ {"tools":["delegate_to_intelligence","get_seo_config"],"scrapeUrls":[],"isComplex":false,"reasoning":"Vague request — research their market first, then recommend specific actions. Do NOT auto-create content or scan leads without more direction."}

User: "I want to target real estate agents in Texas. What do you recommend?"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"reasoning":"Advisory question — user is asking for recommendations, not requesting execution. Respond with strategy advice and let the user decide what to do next."}

User: "What's the best way to reach small business owners?"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"reasoning":"Advisory question — user wants guidance on strategy. Discuss options, do not execute."}

User: "How should I approach getting more leads?"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"reasoning":"Advisory question — user is exploring strategy. Recommend approaches, let them choose."}

User: "Yes, go ahead and do that" (after receiving a recommendation)
→ {"tools":["delegate_to_intelligence","scan_leads","score_leads","delegate_to_outreach"],"scrapeUrls":[],"isComplex":true,"reasoning":"User confirmed action after advisory — NOW execute the recommended plan."}

## OUTPUT FORMAT

Respond with ONLY a JSON object, no markdown, no explanation:
{"tools":["tool1","tool2"],"scrapeUrls":["url1.com"],"isComplex":true,"reasoning":"brief explanation"}`;
}

// ============================================================================
// Main expander function
// ============================================================================

/**
 * Expand a user's natural language request into a structured tool plan.
 * Uses Claude Haiku for speed (~800ms).
 * Returns null on failure (caller falls back to regex matching).
 */
export async function expandIntent(message: string): Promise<ExpandedIntent | null> {
  const startMs = Date.now();

  try {
    // Load brand context in parallel with provider setup
    const [brandDNA, provider] = await Promise.all([
      getBrandDNA().catch(() => null),
      Promise.resolve(new OpenRouterProvider(PLATFORM_ID)),
    ]);

    const brandContext = brandDNA
      ? `## BUSINESS CONTEXT (this is the user's business)
- Company: ${brandDNA.companyDescription || 'Unknown'}
- Industry: ${brandDNA.industry || 'Unknown'}
- Value Proposition: ${brandDNA.uniqueValue || 'Unknown'}
- Target Audience: ${brandDNA.targetAudience || 'Unknown'}
- Competitors: ${brandDNA.competitors?.join(', ') || 'Unknown'}
- Tone: ${brandDNA.toneOfVoice || 'professional'}`
      : '## BUSINESS CONTEXT\nNo brand data configured yet.';

    type ModelName = Parameters<typeof provider.chat>[0]['model'];

    const response = await provider.chat({
      model: 'claude-3-haiku' as ModelName,
      messages: [
        { role: 'system', content: buildExpanderPrompt(brandContext) },
        { role: 'user', content: message },
      ],
      temperature: 0,
      maxTokens: 500,
    });

    const raw = (response.content || '').trim();

    // Parse JSON response — try to extract from potential markdown wrapping
    const jsonStr = raw.replace(/^```json\n?|```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate structure
    const tools = Array.isArray(parsed.tools) ? (parsed.tools as string[]) : [];
    const scrapeUrls = Array.isArray(parsed.scrapeUrls) ? (parsed.scrapeUrls as string[]) : [];
    const isComplex = typeof parsed.isComplex === 'boolean' ? parsed.isComplex : tools.length >= 3;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    const result: ExpandedIntent = { tools, scrapeUrls, isComplex, reasoning };

    logger.info('[IntentExpander] Expanded user intent', {
      durationMs: Date.now() - startMs,
      inputPreview: message.slice(0, 100),
      toolCount: tools.length,
      tools,
      scrapeUrls,
      isComplex,
      reasoning,
    });

    return result;
  } catch (error) {
    logger.warn('[IntentExpander] Failed — falling back to regex matching', {
      durationMs: Date.now() - startMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
