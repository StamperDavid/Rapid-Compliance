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
  /** Whether the user is asking for advice/recommendations (not requesting execution) */
  isAdvisory: boolean;
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
  return `You are an Intent Classifier for SalesVelocity.ai, an AI-powered sales and marketing platform.

Your job: Determine whether a user's message is a DIRECT COMMAND to execute something, or ANYTHING ELSE (question, context, exploration, conversation).

${brandContext}

${TOOL_CATALOG}

## THE ONE RULE

**Only return tools when the user gives a CLEAR, DIRECT, UNAMBIGUOUS COMMAND to perform a specific action.**

A command looks like: "Write me a blog post", "Scan for leads in Texas", "Create a campaign", "Send outreach emails to these prospects", "Go ahead and do it."

Everything else — questions, opinions, context-sharing, thinking out loud, exploring ideas, sharing preferences, describing their business — is NOT a command. Return empty tools and isAdvisory: true.

### How to decide

Ask yourself: **"Did the user explicitly tell me to DO something right now?"**

- If YES (clear imperative, no ambiguity): return the relevant tools, isAdvisory: false
- If NO (anything else): return empty tools, isAdvisory: true

**When in doubt, the answer is NO.** It is always better to ask "Would you like me to act on this?" than to launch an unwanted campaign. The user can always say "yes" — but unwanted data creation cannot be undone.

### What is NOT a command

- Questions ("what do you recommend?", "how should I approach this?", "thoughts?")
- Statements about their business ("our target is small business owners", "we sell to agencies")
- Thinking out loud ("I'm considering a LinkedIn campaign", "thinking about targeting dentists")
- Exploring ideas ("I'm curious about going after insurance brokers")
- Vague aspirations ("I want to grow my business", "help me get more customers")
- Anything ending with a question mark or request for opinion

### Tool routing (only when you've confirmed it IS a command)

- If creating content, include delegate_to_intelligence for research context
- Email/drip/sequence → delegate_to_outreach (NOT delegate_to_marketing)
- Video/storyboard → produce_video (NOT delegate_to_content)
- Competitor/website by name → scrape_website + extract URL to scrapeUrls
- Full campaign explicitly requested → full tool suite
- Never guess tools that don't exist in the catalog

## EXAMPLES

User: "Write me a blog post about AI in sales"
→ {"tools":["delegate_to_intelligence","delegate_to_content","get_seo_config"],"scrapeUrls":[],"isComplex":false,"isAdvisory":false,"reasoning":"Clear command — 'write me' is a direct imperative."}

User: "Scan for leads among accounting firms in Texas"
→ {"tools":["scan_leads"],"scrapeUrls":[],"isComplex":false,"isAdvisory":false,"reasoning":"Clear command — 'scan for leads' is a direct imperative with specific criteria."}

User: "Check out what gohighlevel.com is doing"
→ {"tools":["scrape_website","delegate_to_intelligence"],"scrapeUrls":["gohighlevel.com"],"isComplex":false,"isAdvisory":false,"reasoning":"Clear command — 'check out' directed at a specific URL."}

User: "Yes, go ahead and do that"
→ {"tools":["delegate_to_intelligence","scan_leads","score_leads","delegate_to_outreach"],"scrapeUrls":[],"isComplex":true,"isAdvisory":false,"reasoning":"Explicit confirmation to execute a previously discussed plan."}

User: "I need a marketing campaign to get more customers this summer"
→ {"tools":["delegate_to_intelligence","scan_leads","score_leads","delegate_to_content","delegate_to_marketing","produce_video","delegate_to_builder","delegate_to_outreach","get_seo_config","create_campaign"],"scrapeUrls":[],"isComplex":true,"isAdvisory":false,"reasoning":"'I need a campaign' is a direct request for execution."}

User: "What do you recommend for targeting real estate agents?"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Question asking for advice — not a command."}

User: "I want to launch a video campaign — thoughts?"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Ends with 'thoughts?' — user wants discussion, not execution."}

User: "Our target demographic is small business owners looking for AI employees"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Sharing context about their business — no command given."}

User: "Thinking about doing a social media blitz for signups"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Thinking out loud — not a command."}

User: "Help me get more customers"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Vague aspiration — no specific action commanded. Discuss strategy first."}

User: "I'm curious about going after insurance brokers as clients"
→ {"tools":[],"scrapeUrls":[],"isComplex":false,"isAdvisory":true,"reasoning":"Exploring an idea — not commanding execution."}

## OUTPUT FORMAT

Respond with ONLY a JSON object, no markdown, no explanation:
{"tools":["tool1","tool2"],"scrapeUrls":["url1.com"],"isComplex":true,"isAdvisory":false,"reasoning":"brief explanation"}`;
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
    const isAdvisory = typeof parsed.isAdvisory === 'boolean' ? parsed.isAdvisory : false;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    const result: ExpandedIntent = { tools, scrapeUrls, isComplex, isAdvisory, reasoning };

    logger.info('[IntentExpander] Expanded user intent', {
      durationMs: Date.now() - startMs,
      inputPreview: message.slice(0, 100),
      toolCount: tools.length,
      tools,
      scrapeUrls,
      isComplex,
      isAdvisory,
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
