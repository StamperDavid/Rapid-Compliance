/**
 * Subscription Middleware
 * Protects API routes based on subscription features and usage limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from './feature-gate';
import type { OrganizationSubscription } from '@/types/subscription'
import { logger } from '@/lib/logger/logger';

/**
 * NEW: All features are available to all active/trialing subscriptions
 * This now only checks if subscription is active, not which features they have
 */
export async function requireFeature(
  _request: NextRequest,
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'multiChannel'
): Promise<NextResponse | null> {
  try {
    const hasAccess = await FeatureGate.hasFeature(orgId, feature);

    if (!hasAccess) {
      const subscription = await FeatureGate.getSubscription(orgId);

      // In new model, if hasAccess is false, it means subscription is inactive
      // NOT that they don't have the feature
      return NextResponse.json(
        {
          success: false,
          error: `Your subscription is ${subscription.status}. Please reactivate to access this feature.`,
          subscriptionStatus: subscription.status,
          feature,
          reactivateRequired: true,
        },
        { status: 403 }
      );
    }

    return null; // Feature is available, continue
  } catch (error) {
    logger.error('[Subscription Middleware] Error checking feature access:', error, { file: 'middleware.ts' });
    return NextResponse.json(
      { success: false, error: 'Failed to verify feature access' },
      { status: 500 }
    );
  }
}

/**
 * Require that organization hasn't exceeded usage limit for a feature
 * Returns error response if limit is exceeded
 */
export async function requireLimit(
  _request: NextRequest,
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
  amount: number = 1
): Promise<NextResponse | null> {
  try {
    const limit = await FeatureGate.checkLimit(orgId, feature, amount);

    if (!limit.allowed) {
      const subscription = await FeatureGate.getSubscription(orgId);

      return NextResponse.json(
        {
          success: false,
          error: `Monthly limit exceeded for ${feature}`,
          feature,
          limit: limit.limit,
          used: limit.used,
          remaining: limit.remaining,
          requested: amount,
          upgrade: true,
          upgradeMessage: getLimitUpgradeMessage(feature, subscription.plan ?? 'free'),
          currentPlan: subscription.plan,
        },
        { status: 429 } // Too Many Requests
      );
    }

    return null; // Under limit, continue
  } catch (error) {
    logger.error('[Subscription Middleware] Error checking usage limit:', error, { file: 'middleware.ts' });
    return NextResponse.json(
      { success: false, error: 'Failed to verify usage limit' },
      { status: 500 }
    );
  }
}

/**
 * Combined middleware: Check both feature access AND usage limit
 */
export async function requireFeatureWithLimit(
  request: NextRequest,
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
  amount: number = 1
): Promise<NextResponse | null> {
  // First check if feature is enabled
  const featureKey = getFeatureKey(feature);
  const featureCheck = await requireFeature(request, orgId, featureKey);
  if (featureCheck) {return featureCheck;}
  
  // Then check usage limit
  const limitCheck = await requireLimit(request, orgId, feature, amount);
  if (limitCheck) {return limitCheck;}
  
  return null; // Both checks passed
}

/**
 * Increment usage after successful operation
 * Call this after the API operation succeeds
 */
export async function incrementFeatureUsage(
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
  amount: number = 1
): Promise<void> {
  try {
    await FeatureGate.incrementUsage(orgId, feature, amount);
  } catch (error) {
    logger.error('[Subscription Middleware] Error incrementing usage:', error, { file: 'middleware.ts' });
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Map feature identifier to subscription feature key
 */
function getFeatureKey(
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email'
): 'aiEmailWriter' | 'prospectFinder' | 'multiChannel' {
  switch (feature) {
    case 'aiEmailWriter':
      return 'aiEmailWriter';
    case 'prospectFinder':
      return 'prospectFinder';
    case 'linkedin':
    case 'sms':
    case 'email':
      return 'multiChannel';
    default:
      return 'aiEmailWriter'; // Fallback
  }
}


/**
 * Get user-friendly upgrade message when limit is exceeded
 */
function getLimitUpgradeMessage(
  feature: string,
  currentPlan: string
): string {
  const messages: Record<string, Record<string, string>> = {
    aiEmailWriter: {
      starter: 'Upgrade to Professional for 500 emails/month or Enterprise for 5,000 emails/month',
      professional: 'Upgrade to Enterprise for 5,000 emails/month or purchase one-time top-up (+100 emails for $49)',
      enterprise: 'You\'ve reached the Enterprise limit. Contact us for custom pricing.',
    },
    prospectFinder: {
      starter: 'Upgrade to Professional or Enterprise to unlock Prospect Finder',
      professional: 'Add Advanced Outbound add-on for 100 prospects/month or upgrade to Enterprise for 1,000 prospects/month',
      enterprise: 'Purchase one-time top-up (+100 prospects for $99)',
    },
    linkedin: {
      starter: 'Upgrade to Professional or Enterprise to unlock LinkedIn automation',
      professional: 'Add Advanced Outbound add-on for 100 actions/month or upgrade to Enterprise for 500 actions/month',
      enterprise: 'You\'ve reached the Enterprise limit. Contact us for custom pricing.',
    },
    sms: {
      starter: 'Upgrade to Professional or Enterprise to unlock SMS sequences',
      professional: 'Add Advanced Outbound add-on for 100 messages/month or upgrade to Enterprise for 1,000 messages/month',
      enterprise: 'You\'ve reached the Enterprise limit. Contact us for custom pricing.',
    },
    email: {
      starter: 'Upgrade to Professional for 2,000 emails/month or Enterprise for unlimited emails',
      professional: 'Upgrade to Enterprise for unlimited emails',
      enterprise: 'You have unlimited emails on Enterprise plan',
    },
  };
  
  return messages[feature]?.[currentPlan] || `Upgrade your plan to increase your ${feature} limit`;
}

/**
 * Example usage wrapper for API routes
 * Use this pattern in outbound API routes
 */
export async function withFeatureGate<T>(
  request: NextRequest,
  orgId: string,
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
  amount: number,
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    // Check feature access and limits
    const gateCheck = await requireFeatureWithLimit(request, orgId, feature, amount);
    if (gateCheck) {return gateCheck;}

    // Execute the handler
    const result = await handler();

    // Increment usage on success
    await incrementFeatureUsage(orgId, feature, amount);

    // Return success
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error && error.message ? error.message : 'Operation failed';
    logger.error('[Feature Gate] Error in handler:', error, { file: 'middleware.ts' });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}



















