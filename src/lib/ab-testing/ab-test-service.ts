/**
 * A/B Testing Framework
 * Data-driven optimization through variant testing
 */

import { cacheService, CacheTTL } from '../cache/redis-service';

export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABVariant[];
  targetMetric: string;
  trafficAllocation: number; // Percentage of users to include (0-100)
  startDate?: string;
  endDate?: string;
  winner?: string; // Variant ID
  confidence?: number; // Statistical confidence (0-100)
  createdAt: string;
  updatedAt: string;
}

export interface ABVariant {
  id: string;
  name: string;
  description?: string;
  trafficWeight: number; // Percentage of test traffic (must sum to 100)
  config: Record<string, any>; // Variant-specific configuration
  metrics: ABMetrics;
}

export interface ABMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  avgSessionTime?: number;
  bounceRate?: number;
}

export interface ABAssignment {
  testId: string;
  variantId: string;
  userId: string;
  assignedAt: string;
}

/**
 * Create new A/B test
 */
export async function createABTest(
  organizationId: string,
  test: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ABTest> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  const testId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const fullTest: ABTest = {
    ...test,
    id: testId,
    createdAt: now,
    updatedAt: now,
  };
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/abTests`,
    testId,
    fullTest,
    false
  );
  
  return fullTest;
}

/**
 * Get variant for user (with assignment caching)
 */
export async function getVariantForUser(
  testId: string,
  userId: string
): Promise<ABVariant | null> {
  // Check cache first
  const cacheKey = `ab:assignment:${testId}:${userId}`;
  const cached = await cacheService.get<string>(cacheKey);
  
  if (cached) {
    const test = await getABTest(testId);
    return test?.variants.find(v => v.id === cached) || null;
  }
  
  // Get test
  const test = await getABTest(testId);
  
  if (!test || test.status !== 'running') {
    return null;
  }
  
  // Check if user should be included in test
  const userHash = hashUserId(userId);
  const isIncluded = (userHash % 100) < test.trafficAllocation;
  
  if (!isIncluded) {
    return null;
  }
  
  // Assign variant based on traffic weights
  const variant = assignVariant(test.variants, userHash);
  
  // Save assignment
  await saveAssignment({
    testId,
    variantId: variant.id,
    userId,
    assignedAt: new Date().toISOString(),
  });
  
  // Cache assignment (24 hours)
  await cacheService.set(cacheKey, variant.id, { ttl: CacheTTL.DAY });
  
  return variant;
}

/**
 * Track impression (user saw the variant)
 */
export async function trackImpression(
  testId: string,
  variantId: string
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Increment impression count
  const test = await getABTest(testId);
  if (!test) return;
  
  const variant = test.variants.find(v => v.id === variantId);
  if (!variant) return;
  
  variant.metrics.impressions++;
  variant.metrics.conversionRate = calculateConversionRate(variant.metrics);
  
  test.updatedAt = new Date().toISOString();
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/*/abTests`,
    testId,
    test,
    true
  );
}

/**
 * Track conversion (user completed target action)
 */
export async function trackConversion(
  testId: string,
  variantId: string,
  revenue?: number
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  const test = await getABTest(testId);
  if (!test) return;
  
  const variant = test.variants.find(v => v.id === variantId);
  if (!variant) return;
  
  variant.metrics.conversions++;
  
  if (revenue) {
    variant.metrics.revenue = (variant.metrics.revenue || 0) + revenue;
  }
  
  variant.metrics.conversionRate = calculateConversionRate(variant.metrics);
  
  test.updatedAt = new Date().toISOString();
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/*/abTests`,
    testId,
    test,
    true
  );
  
  // Check if we have a winner
  await checkForWinner(test);
}

/**
 * Get A/B test results
 */
export async function getABTestResults(testId: string): Promise<{
  test: ABTest;
  winner: ABVariant | null;
  confidence: number;
  insights: string[];
}> {
  const test = await getABTest(testId);
  
  if (!test) {
    throw new Error('Test not found');
  }
  
  // Calculate statistical significance
  const { winner, confidence } = calculateStatisticalSignificance(test.variants);
  
  // Generate insights
  const insights = generateInsights(test.variants);
  
  return {
    test,
    winner,
    confidence,
    insights,
  };
}

/**
 * Auto-declare winner if statistically significant
 */
async function checkForWinner(test: ABTest): Promise<void> {
  // Only check if test is running and has enough data
  if (test.status !== 'running') return;
  
  const totalImpressions = test.variants.reduce((sum, v) => sum + v.metrics.impressions, 0);
  
  // Need at least 1000 impressions
  if (totalImpressions < 1000) return;
  
  const { winner, confidence } = calculateStatisticalSignificance(test.variants);
  
  // Declare winner if 95%+ confidence
  if (winner && confidence >= 95) {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    test.status = 'completed';
    test.winner = winner.id;
    test.confidence = confidence;
    test.endDate = new Date().toISOString();
    
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/*/abTests`,
      test.id,
      test,
      true
    );
    
    console.log(`[A/B Test] Winner declared for ${test.name}: ${winner.name} (${confidence.toFixed(1)}% confidence)`);
  }
}

/**
 * Calculate statistical significance using Z-test
 */
function calculateStatisticalSignificance(
  variants: ABVariant[]
): { winner: ABVariant | null; confidence: number } {
  if (variants.length < 2) {
    return { winner: null, confidence: 0 };
  }
  
  // Sort by conversion rate
  const sorted = [...variants].sort((a, b) => 
    b.metrics.conversionRate - a.metrics.conversionRate
  );
  
  const best = sorted[0];
  const second = sorted[1];
  
  // Calculate Z-score
  const p1 = best.metrics.conversionRate / 100;
  const p2 = second.metrics.conversionRate / 100;
  const n1 = best.metrics.impressions;
  const n2 = second.metrics.impressions;
  
  if (n1 === 0 || n2 === 0) {
    return { winner: null, confidence: 0 };
  }
  
  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
  
  if (se === 0) {
    return { winner: null, confidence: 0 };
  }
  
  const zScore = (p1 - p2) / se;
  
  // Convert Z-score to confidence level
  const confidence = zScoreToConfidence(Math.abs(zScore));
  
  return {
    winner: confidence >= 50 ? best : null,
    confidence,
  };
}

/**
 * Convert Z-score to confidence percentage
 */
function zScoreToConfidence(zScore: number): number {
  // Approximate p-value from z-score
  const t = 1 / (1 + 0.2316419 * zScore);
  const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return (1 - p) * 100;
}

/**
 * Generate insights from test results
 */
function generateInsights(variants: ABVariant[]): string[] {
  const insights: string[] = [];
  
  // Sort by conversion rate
  const sorted = [...variants].sort((a, b) => 
    b.metrics.conversionRate - a.metrics.conversionRate
  );
  
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  
  // Conversion rate insight
  const improvement = best.metrics.conversionRate - worst.metrics.conversionRate;
  insights.push(
    `Best variant (${best.name}) has ${improvement.toFixed(1)}% higher conversion rate than worst variant (${worst.name})`
  );
  
  // Revenue insight
  if (best.metrics.revenue && worst.metrics.revenue) {
    const revenueImprovement = ((best.metrics.revenue - worst.metrics.revenue) / worst.metrics.revenue) * 100;
    insights.push(
      `Best variant generates ${revenueImprovement.toFixed(1)}% more revenue`
    );
  }
  
  // Sample size insight
  const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);
  if (totalImpressions < 1000) {
    insights.push(
      `⚠️ Need more data: ${totalImpressions} impressions (recommended: 1000+)`
    );
  }
  
  return insights;
}

/**
 * Helper functions
 */

async function getABTest(testId: string): Promise<ABTest | null> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  return await FirestoreService.get<ABTest>(
    `${COLLECTIONS.ORGANIZATIONS}/*/abTests`,
    testId
  );
}

async function saveAssignment(assignment: ABAssignment): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/*/abAssignments`,
    `${assignment.testId}_${assignment.userId}`,
    assignment,
    false
  );
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function assignVariant(variants: ABVariant[], userHash: number): ABVariant {
  const random = userHash % 100;
  let cumulative = 0;
  
  for (const variant of variants) {
    cumulative += variant.trafficWeight;
    if (random < cumulative) {
      return variant;
    }
  }
  
  return variants[0]; // Fallback
}

function calculateConversionRate(metrics: ABMetrics): number {
  if (metrics.impressions === 0) return 0;
  return (metrics.conversions / metrics.impressions) * 100;
}

/**
 * Common A/B test templates
 */
export const ABTestTemplates = {
  /**
   * Checkout flow test
   */
  checkoutFlow: (organizationId: string) =>
    createABTest(organizationId, {
      name: 'Checkout Flow Optimization',
      description: 'Test one-page vs multi-step checkout',
      status: 'draft',
      targetMetric: 'checkout_completion',
      trafficAllocation: 50,
      variants: [
        {
          id: 'control',
          name: 'Multi-step Checkout',
          trafficWeight: 50,
          config: { checkoutType: 'multi-step' },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
        {
          id: 'variant-a',
          name: 'One-page Checkout',
          trafficWeight: 50,
          config: { checkoutType: 'one-page' },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
      ],
    }),
  
  /**
   * Pricing test
   */
  pricing: (organizationId: string) =>
    createABTest(organizationId, {
      name: 'Pricing Strategy Test',
      description: 'Test different price points',
      status: 'draft',
      targetMetric: 'purchase',
      trafficAllocation: 100,
      variants: [
        {
          id: 'price-99',
          name: '$99/month',
          trafficWeight: 33,
          config: { price: 99 },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
        {
          id: 'price-149',
          name: '$149/month',
          trafficWeight: 33,
          config: { price: 149 },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
        {
          id: 'price-199',
          name: '$199/month',
          trafficWeight: 34,
          config: { price: 199 },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
      ],
    }),
  
  /**
   * CTA button test
   */
  ctaButton: (organizationId: string) =>
    createABTest(organizationId, {
      name: 'CTA Button Optimization',
      description: 'Test button copy and color',
      status: 'draft',
      targetMetric: 'click_through',
      trafficAllocation: 100,
      variants: [
        {
          id: 'control',
          name: 'Blue - "Get Started"',
          trafficWeight: 50,
          config: { color: 'blue', text: 'Get Started' },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
        {
          id: 'variant-a',
          name: 'Green - "Start Free Trial"',
          trafficWeight: 50,
          config: { color: 'green', text: 'Start Free Trial' },
          metrics: { impressions: 0, conversions: 0, conversionRate: 0 },
        },
      ],
    }),
};



















