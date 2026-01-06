/**
 * Subscription Management Service
 * For admin dashboard to manage customer subscriptions and plans
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where } from 'firebase/firestore';
import type { SubscriptionPlan, CustomerSubscription, RevenueMetrics, AdminCustomer, PlanDetails } from '@/types/subscription'
import { logger } from '@/lib/logger/logger';;

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
    logger.error('[Subscription Manager] Error fetching plans:', error, { file: 'subscription-manager.ts' });
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
    monthlyPrice: plan.monthlyPrice ?? undefined,
    yearlyPrice: plan.yearlyPrice ?? undefined,
    currency: plan.currency || 'usd',
    limits: plan.limits || {
      agents: undefined,
      conversationsPerMonth: undefined,
      crmRecords: undefined,
      users: undefined,
      workspaces: undefined,
      apiCallsPerMonth: undefined,
      storageGB: undefined,
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
        
        // Get support ticket counts if available
        let openTickets = 0;
        let totalTickets = 0;
        try {
          const tickets = await FirestoreService.getAll(
            `${COLLECTIONS.ORGANIZATIONS}/${org.id}/support_tickets`,
            []
          );
          totalTickets = tickets.length;
          openTickets = tickets.filter((t: any) => 
            t.status === 'open' || t.status === 'in_progress'
          ).length;
        } catch (error) {
          // No support tickets collection exists yet, that's fine
        }
        
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
          openTickets,
          totalTickets,
          createdAt: (org as any).createdAt || new Date().toISOString(),
          trialStartedAt: subscription.status === 'trialing' ? subscription.createdAt : undefined,
          convertedAt: subscription.status === 'active' ? subscription.currentPeriodStart : undefined,
        });
      }
    }
    
    return customers;
  } catch (error) {
    logger.error('[Subscription Manager] Error fetching customers:', error, { file: 'subscription-manager.ts' });
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
    
    // Count users - get all members with access to this organization
    const usersSnapshot = await FirestoreService.getAll(
      COLLECTIONS.USERS,
      [where('organizationId', '==', organizationId)]
    );
    const users = usersSnapshot.length;
    
    // Count CRM records (approximate across all workspaces)
    let crmRecords = 0;
    try {
      const [leads, deals, contacts] = await Promise.all([
        FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/default/entities/leads/records`,
          []
        ),
        FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/default/entities/deals/records`,
          []
        ),
        FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/default/entities/contacts/records`,
          []
        ),
      ]);
      crmRecords = leads.length + deals.length + contacts.length;
    } catch (error) {
      // If collection doesn't exist, that's okay
      crmRecords = 0;
    }
    
    // Count conversations from agent instances
    let conversations = 0;
    try {
      const instances = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/agentInstances`,
        []
      );
      conversations = instances.length;
    } catch (error) {
      conversations = 0;
    }
    
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
  if (subscription.status === 'past_due') {score -= 30;}
  if (subscription.status === 'cancelled') {score -= 50;}
  
  // Deduct for low usage
  const usageRate = usage.conversations / 100; // Assume 100 is good baseline
  if (usageRate < 0.2) {score -= 20;}
  if (usageRate < 0.1) {score -= 30;}
  
  // Add for high usage (engaged customers)
  if (usageRate > 0.8) {score += 10;}
  if (usageRate > 1.5) {score += 20;}
  
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
      c.subscription && (c.subscription.status === 'active' || c.subscription.status === 'trial')
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
      c.subscription?.status === 'cancelled' &&
      c.subscription.canceledAt &&
      new Date(c.subscription.canceledAt) >= periodStart &&
      new Date(c.subscription.canceledAt) <= periodEnd
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
    
    // Calculate revenue churn rate (MRR lost from churned customers)
    let revenueChurnRate = 0;
    if (mrr > 0) {
      let lostMrr = 0;
      for (const customer of customers.filter(c =>
        c.subscription?.status === 'cancelled' &&
        c.subscription.canceledAt &&
        new Date(c.subscription.canceledAt) >= periodStart &&
        new Date(c.subscription.canceledAt) <= periodEnd
      )) {
        const sub = customer.subscription as any;
        if (sub.billingCycle === 'monthly') {
          lostMrr += sub.amount || sub.mrr || 0;
        } else {
          lostMrr += (sub.amount || sub.mrr || 0) / 12;
        }
      }
      revenueChurnRate = (lostMrr / mrr) * 100;
    }
    
    // Calculate MRR growth (compare to previous period)
    const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);
    const previousPeriodEnd = new Date(periodStart);
    
    let previousMrr = 0;
    for (const customer of customers) {
      const createdAt = new Date(customer.createdAt);
      if (createdAt < previousPeriodEnd && customer.subscription?.status === 'active') {
        const sub = customer.subscription as any;
        if (sub.billingCycle === 'monthly') {
          previousMrr += sub.amount || sub.mrr || 0;
        } else {
          previousMrr += (sub.amount || sub.mrr || 0) / 12;
        }
      }
    }
    
    const mrrGrowth = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : 0;
    const arrGrowth = mrrGrowth; // ARR grows at same rate as MRR
    
    // Calculate customer lifetime value (simplified: average revenue * average lifetime)
    // Estimate average lifetime as inverse of churn rate (in months)
    const avgLifetimeMonths = churnRate > 0 ? (100 / churnRate) : 36; // Default to 36 months if no churn
    const avgRevenuePerCustomer = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;
    const customerLifetimeValue = avgRevenuePerCustomer * avgLifetimeMonths;
    
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
      revenueChurnRate,
      mrrGrowth,
      arrGrowth,
      averageRevenuePerCustomer: avgRevenuePerCustomer,
      customerLifetimeValue,
      revenueByPlan: revenueByPlanArray,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Subscription Manager] Error calculating metrics:', error, { file: 'subscription-manager.ts' });
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

