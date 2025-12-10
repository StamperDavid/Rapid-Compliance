/**
 * Subscription Middleware
 * Protects API routes based on subscription features and usage limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from './feature-gate';
import { OrganizationSubscription } from '@/types/subscription';

/**
 * Require that organization has access to a specific feature
 * Returns error response if feature is not available
 */
export async function requireFeature(
  request: NextRequest,
  orgId: string,
  feature: keyof OrganizationSubscription['outboundFeatures']
): Promise<NextResponse | null> {
  try {
    const hasAccess = await FeatureGate.hasFeature(orgId, feature);
    
    if (!hasAccess) {
      const subscription = await FeatureGate.getSubscription(orgId);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Feature '${feature}' is not available on your current plan`,
          currentPlan: subscription.plan,
          feature,
          upgrade: true,
          upgradeMessage: getUpgradeMessage(feature, subscription.plan),
        },
        { status: 403 }
      );
    }
    
    return null; // Feature is available, continue
  } catch (error: any) {
    console.error('[Subscription Middleware] Error checking feature access:', error);
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
  request: NextRequest,
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
          upgradeMessage: getLimitUpgradeMessage(feature, subscription.plan),
          currentPlan: subscription.plan,
        },
        { status: 429 } // Too Many Requests
      );
    }
    
    return null; // Under limit, continue
  } catch (error: any) {
    console.error('[Subscription Middleware] Error checking usage limit:', error);
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
  if (featureCheck) return featureCheck;
  
  // Then check usage limit
  const limitCheck = await requireLimit(request, orgId, feature, amount);
  if (limitCheck) return limitCheck;
  
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
    console.error('[Subscription Middleware] Error incrementing usage:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Map feature identifier to subscription feature key
 */
function getFeatureKey(
  feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email'
): keyof OrganizationSubscription['outboundFeatures'] {
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
 * Get user-friendly upgrade message for a feature
 */
function getUpgradeMessage(
  feature: keyof OrganizationSubscription['outboundFeatures'],
  currentPlan: string
): string {
  const messages: Record<string, Record<string, string>> = {
    aiEmailWriter: {
      starter: 'Upgrade to Professional ($299/mo) to unlock AI Email Writer with 500 emails/month',
      professional: 'This feature is already available on your plan',
      enterprise: 'This feature is already available on your plan',
    },
    emailSequences: {
      starter: 'Upgrade to Professional ($299/mo) to unlock Email Sequences',
      professional: 'This feature is already available on your plan',
      enterprise: 'This feature is already available on your plan',
    },
    emailReplyHandler: {
      starter: 'Upgrade to Professional ($299/mo) to unlock AI Reply Handler',
      professional: 'This feature is already available on your plan',
      enterprise: 'This feature is already available on your plan',
    },
    prospectFinder: {
      starter: 'Upgrade to Enterprise ($999/mo) to unlock Prospect Finder',
      professional: 'Add Advanced Outbound add-on (+$199/mo) or upgrade to Enterprise ($999/mo)',
      enterprise: 'This feature is already available on your plan',
    },
    multiChannel: {
      starter: 'Upgrade to Enterprise ($999/mo) to unlock Multi-Channel Outreach',
      professional: 'Add Advanced Outbound add-on (+$199/mo) or upgrade to Enterprise ($999/mo)',
      enterprise: 'This feature is already available on your plan',
    },
    abTesting: {
      starter: 'Upgrade to Professional ($299/mo) to unlock A/B Testing',
      professional: 'This feature is already available on your plan',
      enterprise: 'This feature is already available on your plan',
    },
  };
  
  return messages[feature]?.[currentPlan] || `Upgrade your plan to unlock ${feature}`;
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
    if (gateCheck) return gateCheck;
    
    // Execute the handler
    const result = await handler();
    
    // Increment usage on success
    await incrementFeatureUsage(orgId, feature, amount);
    
    // Return success
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Feature Gate] Error in handler:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}











