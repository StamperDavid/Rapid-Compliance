import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * Pricing tier interface matching the subscription plan structure
 */
interface PricingTier {
  readonly name: string;
  readonly price: number;
  readonly recordMin: number;
  readonly recordMax: number;
  readonly description: string;
  readonly active: boolean;
}

/**
 * Request body structure
 */
interface UpdateAgentPricingBody {
  readonly tiers: ReadonlyArray<PricingTier>;
}

/**
 * Organization document from Firestore with strict typing
 */
interface OrganizationDocument {
  readonly id: string;
  readonly name?: string;
  readonly createdAt?: string;
  readonly plan?: string;
  readonly status?: string;
}

/**
 * Pricing knowledge document structure
 */
interface PricingKnowledgeDocument {
  readonly category: string;
  readonly title: string;
  readonly content: string;
  readonly priority: number;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

/**
 * API Response types following Result<T, E> pattern
 */
interface UpdateAgentPricingSuccess {
  readonly success: true;
  readonly message: string;
  readonly organizationsUpdated: number;
}

interface UpdateAgentPricingError {
  readonly success: false;
  readonly error: string;
}

type _UpdateAgentPricingResponse = UpdateAgentPricingSuccess | UpdateAgentPricingError;

/**
 * Validates the request body structure
 */
function isValidUpdateAgentPricingBody(body: unknown): body is UpdateAgentPricingBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;

  if (!Array.isArray(candidate.tiers)) {
    return false;
  }

  return candidate.tiers.every((tier: unknown) => {
    if (typeof tier !== 'object' || tier === null) {
      return false;
    }
    const t = tier as Record<string, unknown>;
    return (
      typeof t.name === 'string' &&
      typeof t.price === 'number' &&
      typeof t.recordMin === 'number' &&
      typeof t.recordMax === 'number' &&
      typeof t.description === 'string' &&
      typeof t.active === 'boolean'
    );
  });
}

/**
 * POST: Update AI Agent's pricing knowledge
 * This updates the agent's knowledge base so it can answer pricing questions accurately
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid JSON';
      logger.error('[Admin] Failed to parse request body:', parseError instanceof Error ? parseError : new Error(String(parseError)));
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: `Invalid request body: ${errorMessage}` },
        { status: 400 }
      );
    }

    if (!isValidUpdateAgentPricingBody(body)) {
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: 'Invalid pricing tiers data structure' },
        { status: 400 }
      );
    }

    const { tiers } = body;

    // Validate tiers array is not empty
    if (tiers.length === 0) {
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: 'At least one pricing tier is required' },
        { status: 400 }
      );
    }

    // Format pricing knowledge for AI agent
    // Safe access: tiers.length > 0 is validated above
    const firstTier = tiers[0];
    const lastTier = tiers[tiers.length - 1];

    if (!firstTier || !lastTier) {
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: 'Failed to access pricing tier data' },
        { status: 500 }
      );
    }

    const firstTierPrice = firstTier.price;
    const lastTierPrice = lastTier.price;
    const firstTierRecordMax = firstTier.recordMax;

    const tierDescriptions = tiers
      .map((tier: PricingTier): string => {
        return `
### ${tier.name} - $${tier.price}/month
- **Record Capacity:** ${tier.recordMin}-${tier.recordMax} records
- **Description:** ${tier.description}
${tier.active ? '- **Status:** ✅ Currently available' : '- **Status:** ⏸️ Not currently offered'}
`;
      })
      .join('\n');

    const pricingKnowledge: PricingKnowledgeDocument = {
      category: 'pricing',
      title: 'Current Pricing Tiers',
      content: `
# SalesVelocity Pricing - Volume-Based Model

**Pricing Philosophy:** Success-Linked Pricing - Pay for what you store, not what you use.

## Current Pricing Tiers

${tierDescriptions}

## Key Points to Communicate to Customers

1. **All-Inclusive Access:** Every tier gets access to ALL features:
   - AI Sales Agents (Unlimited)
   - Lead Scraper & Enrichment
   - Email Sequences (Unlimited)
   - Multi-Channel Outreach (Email, LinkedIn, SMS)
   - Social Media AI
   - Full CRM Suite
   - Workflow Automation
   - API Access
   - White-Label Options

2. **No Feature Gating:** The $${firstTierPrice} user gets the same AI Sales Engine as the $${lastTierPrice} user.

3. **BYOK (Bring Your Own Keys):** We don't markup AI tokens. Customers connect their own OpenRouter, OpenAI, or Anthropic API keys to pay raw market rates for compute.

4. **What Replaces (Frankenstein Stack Killer):**
   - Apollo/ZoomInfo: $99-399/mo → Included
   - Air AI/11x: $500-2000/mo → Included
   - Sintra Social: $49-199/mo → Included
   - Zapier Automation: $29-599/mo → Included
   - **Total Competitor Cost:** $677-3,197/mo
   - **Our Cost:** $${firstTierPrice}-$${lastTierPrice}/mo
   - **Savings:** $${677 - firstTierPrice}-$${3197 - lastTierPrice}/mo

5. **Trial Terms:**
   - 14-day free trial
   - Credit card required upfront
   - Auto-bills at trial end based on record count
   - Cancel anytime

6. **How Billing Works:**
   - Customers are automatically upgraded/downgraded based on their record count
   - Records = Contacts + Leads + Companies + Deals + Products
   - Billed monthly based on current tier

## When Customers Ask About Pricing

**Example responses:**

- "How much does this cost?"
  → "We have success-linked pricing starting at $${firstTierPrice}/month for 0-${firstTierRecordMax} records. The best part? You get access to ALL features regardless of tier - no gated features!"

- "What's the difference between tiers?"
  → "The only difference is record capacity (how many contacts/leads you can store). Every tier has access to the full platform - AI agents, lead scraping, email sequences, everything."

- "Why is this better than [competitor]?"
  → "Instead of paying $677-3,197/month for separate tools (lead data, AI agents, social media, automation), you get everything in one platform for $${firstTierPrice}-$${lastTierPrice}/month. Plus, we use BYOK so you're not paying marked-up AI token costs."

**Last Updated:** ${new Date().toISOString()}
      `.trim(),
      priority: 10, // High priority knowledge
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    // Save to agent knowledge base
    await FirestoreService.set(
      'platform_config',
      'agent_pricing_knowledge',
      pricingKnowledge
    );

    // Also update all organization-level agents if they exist
    // This ensures customer-facing agents get the updated pricing
    let orgs: OrganizationDocument[] = [];
    try {
      orgs = await FirestoreService.getAll<OrganizationDocument>(COLLECTIONS.ORGANIZATIONS, []);
    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      logger.error('[Admin] Failed to fetch organizations:', fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: `Failed to fetch organizations: ${errorMessage}` },
        { status: 500 }
      );
    }

    let successCount = 0;
    const failedOrgIds: string[] = [];

    for (const org of orgs) {
      try {
        // Update agent knowledge for this organization
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/agent_knowledge`,
          'pricing',
          pricingKnowledge
        );
        successCount++;
      } catch (error: unknown) {
        failedOrgIds.push(org.id);
        logger.warn(`Failed to update agent knowledge for org ${org.id}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (failedOrgIds.length > 0) {
      logger.warn('[Admin] Some organizations failed to update', {
        userId: user.uid,
        totalOrgs: orgs.length,
        successCount,
        failedCount: failedOrgIds.length,
        failedOrgIds,
      });
    }

    logger.info('[Admin] Agent pricing knowledge updated', {
      userId: user.uid,
      tierCount: tiers.length,
      organizationsUpdated: successCount,
    });

    return NextResponse.json<UpdateAgentPricingSuccess>({
      success: true,
      message: 'AI agent pricing knowledge updated',
      organizationsUpdated: successCount,
    });
  } catch (error: unknown) {
    logger.error('[Admin] Error updating agent pricing knowledge:', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json<UpdateAgentPricingError>(
      { success: false, error: 'Failed to update agent knowledge' },
      { status: 500 }
    );
  }
}

