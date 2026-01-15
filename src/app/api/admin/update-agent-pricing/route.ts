import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * Pricing tier interface matching the subscription plan structure
 */
interface PricingTier {
  name: string;
  price: number;
  recordMin: number;
  recordMax: number;
  description: string;
  active: boolean;
}

/**
 * Request body structure
 */
interface UpdateAgentPricingBody {
  tiers: PricingTier[];
}

/**
 * Organization document from Firestore
 */
interface OrganizationDocument {
  id: string;
  [key: string]: unknown;
}

/**
 * Pricing knowledge document structure
 */
interface PricingKnowledgeDocument {
  category: string;
  title: string;
  content: string;
  priority: number;
  updatedAt: string;
  updatedBy: string;
  organizationId?: string;
}

/**
 * POST: Update AI Agent's pricing knowledge
 * This updates the agent's knowledge base so it can answer pricing questions accurately
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as UpdateAgentPricingBody;
    const { tiers } = body;

    // Format pricing knowledge for AI agent
    const firstTierPrice = tiers[0]?.price ?? 400;
    const lastTierPrice = tiers[tiers.length - 1]?.price ?? 1250;
    const firstTierRecordMax = tiers[0]?.recordMax ?? 100;

    const tierDescriptions = tiers
      .map((tier: PricingTier) => {
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
# AI Sales Platform Pricing - Volume-Based Model

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
    const orgs = await FirestoreService.getAll<OrganizationDocument>(COLLECTIONS.ORGANIZATIONS, []);

    for (const org of orgs) {
      try {
        // Update agent knowledge for this organization
        const orgPricingKnowledge: PricingKnowledgeDocument = {
          ...pricingKnowledge,
          organizationId: org.id,
        };

        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/agent_knowledge`,
          'pricing',
          orgPricingKnowledge
        );
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.warn(`Failed to update agent knowledge for org ${org.id}`, error);
        } else {
          logger.warn(`Failed to update agent knowledge for org ${org.id}`, new Error(String(error)));
        }
      }
    }

    logger.info('[Admin] Agent pricing knowledge updated', {
      userId: user.uid,
      tierCount: tiers.length,
      organizationsUpdated: orgs.length,
    });

    return NextResponse.json({
      success: true,
      message: 'AI agent pricing knowledge updated',
      organizationsUpdated: orgs.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('[Admin] Error updating agent pricing knowledge:', error);
    } else {
      logger.error('[Admin] Error updating agent pricing knowledge:', new Error(String(error)));
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update agent knowledge' },
      { status: 500 }
    );
  }
}

