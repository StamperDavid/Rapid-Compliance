/**
 * Subscription Tiers Unit Tests
 *
 * Tests for the centralized pricing module at src/lib/pricing/subscription-tiers.ts
 * Validates the single flat-rate 'pro' tier config, pricing accuracy, rank ordering,
 * and utility functions.
 *
 * SalesVelocity.ai is $299/month flat — one tier, all features.
 */

import { describe, it, expect } from '@jest/globals';
import {
  SUBSCRIPTION_TIERS,
  TIER_RANK,
  getTier,
  getTierConfig,
  type SubscriptionTier,
  type SubscriptionTierKey,
} from '@/lib/pricing/subscription-tiers';
import { PRICING } from '@/lib/config/pricing';

// ============================================================================
// getTier — lookup by key
// ============================================================================

describe('getTier', () => {
  it('returns the pro tier with correct pricing from PRICING config', () => {
    const tier = getTier('pro');

    expect(tier).toBeDefined();
    expect(tier?.key).toBe('pro' satisfies SubscriptionTierKey);
    expect(tier?.monthlyPrice).toBe(PRICING.monthlyPrice);
    expect(tier?.monthlyPriceCents).toBe(PRICING.monthlyPrice * 100);
  });

  it('returns pro tier with correct annual pricing (10 months billed)', () => {
    const tier = getTier('pro');
    const expectedAnnual = PRICING.monthlyPrice * 10;

    expect(tier?.annualPrice).toBe(expectedAnnual);
    expect(tier?.annualPriceCents).toBe(expectedAnnual * 100);
  });

  it('returns undefined for legacy tier keys that no longer exist', () => {
    expect(getTier('free')).toBeUndefined();
    expect(getTier('starter')).toBeUndefined();
    expect(getTier('professional')).toBeUndefined();
    expect(getTier('enterprise')).toBeUndefined();
  });

  it('returns undefined for a nonexistent tier key', () => {
    const tier = getTier('nonexistent');

    expect(tier).toBeUndefined();
  });

  it('returns a tier with the required SubscriptionTier shape', () => {
    const tier = getTier('pro') as SubscriptionTier;

    expect(tier).toHaveProperty('key');
    expect(tier).toHaveProperty('label');
    expect(tier).toHaveProperty('monthlyPrice');
    expect(tier).toHaveProperty('annualPrice');
    expect(tier).toHaveProperty('monthlyPriceCents');
    expect(tier).toHaveProperty('annualPriceCents');
    expect(tier).toHaveProperty('color');
    expect(tier).toHaveProperty('icon');
    expect(tier).toHaveProperty('highlight');
    expect(tier).toHaveProperty('features');
    expect(Array.isArray(tier.features)).toBe(true);
  });
});

// ============================================================================
// getTierConfig — UI-facing config with CSS variable colors
// ============================================================================

describe('getTierConfig', () => {
  it('returns correct label and pricing for the pro tier', () => {
    const config = getTierConfig('pro');

    expect(config.label).toBe('SalesVelocity Pro');
    expect(config.monthlyPrice).toBe(PRICING.monthlyPrice);
    expect(config.annualPrice).toBe(PRICING.monthlyPrice * 10);
  });

  it('returns pro-tier defaults for unknown keys (flat-rate fallback)', () => {
    const config = getTierConfig('unknown');

    expect(config.label).toBe('SalesVelocity Pro');
    expect(config.monthlyPrice).toBe(PRICING.monthlyPrice);
  });

  it('returns pro-tier defaults for legacy tier keys', () => {
    const legacyKeys = ['free', 'starter', 'professional', 'enterprise'];
    legacyKeys.forEach((key) => {
      const config = getTierConfig(key);
      expect(config.monthlyPrice).toBe(PRICING.monthlyPrice);
    });
  });

  it('returns a badge (hex color) for the pro tier', () => {
    const config = getTierConfig('pro');

    // badge should be the raw hex color from the tier definition
    expect(config.badge).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ============================================================================
// TIER_RANK — ordering constants
// ============================================================================

describe('TIER_RANK', () => {
  it('assigns pro rank 1 (only paid tier)', () => {
    expect(TIER_RANK['pro']).toBe(1);
  });

  it('returns undefined for legacy tier keys not present in rank map', () => {
    expect(TIER_RANK['free']).toBeUndefined();
    expect(TIER_RANK['starter']).toBeUndefined();
    expect(TIER_RANK['professional']).toBeUndefined();
    expect(TIER_RANK['enterprise']).toBeUndefined();
  });
});

// ============================================================================
// SUBSCRIPTION_TIERS array — structure invariants
// ============================================================================

describe('SUBSCRIPTION_TIERS', () => {
  it('is an array', () => {
    expect(Array.isArray(SUBSCRIPTION_TIERS)).toBe(true);
  });

  it('contains exactly 1 tier (flat-rate model)', () => {
    expect(SUBSCRIPTION_TIERS).toHaveLength(1);
  });

  it('contains the pro tier key', () => {
    const keys = SUBSCRIPTION_TIERS.map(t => t.key);

    expect(keys).toContain('pro');
  });

  it('has a unique key for each tier', () => {
    const keys = SUBSCRIPTION_TIERS.map(t => t.key);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(SUBSCRIPTION_TIERS.length);
  });

  it('prices are positive for the pro tier', () => {
    SUBSCRIPTION_TIERS.forEach(tier => {
      expect(tier.monthlyPrice).toBeGreaterThan(0);
      expect(tier.annualPrice).toBeGreaterThan(0);
      expect(tier.monthlyPriceCents).toBeGreaterThan(0);
      expect(tier.annualPriceCents).toBeGreaterThan(0);
    });
  });

  it('priceCents values are exactly 100x the dollar prices', () => {
    SUBSCRIPTION_TIERS.forEach(tier => {
      expect(tier.monthlyPriceCents).toBe(tier.monthlyPrice * 100);
      expect(tier.annualPriceCents).toBe(tier.annualPrice * 100);
    });
  });

  it('each tier has at least one feature listed', () => {
    SUBSCRIPTION_TIERS.forEach(tier => {
      expect(tier.features.length).toBeGreaterThan(0);
    });
  });

  it('pro tier monthly price matches PRICING config', () => {
    const proTier = SUBSCRIPTION_TIERS[0];

    expect(proTier.monthlyPrice).toBe(PRICING.monthlyPrice);
  });
});
