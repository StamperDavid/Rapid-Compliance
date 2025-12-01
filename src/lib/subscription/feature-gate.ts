/**
 * Feature Gate Service
 * Enforces subscription limits and feature access control
 */

import { 
  OrganizationSubscription, 
  SubscriptionPlan,
  PLAN_LIMITS,
  PLAN_PRICING 
} from '@/types/subscription';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export class FeatureGate {
  /**
   * Check if organization has access to a specific outbound feature
   */
  static async hasFeature(
    orgId: string,
    feature: keyof OrganizationSubscription['outboundFeatures']
  ): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(orgId);
      
      // Check if subscription is active
      if (subscription.status !== 'active' && !subscription.isTrialing) {
        return false;
      }
      
      const featureConfig = subscription.outboundFeatures[feature];
      
      // Feature must exist and be enabled
      // Handle both object with enabled property and boolean values
      if (typeof featureConfig === 'boolean') {
        return featureConfig;
      }
      return (featureConfig as any)?.enabled === true;
    } catch (error) {
      console.error('[FeatureGate] Error checking feature access:', error);
      return false;
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
      console.error('[FeatureGate] Error checking usage limit:', error);
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
      console.error('[FeatureGate] Error incrementing usage:', error);
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
      
      console.log(`[FeatureGate] Reset monthly limits for org: ${orgId}`);
    } catch (error) {
      console.error('[FeatureGate] Error resetting monthly limits:', error);
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
      console.error('[FeatureGate] Error getting subscription:', error);
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
      console.error('[FeatureGate] Error saving subscription:', error);
      throw error;
    }
  }

  /**
   * Create default subscription for new organization
   */
  static async createDefaultSubscription(
    orgId: string,
    plan: SubscriptionPlan = 'professional' // Start with trial of professional plan
  ): Promise<OrganizationSubscription> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days trial
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // End of month
    
    const planLimits = PLAN_LIMITS[plan];
    const pricing = PLAN_PRICING[plan];
    
    const subscription: OrganizationSubscription = {
      organizationId: orgId,
      plan,
      billingCycle: 'monthly',
      status: 'trial',
      trialEndsAt: trialEnd.toISOString(),
      isTrialing: true,
      
      coreFeatures: {
        aiChatAgent: true,
        crm: true,
        ecommerce: true,
        workflows: true,
        whiteLabel: plan !== 'starter',
      },
      
      outboundFeatures: planLimits as any,
      
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
    
    console.log(`[FeatureGate] Created default ${plan} subscription for org: ${orgId}`);
    
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
      
      console.log(`[FeatureGate] Updated subscription from ${oldPlan} to ${newPlan} for org: ${orgId}`);
      
      return subscription;
    } catch (error) {
      console.error('[FeatureGate] Error updating plan:', error);
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
      
      console.log(`[FeatureGate] Toggled ${feature} to ${enabled} for org: ${orgId}`);
    } catch (error) {
      console.error('[FeatureGate] Error toggling feature:', error);
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
      
      console.log(`[FeatureGate] Added add-on ${addOnId} for org: ${orgId}`);
    } catch (error) {
      console.error('[FeatureGate] Error adding add-on:', error);
      throw error;
    }
  }
}

