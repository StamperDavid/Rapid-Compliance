/**
 * Subscription Service - Volume-Based Model
 * In the new pricing model, ALL features are available to ALL tiers
 * The only limit is record capacity (storage), not feature access
 */

import { 
  OrganizationSubscription, 
  SubscriptionPlan,
  SubscriptionTier,
  PLAN_LIMITS,
  PLAN_PRICING,
  VOLUME_TIERS,
  TIER_PRICING,
  getTierForRecordCount,
  isWithinTierCapacity
} from '@/types/subscription';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

export class FeatureGate {
  /**
   * NEW: All features are available to all tiers
   * This method now always returns true (no gating)
   */
  static async hasFeature(
    orgId: string,
    feature: keyof OrganizationSubscription['outboundFeatures']
  ): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      // Only check if subscription is active or trialing
      // If yes, ALL features are available
      if (subscription.status === 'active' || subscription.isTrialing) {
        return true; // ✨ Everyone gets everything!
      }
      
      // If subscription is past_due, canceled, or paused, block access
      return false;
    } catch (error) {
      logger.error('[FeatureGate] Error checking feature access:', error, { file: 'feature-gate.ts' });
      return false;
    }
  }
  
  /**
   * NEW: Check record capacity (the only limit in volume-based pricing)
   */
  static async checkRecordCapacity(
    orgId: string,
    additionalRecords: number = 0
  ): Promise<{
    allowed: boolean;
    currentCount: number;
    newTotal: number;
    capacity: number;
    tier: SubscriptionTier;
    needsUpgrade: boolean;
    requiredTier?: SubscriptionTier;
  }> {
    try {
      const subscription = await this.getSubscription(orgId);
      const currentCount = subscription.recordCount || 0;
      const newTotal = currentCount + additionalRecords;
      
      // Determine current tier
      const currentTier = subscription.tier || getTierForRecordCount(currentCount);
      const capacity = VOLUME_TIERS[currentTier].recordMax;
      
      // Check if within capacity
      const allowed = newTotal <= capacity;
      
      // If exceeding, determine required tier
      let requiredTier: SubscriptionTier | undefined;
      if (!allowed) {
        requiredTier = getTierForRecordCount(newTotal);
      }
      
      return {
        allowed,
        currentCount,
        newTotal,
        capacity,
        tier: currentTier,
        needsUpgrade: !allowed,
        requiredTier,
      };
    } catch (error) {
      logger.error('[FeatureGate] Error checking record capacity:', error, { file: 'feature-gate.ts' });
      return {
        allowed: false,
        currentCount: 0,
        newTotal: additionalRecords,
        capacity: 0,
        tier: 'tier1',
        needsUpgrade: false,
      };
    }
  }

  /**
   * Check if organization has reached usage limit for a feature
   */
  static async checkLimit(
    orgId: string,
    feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
    requestedAmount: number = 1
  ): Promise<{ 
    allowed: boolean; 
    remaining: number; 
    limit: number;
    used: number;
  }> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      let used = 0;
      let limit = 0;
      
      switch (feature) {
        case 'aiEmailWriter':
          if (!subscription.outboundFeatures.aiEmailWriter.enabled) {
            return { allowed: false, remaining: 0, limit: 0, used: 0 };
          }
          used = subscription.outboundFeatures.aiEmailWriter.used;
          limit = subscription.outboundFeatures.aiEmailWriter.monthlyLimit;
          break;
          
        case 'prospectFinder':
          if (!subscription.outboundFeatures.prospectFinder.enabled) {
            return { allowed: false, remaining: 0, limit: 0, used: 0 };
          }
          used = subscription.outboundFeatures.prospectFinder.used;
          limit = subscription.outboundFeatures.prospectFinder.monthlyLimit;
          break;
          
        case 'linkedin':
          if (!subscription.outboundFeatures.multiChannel.channels.linkedin.enabled) {
            return { allowed: false, remaining: 0, limit: 0, used: 0 };
          }
          used = subscription.outboundFeatures.multiChannel.channels.linkedin.used;
          limit = subscription.outboundFeatures.multiChannel.channels.linkedin.monthlyLimit;
          break;
          
        case 'sms':
          if (!subscription.outboundFeatures.multiChannel.channels.sms.enabled) {
            return { allowed: false, remaining: 0, limit: 0, used: 0 };
          }
          used = subscription.outboundFeatures.multiChannel.channels.sms.used;
          limit = subscription.outboundFeatures.multiChannel.channels.sms.monthlyLimit;
          break;
          
        case 'email':
          if (!subscription.outboundFeatures.multiChannel.channels.email.enabled) {
            return { allowed: false, remaining: 0, limit: 0, used: 0 };
          }
          used = subscription.outboundFeatures.multiChannel.channels.email.used;
          limit = subscription.outboundFeatures.multiChannel.channels.email.monthlyLimit;
          break;
      }
      
      const remaining = Math.max(0, limit - used);
      const allowed = remaining >= requestedAmount;
      
      return { allowed, remaining, limit, used };
    } catch (error) {
      logger.error('[FeatureGate] Error checking usage limit:', error, { file: 'feature-gate.ts' });
      return { allowed: false, remaining: 0, limit: 0, used: 0 };
    }
  }

  /**
   * Increment usage counter for a feature
   */
  static async incrementUsage(
    orgId: string,
    feature: 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email',
    amount: number = 1
  ): Promise<void> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      // Update feature-specific usage
      switch (feature) {
        case 'aiEmailWriter':
          subscription.outboundFeatures.aiEmailWriter.used += amount;
          subscription.usage.aiEmailsGenerated += amount;
          break;
          
        case 'prospectFinder':
          subscription.outboundFeatures.prospectFinder.used += amount;
          subscription.usage.prospectsFilled += amount;
          break;
          
        case 'linkedin':
          subscription.outboundFeatures.multiChannel.channels.linkedin.used += amount;
          subscription.usage.linkedinConnectionRequests += amount;
          break;
          
        case 'sms':
          subscription.outboundFeatures.multiChannel.channels.sms.used += amount;
          subscription.usage.smsSent += amount;
          break;
          
        case 'email':
          subscription.outboundFeatures.multiChannel.channels.email.used += amount;
          subscription.usage.emailsSent += amount;
          break;
      }
      
      subscription.updatedAt = new Date().toISOString();
      
      await this.saveSubscription(orgId, subscription);
    } catch (error) {
      logger.error('[FeatureGate] Error incrementing usage:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * Reset monthly usage limits (called on 1st of each month)
   */
  static async resetMonthlyLimits(orgId: string): Promise<void> {
    try {
      const subscription = await this.getSubscription(orgId);
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      // Reset AI Email Writer
      subscription.outboundFeatures.aiEmailWriter.used = 0;
      subscription.outboundFeatures.aiEmailWriter.resetDate = now.toISOString();
      
      // Reset Prospect Finder
      subscription.outboundFeatures.prospectFinder.used = 0;
      subscription.outboundFeatures.prospectFinder.resetDate = now.toISOString();
      
      // Reset Multi-Channel
      subscription.outboundFeatures.multiChannel.channels.email.used = 0;
      subscription.outboundFeatures.multiChannel.channels.linkedin.used = 0;
      subscription.outboundFeatures.multiChannel.channels.sms.used = 0;
      
      // Reset Meeting Scheduler
      subscription.outboundFeatures.meetingScheduler.meetingsBookedThisMonth = 0;
      
      // Reset usage metrics for new period
      subscription.usage = {
        ...subscription.usage,
        emailsSent: 0,
        emailsDelivered: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        emailsReplied: 0,
        linkedinConnectionRequests: 0,
        linkedinMessagesSet: 0,
        smsSent: 0,
        smsDelivered: 0,
        smsReplied: 0,
        prospectsFilled: 0,
        prospectsEnrolled: 0,
        prospectsConverted: 0,
        meetingsBooked: 0,
        meetingsHeld: 0,
        meetingsNoShow: 0,
        aiEmailsGenerated: 0,
        aiRepliesGenerated: 0,
        aiTokensUsed: 0,
        periodStart: now.toISOString(),
        periodEnd: nextMonth.toISOString(),
      };
      
      subscription.updatedAt = now.toISOString();
      
      await this.saveSubscription(orgId, subscription);
      
      logger.info('FeatureGate Reset monthly limits for org: orgId}', { file: 'feature-gate.ts' });
    } catch (error) {
      logger.error('[FeatureGate] Error resetting monthly limits:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * Get subscription for organization
   */
  static async getSubscription(orgId: string): Promise<OrganizationSubscription> {
    try {
      const sub = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
        'subscription'
      );
      
      if (!sub) {
        // Create default subscription if doesn't exist
        return await this.createDefaultSubscription(orgId);
      }
      
      return sub as OrganizationSubscription;
    } catch (error) {
      logger.error('[FeatureGate] Error getting subscription:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * Save subscription to Firestore
   */
  private static async saveSubscription(
    orgId: string,
    subscription: OrganizationSubscription
  ): Promise<void> {
    try {
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
        'subscription',
        subscription,
        false
      );
    } catch (error) {
      logger.error('[FeatureGate] Error saving subscription:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * NEW: Create default subscription with volume-based tier
   */
  static async createDefaultSubscription(
    orgId: string,
    tier: SubscriptionTier = 'tier1' // Start with Tier 1 trial
  ): Promise<OrganizationSubscription> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days trial
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // End of month
    
    const tierDetails = VOLUME_TIERS[tier];
    const pricing = TIER_PRICING[tier];
    
    const subscription: OrganizationSubscription = {
      organizationId: orgId,
      tier, // NEW: Volume-based tier
      plan: undefined, // DEPRECATED: No longer used
      billingCycle: 'monthly',
      status: 'trial',
      trialEndsAt: trialEnd.toISOString(),
      isTrialing: true,
      trialRequiresPayment: true, // NEW: Credit card required for trial
      
      // NEW: Record capacity tracking
      recordCount: 0,
      recordCapacity: tierDetails.recordMax,
      recordCountLastUpdated: now.toISOString(),
      
      // NEW: All features enabled
      allFeaturesEnabled: true,
      
      // DEPRECATED: Feature gating fields (kept for backward compatibility)
      coreFeatures: {
        aiChatAgent: true,
        crm: true,
        ecommerce: true,
        workflows: true,
        whiteLabel: true, // Everyone gets white-label now
      },
      
      // DEPRECATED: No longer gating outbound features
      outboundFeatures: undefined,
      
      addOns: [],
      
      usage: {
        emailsSent: 0,
        emailsDelivered: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        emailsReplied: 0,
        linkedinConnectionRequests: 0,
        linkedinMessagesSet: 0,
        linkedinAcceptanceRate: 0,
        smsSent: 0,
        smsDelivered: 0,
        smsReplied: 0,
        prospectsFilled: 0,
        prospectsEnrolled: 0,
        prospectsConverted: 0,
        meetingsBooked: 0,
        meetingsHeld: 0,
        meetingsNoShow: 0,
        aiEmailsGenerated: 0,
        aiRepliesGenerated: 0,
        aiTokensUsed: 0,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      
      billing: {
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        nextBillingDate: trialEnd.toISOString(),
        basePrice: pricing.monthly,
        addOnsPrice: 0,
        totalMRR: 0, // $0 during trial
      },
      
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    
    await this.saveSubscription(orgId, subscription);
    
    logger.info('FeatureGate Created default plan} subscription for org: orgId}', { file: 'feature-gate.ts' });
    
    return subscription;
  }

  /**
   * Update subscription plan
   */
  static async updatePlan(
    orgId: string,
    newPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<OrganizationSubscription> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      const oldPlan = subscription.plan;
      subscription.plan = newPlan;
      subscription.billingCycle = billingCycle;
      
      // Update limits based on new plan
      const newLimits = PLAN_LIMITS[newPlan];
      subscription.outboundFeatures = {
        ...subscription.outboundFeatures,
        ...newLimits,
      } as any;
      
      // Update pricing
      const pricing = PLAN_PRICING[newPlan];
      subscription.billing.basePrice = billingCycle === 'monthly' ? pricing.monthly : pricing.yearly;
      subscription.billing.totalMRR = subscription.billing.basePrice + subscription.billing.addOnsPrice;
      
      // If upgrading from trial, activate subscription
      if (subscription.isTrialing) {
        subscription.status = 'active';
        subscription.isTrialing = false;
      }
      
      subscription.updatedAt = new Date().toISOString();
      
      await this.saveSubscription(orgId, subscription);
      
      logger.info('FeatureGate Updated subscription from oldPlan} to newPlan} for org: orgId}', { file: 'feature-gate.ts' });
      
      return subscription;
    } catch (error) {
      logger.error('[FeatureGate] Error updating plan:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * Toggle a specific feature on/off
   */
  static async toggleFeature(
    orgId: string,
    feature: keyof OrganizationSubscription['outboundFeatures'],
    enabled: boolean
  ): Promise<void> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      // Check if plan allows this feature
      const planLimits = PLAN_LIMITS[subscription.plan];
      const featureConfig = planLimits[feature];
      
      // Handle both boolean and object feature configs
      const isFeatureAvailable = typeof featureConfig === 'boolean' 
        ? featureConfig 
        : (featureConfig as any)?.enabled === true;
      
      if (!featureConfig || !isFeatureAvailable) {
        throw new Error(`Feature ${feature} not available on ${subscription.plan} plan`);
      }
      
      // Toggle feature
      (subscription.outboundFeatures[feature] as any).enabled = enabled;
      subscription.updatedAt = new Date().toISOString();
      
      await this.saveSubscription(orgId, subscription);
      
      logger.info('FeatureGate Toggled feature} to enabled} for org: orgId}', { file: 'feature-gate.ts' });
    } catch (error) {
      logger.error('[FeatureGate] Error toggling feature:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }

  /**
   * Add an add-on to subscription
   */
  static async addAddOn(
    orgId: string,
    addOnId: string
  ): Promise<void> {
    try {
      const subscription = await this.getSubscription(orgId);
      const { AVAILABLE_ADDONS } = await import('@/types/subscription');
      
      const addOnConfig = AVAILABLE_ADDONS[addOnId];
      if (!addOnConfig) {
        throw new Error(`Add-on ${addOnId} not found`);
      }
      
      // Check if already added
      if (subscription.addOns.some(a => a.name === addOnConfig.name)) {
        throw new Error(`Add-on ${addOnConfig.name} already added`);
      }
      
      // Add the add-on
      subscription.addOns.push({
        id: addOnId,
        ...addOnConfig,
        enabled: true,
        addedAt: new Date().toISOString(),
      });
      
      // Update pricing
      subscription.billing.addOnsPrice = subscription.addOns.reduce(
        (sum, addon) => sum + addon.price,
        0
      );
      subscription.billing.totalMRR = subscription.billing.basePrice + subscription.billing.addOnsPrice;
      
      subscription.updatedAt = new Date().toISOString();
      
      await this.saveSubscription(orgId, subscription);
      
      logger.info('FeatureGate Added add-on addOnId} for org: orgId}', { file: 'feature-gate.ts' });
    } catch (error) {
      logger.error('[FeatureGate] Error adding add-on:', error, { file: 'feature-gate.ts' });
      throw error;
    }
  }
}

