/**
 * Canonical pricing configuration — Single Source of Truth for all runtime code.
 *
 * Matches the shape defined in docs/knowledgebase-contract.md exactly.
 * Seed scripts read from this file when populating the KnowledgeBase Firestore
 * document so a single edit here ripples to the agent knowledge base on next seed run.
 *
 * GM seed scripts do NOT embed pricing — agents read from KnowledgeBase at
 * runtime per docs/knowledgebase-contract.md.
 */

export const PRICING = {
  model: 'flat' as const,
  monthlyPrice: 299,
  currency: 'USD' as const,
  billingCycle: 'monthly' as const,
  byok: {
    enabled: true,
    explanation:
      'Bring Your Own Keys: you connect your own AI provider account (OpenRouter, OpenAI, Anthropic, etc.) and pay raw market rates with zero markup from us.',
  },
  trial: {
    days: 14,
    fullAccess: true,
    creditCardRequired: true,
    cancelAnytime: true,
  },
  fairUseLimits: {
    crmRecords: 50000,
    socialPostsPerMonth: 10000,
    emailsPerDay: 5000,
    aiAgents: 100,
  },
} as const;

export type PricingConfig = typeof PRICING;
