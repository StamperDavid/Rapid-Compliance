/**
 * Formats a KnowledgeBase (platformCatalog/current) document into a
 * human-readable context block that is injected into the agent's system
 * prompt on every turn.
 *
 * Keep this as a pure function so it is trivially unit-testable.
 */

import type { KnowledgeBase } from '@/types/knowledge-base';

/**
 * Converts a KnowledgeBase document into a plaintext context block for
 * injection into a customer-facing agent's system prompt.
 */
export function formatCatalogForAgent(catalog: KnowledgeBase): string {
  const lines: string[] = [];
  lines.push('## LIVE PLATFORM CATALOG (read-only — your source of truth for pricing and features this turn)');
  lines.push('');
  lines.push('### Pricing');
  lines.push(`- Model: ${catalog.pricing.model}`);
  lines.push(`- Price: $${catalog.pricing.monthlyPrice}/${catalog.pricing.billingCycle} (${catalog.pricing.currency})`);
  lines.push(
    `- Trial: ${catalog.pricing.trial.days} days, full access${
      catalog.pricing.trial.creditCardRequired
        ? ', credit card required'
        : ', no credit card required'
    }, cancel anytime`,
  );
  lines.push(`- BYOK: ${catalog.pricing.byok.explanation}`);
  lines.push(
    `- Fair-use limits: ${catalog.pricing.fairUseLimits.crmRecords.toLocaleString()} CRM records, ` +
      `${catalog.pricing.fairUseLimits.socialPostsPerMonth.toLocaleString()} social posts/mo, ` +
      `${catalog.pricing.fairUseLimits.emailsPerDay.toLocaleString()} emails/day, ` +
      `${catalog.pricing.fairUseLimits.aiAgents} AI agents`,
  );
  lines.push('');
  lines.push('### Features');
  for (const feature of catalog.features) {
    lines.push(`- **${feature.name}** (${feature.category}): ${feature.summary} — ${feature.detail}`);
  }
  lines.push('');
  lines.push('### Industry-specific value props');
  for (const industry of catalog.industries) {
    lines.push(
      `- **${industry.label}** — lead with: ${industry.leadFeatures.join(', ')}. ` +
        `Talking points: ${industry.talkingPoints.join('; ')}`,
    );
  }
  return lines.join('\n');
}
