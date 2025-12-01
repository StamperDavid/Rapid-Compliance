/**
 * Subscription Management Service
 * For admin dashboard to manage customer subscriptions and plans
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { SubscriptionPlan, CustomerSubscription, RevenueMetrics, AdminCustomer, PlanDetails } from '@/types/subscription';

/**
 * Get all subscription plans
 */
export async function getAllPlans(): Promise<PlanDetails[]> {
  try {
    const plans = await FirestoreService.getAll(
      'subscriptionPlans',
      []
    );
    
    return (plans as unknown as PlanDetails[]).sort((a, b) => a.displayOrder - b.displayOrder);
  } catch (error) {
    console.error('[Subscription Manager] Error fetching plans:', error);
    return [];
  }
}

/**
 * Create or update a subscription plan
 */
export async function savePlan(plan: Partial<PlanDetails>): Promise<void> {
  const planId = plan.id || `plan_${Date.now()}`;
  
  const planData: PlanDetails = {
    id: planId,
    name: plan.name || '',
    description: plan.description || '',
    monthlyPrice: plan.monthlyPrice ?? null,
    yearlyPrice: plan.yearlyPrice ?? null,
    currency: plan.currency || 'usd',
    limits: plan.limits || {
      agents: null,
      conversationsPerMonth: null,
      crmRecords: null,
      users: null,
      workspaces: null,
      apiCallsPerMonth: null,
      storageGB: null,
    },
    features: plan.features || [],
    displayOrder: plan.displayOrder ?? 0,
    isPopular: plan.isPopular ?? false,
    isActive: plan.isActive ?? true,
    createdAt: plan.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await FirestoreService.set(
    'subscriptionPlans',
    planId,
    planData,
    false
  );
}

/**
 * Delete a subscription plan
 */
export async function deletePlan(planId: string): Promise<void> {
  await FirestoreService.delete('subscriptionPlans', planId);
}

/**
 * Get all customers with subscriptions
 */
export async function getAllCustomers(): Promise<AdminCustomer[]> {
  try {
    // Get all organizations
    const organizations = await FirestoreService.getAll(
      COLLECTIONS.ORGANIZATIONS,
      []
    );
    
    const customers: AdminCustomer[] = [];
    
    for (const org of organizations) {
      // Get subscription
      const subscription = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${org.id}/subscription`,
        'current'
      ) as CustomerSubscription | null;
      
      if (subscription) {
        // Get usage stats
        const usage = await getOrganizationUsage(org.id);
        
        // Calculate health score
        const healthScore = calculateHealthScore(subscription, usage);
        
        customers.push({
          id: org.id,
          organizationId: org.id,
          companyName: (org as any).name || 'Unknown',
          industry: (org as any).industry,
          website: (org as any).website,
          primaryContact: {
            name: (org as any).primaryContact?.name || 'Unknown',
            email: (org as any).primaryContact?.email || 'Unknown',
            phone: (org as any).primaryContact?.phone,
          },
          subscription,
          usage,
          healthScore,
          riskLevel: healthScore >= 70 ? 'low' : healthScore >= 40 ? 'medium' : 'high',
          lastActive: (org as any).lastActive || new Date().toISOString(),
          openTickets: 0, // TODO: Get from support system
          totalTickets: 0,
          createdAt: (org as any).createdAt || new Date().toISOString(),
          trialStartedAt: subscription.status === 'trialing' ? subscription.createdAt : undefined,
          convertedAt: subscription.status === 'active' ? subscription.currentPeriodStart : undefined,
        });
      }
    }
    
    return customers;
  } catch (error) {
    console.error('[Subscription Manager] Error fetching customers:', error);
    return [];
  }
}

/**
 * Get organization usage stats
 */
async function getOrganizationUsage(organizationId: string): Promise<{
  agents: number;
  conversations: number;
  crmRecords: number;
  users: number;
}> {
  try {
    // Count agents
    const agents = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
      []
    );
    
    // Count users (TODO: implement)
    const users = 1;
    
    // Count CRM records (approximate across all workspaces)
    const crmRecords = 0; // TODO: Count across all workspaces
    
    // Count conversations (TODO: implement)
    const conversations = 0;
    
    return {
      agents: agents.length,
      conversations,
      crmRecords,
      users,
    };
  } catch (error) {
    return {
      agents: 0,
      conversations: 0,
      crmRecords: 0,
      users: 0,
    };
  }
}

/**
 * Calculate customer health score (0-100)
 */
function calculateHealthScore(
  subscription: CustomerSubscription,
  usage: any
): number {
  let score = 100;
  
  // Deduct for status
  if (subscription.status === 'past_due') score -= 30;
  if (subscription.status === 'cancelled') score -= 50;
  
  // Deduct for low usage
  const usageRate = usage.conversations / 100; // Assume 100 is good baseline
  if (usageRate < 0.2) score -= 20;
  if (usageRate < 0.1) score -= 30;
  
  // Add for high usage (engaged customers)
  if (usageRate > 0.8) score += 10;
  if (usageRate > 1.5) score += 20;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate revenue metrics
 */
export async function calculateRevenueMetrics(
  startDate: string,
  endDate: string
): Promise<RevenueMetrics> {
  try {
    // Get all active subscriptions
    const customers = await getAllCustomers();
    const activeSubscriptions = customers.filter(c => 
      c.subscription.status === 'active' || c.subscription.status === 'trial'
    );
    
    // Calculate MRR
    let mrr = 0;
    for (const customer of activeSubscriptions) {
      const sub = customer.subscription as any;
      if (sub.billingCycle === 'monthly') {
        mrr += sub.amount || sub.mrr || 0;
      } else if (sub.billingCycle === 'yearly') {
        mrr += (sub.amount || sub.mrr || 0) / 12;
      }
    }
    
    // Calculate ARR
    const arr = mrr * 12;
    
    // Calculate new customers in period
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const newCustomers = customers.filter(c => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= periodStart && createdAt <= periodEnd;
    }).length;
    
    // Calculate churned customers
    const churnedCustomers = customers.filter(c =>
      c.subscription.status === 'cancelled' &&
      c.subscription.canceledAt &&
      new Date(c.subscription.canceledAt as string) >= periodStart &&
      new Date(c.subscription.canceledAt as string) <= periodEnd
    ).length;
    
    // Calculate churn rate
    const churnRate = activeSubscriptions.length > 0
      ? (churnedCustomers / activeSubscriptions.length) * 100
      : 0;
    
    // Revenue by plan
    const revenueByPlan = new Map<string, { planName: string; customers: number; mrr: number }>();
    for (const customer of activeSubscriptions) {
      const sub = customer.subscription as any;
      const planId = sub.planId || sub.plan || 'unknown';
      const planName = sub.planName || sub.plan || 'Unknown Plan';
      
      if (!revenueByPlan.has(planId)) {
        revenueByPlan.set(planId, { planName, customers: 0, mrr: 0 });
      }
      
      const plan = revenueByPlan.get(planId)!;
      plan.customers += 1;
      
      if (sub.billingCycle === 'monthly') {
        plan.mrr += sub.amount || sub.mrr || 0;
      } else {
        plan.mrr += (sub.amount || sub.mrr || 0) / 12;
      }
    }
    
    const revenueByPlanArray = Array.from(revenueByPlan.entries()).map(([planId, data]) => ({
      planId,
      planName: data.planName,
      customers: data.customers,
      mrr: data.mrr,
      percentage: mrr > 0 ? (data.mrr / mrr) * 100 : 0,
    }));
    
    return {
      startDate,
      endDate,
      mrr,
      arr,
      totalRevenue: mrr, // Simplified
      totalCustomers: activeSubscriptions.length,
      newCustomers,
      churnedCustomers,
      churnRate,
      revenueChurnRate: 0, // TODO: Calculate based on revenue lost
      mrrGrowth: 0, // TODO: Compare to previous period
      arrGrowth: 0,
      averageRevenuePerCustomer: activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0,
      customerLifetimeValue: 0, // TODO: Calculate based on historical data
      revenueByPlan: revenueByPlanArray,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Subscription Manager] Error calculating metrics:', error);
    throw error;
  }
}

/**
 * Update customer subscription
 */
export async function updateCustomerSubscription(
  organizationId: string,
  updates: Partial<CustomerSubscription>
): Promise<void> {
  const subscription = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscription`,
    'current'
  ) as CustomerSubscription;
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscription`,
    'current',
    {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString(),
    },
    false
  );
}

