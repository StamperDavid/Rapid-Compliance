/**
 * Subscription Tiers Unit Tests
 *
 * Tests for the centralized pricing module at src/lib/pricing/subscription-tiers.ts
 * Validates all tier configs, pricing accuracy, rank ordering, and utility functions.
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

// ============================================================================
// getTier — lookup by key
// ============================================================================

describe('getTier', () => {
  it('returns the free tier with price 0', () => {
    const tier = getTier('free');

    expect(tier).toBeDefined();
    expect(tier?.key).toBe('free' satisfies SubscriptionTierKey);
    expect(tier?.monthlyPrice).toBe(0);
    expect(tier?.annualPrice).toBe(0);
    expect(tier?.monthlyPriceCents).toBe(0);
    expect(tier?.annualPriceCents).toBe(0);
  });

  it('returns the starter tier with correct pricing ($29 monthly / $290 yearly)', () => {
    const tier = getTier('starter');

    expect(tier).toBeDefined();
    expect(tier?.key).toBe('starter' satisfies SubscriptionTierKey);
    expect(tier?.monthlyPrice).toBe(29);
    expect(tier?.annualPrice).toBe(290);
    expect(tier?.monthlyPriceCents).toBe(2900);
    expect(tier?.annualPriceCents).toBe(29000);
  });

  it('returns the professional tier with correct pricing ($79 monthly / $790 yearly)', () => {
    const tier = getTier('professional');

    expect(tier).toBeDefined();
    expect(tier?.key).toBe('professional' satisfies SubscriptionTierKey);
    expect(tier?.monthlyPrice).toBe(79);
    expect(tier?.annualPrice).toBe(790);
    expect(tier?.monthlyPriceCents).toBe(7900);
    expect(tier?.annualPriceCents).toBe(79000);
  });

  it('returns the enterprise tier with correct pricing ($199 monthly / $1990 yearly)', () => {
    const tier = getTier('enterprise');

    expect(tier).toBeDefined();
    expect(tier?.key).toBe('enterprise' satisfies SubscriptionTierKey);
    expect(tier?.monthlyPrice).toBe(199);
    expect(tier?.annualPrice).toBe(1990);
    expect(tier?.monthlyPriceCents).toBe(19900);
    expect(tier?.annualPriceCents).toBe(199000);
  });

  it('returns undefined for a nonexistent tier key', () => {
    const tier = getTier('nonexistent');

    expect(tier).toBeUndefined();
  });

  it('returns a tier with the required SubscriptionTier shape', () => {
    const tier = getTier('professional') as SubscriptionTier;

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
  it('returns correct label and pricing for the free tier', () => {
    const config = getTierConfig('free');

    expect(config.label).toBe('Free');
    expect(config.monthlyPrice).toBe(0);
    expect(config.annualPrice).toBe(0);
  });

  it('returns correct label and pricing for the starter tier', () => {
    const config = getTierConfig('starter');

    expect(config.label).toBe('Starter');
    expect(config.monthlyPrice).toBe(29);
    expect(config.annualPrice).toBe(290);
  });

  it('returns correct label and pricing for the professional tier', () => {
    const config = getTierConfig('professional');

    expect(config.label).toBe('Professional');
    expect(config.monthlyPrice).toBe(79);
    expect(config.annualPrice).toBe(790);
  });

  it('returns correct label and pricing for the enterprise tier', () => {
    const config = getTierConfig('enterprise');

    expect(config.label).toBe('Enterprise');
    expect(config.monthlyPrice).toBe(199);
    expect(config.annualPrice).toBe(1990);
  });

  it('returns free-tier defaults for an unknown key', () => {
    const config = getTierConfig('unknown');

    expect(config.label).toBe('Free');
    expect(config.monthlyPrice).toBe(0);
    expect(config.annualPrice).toBe(0);
  });

  it('returns a badge (hex color) for the professional tier', () => {
    const config = getTierConfig('professional');

    // badge should be the raw hex color from the tier definition
    expect(config.badge).toBe('#059669');
  });
});

// ============================================================================
// TIER_RANK — ordering constants
// ============================================================================

describe('TIER_RANK', () => {
  it('assigns free the lowest rank (0)', () => {
    expect(TIER_RANK['free']).toBe(0);
  });

  it('assigns starter rank 1', () => {
    expect(TIER_RANK['starter']).toBe(1);
  });

  it('assigns professional rank 2', () => {
    expect(TIER_RANK['professional']).toBe(2);
  });

  it('assigns enterprise the highest rank (3)', () => {
    expect(TIER_RANK['enterprise']).toBe(3);
  });

  it('enforces strict ascending order: free < starter < professional < enterprise', () => {
    expect(TIER_RANK['free']).toBeLessThan(TIER_RANK['starter']);
    expect(TIER_RANK['starter']).toBeLessThan(TIER_RANK['professional']);
    expect(TIER_RANK['professional']).toBeLessThan(TIER_RANK['enterprise']);
  });
});

// ============================================================================
// SUBSCRIPTION_TIERS array — structure invariants
// ============================================================================

describe('SUBSCRIPTION_TIERS', () => {
  it('is an array', () => {
    expect(Array.isArray(SUBSCRIPTION_TIERS)).toBe(true);
  });

  it('contains exactly 4 tiers', () => {
    expect(SUBSCRIPTION_TIERS).toHaveLength(4);
  });

  it('contains all four expected tier keys', () => {
    const keys = SUBSCRIPTION_TIERS.map(t => t.key);

    expect(keys).toContain('free');
    expect(keys).toContain('starter');
    expect(keys).toContain('professional');
    expect(keys).toContain('enterprise');
  });

  it('has a unique key for each tier', () => {
    const keys = SUBSCRIPTION_TIERS.map(t => t.key);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(SUBSCRIPTION_TIERS.length);
  });

  it('prices are non-negative for all tiers', () => {
    SUBSCRIPTION_TIERS.forEach(tier => {
      expect(tier.monthlyPrice).toBeGreaterThanOrEqual(0);
      expect(tier.annualPrice).toBeGreaterThanOrEqual(0);
      expect(tier.monthlyPriceCents).toBeGreaterThanOrEqual(0);
      expect(tier.annualPriceCents).toBeGreaterThanOrEqual(0);
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
});
