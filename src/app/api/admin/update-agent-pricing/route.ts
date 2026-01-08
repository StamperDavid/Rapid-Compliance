import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

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

    const body = await request.json();
    const { tiers } = body;

    // Format pricing knowledge for AI agent
    const pricingKnowledge = {
      category: 'pricing',
      title: 'Current Pricing Tiers',
      content: `
# AI Sales Platform Pricing - Volume-Based Model

**Pricing Philosophy:** Success-Linked Pricing - Pay for what you store, not what you use.

## Current Pricing Tiers

${tiers.map((tier: any, index: number) => `
### ${tier.name} - $${tier.price}/month
- **Record Capacity:** ${tier.recordMin}-${tier.recordMax} records
- **Description:** ${tier.description}
${tier.active ? '- **Status:** ✅ Currently available' : '- **Status:** ⏸️ Not currently offered'}
`).join('\n')}

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

2. **No Feature Gating:** The $${tiers[0]?.price ?? 400} user gets the same AI Sales Engine as the $${tiers[tiers.length - 1]?.price ?? 1250} user.

3. **BYOK (Bring Your Own Keys):** We don't markup AI tokens. Customers connect their own OpenRouter, OpenAI, or Anthropic API keys to pay raw market rates for compute.

4. **What Replaces (Frankenstein Stack Killer):**
   - Apollo/ZoomInfo: $99-399/mo → Included
   - Air AI/11x: $500-2000/mo → Included
   - Sintra Social: $49-199/mo → Included
   - Zapier Automation: $29-599/mo → Included
   - **Total Competitor Cost:** $677-3,197/mo
   - **Our Cost:** $${tiers[0]?.price ?? 400}-$${tiers[tiers.length - 1]?.price ?? 1250}/mo
   - **Savings:** $${677 - (tiers[0]?.price ?? 400)}-$${3197 - (tiers[tiers.length - 1]?.price ?? 1250)}/mo

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
  → "We have success-linked pricing starting at $${tiers[0]?.price ?? 400}/month for 0-${tiers[0]?.recordMax ?? 100} records. The best part? You get access to ALL features regardless of tier - no gated features!"

- "What's the difference between tiers?"
  → "The only difference is record capacity (how many contacts/leads you can store). Every tier has access to the full platform - AI agents, lead scraping, email sequences, everything."

- "Why is this better than [competitor]?"
  → "Instead of paying $677-3,197/month for separate tools (lead data, AI agents, social media, automation), you get everything in one platform for $${tiers[0]?.price ?? 400}-$${tiers[tiers.length - 1]?.price ?? 1250}/month. Plus, we use BYOK so you're not paying marked-up AI token costs."

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
    const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS, []);
    
    for (const org of orgs) {
      try {
        // Update agent knowledge for this organization
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/agent_knowledge`,
          'pricing',
          {
            ...pricingKnowledge,
            organizationId: org.id,
          }
        );
      } catch (error) {
        logger.warn(`Failed to update agent knowledge for org ${org.id}`, error as Error);
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
  } catch (error: any) {
    logger.error('[Admin] Error updating agent pricing knowledge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update agent knowledge' },
      { status: 500 }
    );
  }
}

