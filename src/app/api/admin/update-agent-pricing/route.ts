import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const PricingTierSchema = z.object({
  name: z.string().min(1),
  price: z.number(),
  recordMin: z.number(),
  recordMax: z.number(),
  description: z.string(),
  active: z.boolean(),
});

const UpdateAgentPricingSchema = z.object({
  tiers: z.array(PricingTierSchema).min(1, 'At least one pricing tier is required'),
});

/**
 * Pricing tier interface matching the subscription plan structure
 */
type PricingTier = z.infer<typeof PricingTierSchema>;

/**
 * Request body structure
 */
type UpdateAgentPricingBody = z.infer<typeof UpdateAgentPricingSchema>;

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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid JSON';
      logger.error('[Admin] Failed to parse request body:', parseError instanceof Error ? parseError : new Error(String(parseError)));
      return NextResponse.json<UpdateAgentPricingError>(
        { success: false, error: `Invalid request body: ${errorMessage}` },
        { status: 400 }
      );
    }

    const parsed = UpdateAgentPricingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body: UpdateAgentPricingBody = parsed.data;
    const { tiers } = body;

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
      title: 'Current Pricing',
      content: `
# SalesVelocity Pricing — Flat Rate, All Features

**Pricing Philosophy:** One price, every feature, no tiers, no record limits.

## Plan Details

${tierDescriptions}

## Key Points to Communicate to Customers

1. **All-Inclusive Access:** Every subscriber gets access to ALL features:
   - AI Sales Agents (Unlimited)
   - Lead Scraper & Enrichment
   - Email Sequences (Unlimited)
   - Multi-Channel Outreach (Email, LinkedIn, SMS)
   - Social Media AI
   - Full CRM Suite
   - Workflow Automation
   - API Access
   - White-Label Options

2. **No Feature Gating:** $${firstTierPrice}/month gets you the full platform — same AI Sales Engine, same CRM, same automation as $${lastTierPrice} would have been on old plans.

3. **BYOK (Bring Your Own Keys):** We don't markup AI tokens. Customers connect their own OpenRouter, OpenAI, or Anthropic API keys to pay raw market rates for compute.

4. **What Replaces (Frankenstein Stack Killer):**
   - Apollo/ZoomInfo: $99-399/mo → Included
   - Air AI/11x: $500-2000/mo → Included
   - Sintra Social: $49-199/mo → Included
   - Zapier Automation: $29-599/mo → Included
   - **Total Competitor Cost:** $677-3,197/mo
   - **Our Cost:** $${firstTierPrice}/mo
   - **Savings:** $${677 - firstTierPrice}-$${3197 - firstTierPrice}/mo

5. **Trial Terms:**
   - 14-day free trial
   - Credit card required upfront
   - Full access to all features during trial
   - Cancel anytime

6. **Fair-Use Limits:**
   - CRM records up to fair-use threshold (see limits in admin)
   - All features available regardless of usage level
   - Limits exist to protect platform performance, not gate features

## When Customers Ask About Pricing

**Example responses:**

- "How much does this cost?"
  → "It's $${firstTierPrice}/month flat — one price, every feature, no tiers. You get the full platform including AI agents, CRM, automation, and more."

- "Are there different plans?"
  → "No tiers — one plan, $${firstTierPrice}/month, everything included. No feature gating, no record-count upsells."

- "Why is this better than [competitor]?"
  → "Instead of paying $677-3,197/month for separate tools (lead data, AI agents, social media, automation), you get everything in one platform for $${firstTierPrice}/month. Plus, we use BYOK so you're not paying marked-up AI token costs."

**Last Updated:** ${new Date().toISOString()}
      `.trim(),
      priority: 10, // High priority knowledge
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    // Save to agent knowledge base
    await AdminFirestoreService.set(
      'platform_config',
      'agent_pricing_knowledge',
      pricingKnowledge as unknown as Record<string, unknown>
    );

    // Also update all organization-level agents if they exist
    // This ensures customer-facing agents get the updated pricing
    let orgs: OrganizationDocument[] = [];
    try {
      orgs = await AdminFirestoreService.getAll<OrganizationDocument>(COLLECTIONS.ORGANIZATIONS, []);
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
        await AdminFirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/agent_knowledge`,
          'pricing',
          pricingKnowledge as unknown as Record<string, unknown>
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

