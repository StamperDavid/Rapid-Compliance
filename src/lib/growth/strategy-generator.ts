/**
 * Strategy Generator Service
 *
 * Generates 3-tier growth strategies (Aggressive/Competitive/Scrappy) based on
 * competitor data, keyword rankings, and business metrics. Integrates with
 * Jasper Command Authority for approval routing, and upon approval dispatches
 * execution commands to the Marketing Manager and specialist agents.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getGrowthStrategiesCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { aggregateBusinessData } from '@/lib/agents/growth-strategist/data-aggregator';
import {
  getJasperCommandAuthority,
  type PendingApproval,
} from '@/lib/orchestrator/jasper-command-authority';
import { getGrowthActivityLogger } from './growth-activity-logger';
import { getCompetitorMonitorService } from './competitor-monitor';
import { getKeywordTrackerService } from './keyword-tracker';
import type {
  GrowthStrategy,
  StrategyTier,
  StrategyTierDetail,
  StrategyAction,
  BudgetConstraints,
  StrategyApproval,
} from '@/types/growth';

// ============================================================================
// STRATEGY GENERATION
// ============================================================================

class StrategyGeneratorService {
  /**
   * Generate a new 3-tier growth strategy based on current data.
   */
  async generateStrategy(
    constraints: BudgetConstraints,
    requestedBy: string
  ): Promise<GrowthStrategy> {
    if (!adminDb) {throw new Error('Database not available');}

    // Gather all data sources
    const [businessData, competitors, keywords] = await Promise.all([
      aggregateBusinessData(30),
      getCompetitorMonitorService().listCompetitors({ activeOnly: true }),
      getKeywordTrackerService().listKeywords({ activeOnly: true }),
    ]);

    const dataContext = {
      competitorCount: competitors.length,
      trackedKeywords: keywords.length,
      avgDomainAuthority:
        competitors.length > 0
          ? Math.round(
              competitors.reduce((sum, c) => sum + c.domainAuthority, 0) /
                competitors.length
            )
          : 0,
      topCompetitors: competitors.slice(0, 5).map((c) => c.domain),
      topKeywordGaps: keywords
        .filter((k) => k.currentPosition === null)
        .slice(0, 10)
        .map((k) => k.keyword),
    };

    // Generate the 3 tiers
    const aggressiveTier = this.buildAggressiveTier(constraints, dataContext, businessData);
    const competitiveTier = this.buildCompetitiveTier(constraints, dataContext, businessData);
    const scrappyTier = this.buildScrappyTier(constraints, dataContext, businessData);

    const now = new Date().toISOString();
    const strategy: Omit<GrowthStrategy, 'id'> = {
      generatedAt: now,
      requestedBy,
      status: 'pending_approval',
      approvedTier: null,
      approval: null,
      budgetConstraints: constraints,
      tiers: {
        aggressive: aggressiveTier,
        competitive: competitiveTier,
        scrappy: scrappyTier,
      },
      dataContext,
    };

    const collectionPath = getGrowthStrategiesCollection();
    const docRef = await adminDb.collection(collectionPath).add({
      ...strategy,
      createdAt: FieldValue.serverTimestamp(),
    });

    const result: GrowthStrategy = { id: docRef.id, ...strategy };

    // Queue for approval via Jasper Command Authority
    const jasper = getJasperCommandAuthority();
    const approvalPayload: Omit<PendingApproval, 'approvalId' | 'status' | 'createdAt'> = {
      requestedBy: 'GROWTH_COMMAND_CENTER',
      type: 'LARGE_CAMPAIGN',
      description: `Growth strategy generated with 3 tiers. Budget range: $${constraints.minMonthlyBudget}-$${constraints.maxMonthlyBudget}/mo. Goal: ${constraints.primaryGoal}. ${competitors.length} competitors analyzed, ${keywords.length} keywords tracked.`,
      urgency: 'NORMAL',
      context: {
        strategyId: docRef.id,
        tiers: {
          aggressive: { budget: aggressiveTier.monthlyBudget, roi: aggressiveTier.expectedROI },
          competitive: { budget: competitiveTier.monthlyBudget, roi: competitiveTier.expectedROI },
          scrappy: { budget: scrappyTier.monthlyBudget, roi: scrappyTier.expectedROI },
        },
      },
    };
    jasper.queueForApproval(approvalPayload);

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'strategy_generated',
      `Growth strategy generated: Aggressive ($${aggressiveTier.monthlyBudget}/mo), Competitive ($${competitiveTier.monthlyBudget}/mo), Scrappy ($${scrappyTier.monthlyBudget}/mo)`,
      requestedBy,
      {
        strategyId: docRef.id,
        goal: constraints.primaryGoal,
        budget: constraints.maxMonthlyBudget,
      }
    );

    return result;
  }

  /**
   * Get the latest strategy.
   */
  async getLatestStrategy(): Promise<GrowthStrategy | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthStrategiesCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {return null;}
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as GrowthStrategy;
  }

  /**
   * Get a strategy by ID.
   */
  async getById(strategyId: string): Promise<GrowthStrategy | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthStrategiesCollection();
    const doc = await adminDb.collection(collectionPath).doc(strategyId).get();
    if (!doc.exists) {return null;}
    return { id: doc.id, ...doc.data() } as GrowthStrategy;
  }

  /**
   * Approve a strategy tier. This triggers execution via Jasper Command Authority.
   */
  async approveStrategy(
    strategyId: string,
    tier: StrategyTier,
    notes: string,
    approvedBy: string
  ): Promise<GrowthStrategy> {
    if (!adminDb) {throw new Error('Database not available');}

    const strategy = await this.getById(strategyId);
    if (!strategy) {throw new Error('Strategy not found');}
    if (strategy.status !== 'pending_approval') {
      throw new Error(`Strategy is ${strategy.status}, not pending approval`);
    }

    const now = new Date().toISOString();
    const approval: StrategyApproval = {
      approvedBy,
      approvedAt: now,
      tier,
      notes,
      jasperApprovalId: null,
    };

    const collectionPath = getGrowthStrategiesCollection();
    await adminDb.collection(collectionPath).doc(strategyId).update({
      status: 'approved',
      approvedTier: tier,
      approval,
    });

    // Dispatch execution commands via Jasper
    await this.dispatchStrategyExecution(strategy, tier);

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'strategy_approved',
      `Growth strategy approved: ${tier} tier ($${strategy.tiers[tier].monthlyBudget}/mo)`,
      approvedBy,
      { strategyId, tier, budget: strategy.tiers[tier].monthlyBudget }
    );

    return { ...strategy, status: 'approved', approvedTier: tier, approval };
  }

  /**
   * Reject a strategy.
   */
  async rejectStrategy(
    strategyId: string,
    reason: string,
    rejectedBy: string
  ): Promise<GrowthStrategy> {
    if (!adminDb) {throw new Error('Database not available');}

    const strategy = await this.getById(strategyId);
    if (!strategy) {throw new Error('Strategy not found');}

    const collectionPath = getGrowthStrategiesCollection();
    await adminDb.collection(collectionPath).doc(strategyId).update({
      status: 'rejected',
      rejectionReason: reason,
      rejectedBy,
      rejectedAt: new Date().toISOString(),
    });

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'strategy_rejected',
      `Growth strategy rejected: "${reason}"`,
      rejectedBy,
      { strategyId, reason }
    );

    return { ...strategy, status: 'rejected' };
  }

  /**
   * Dispatch execution commands to the agent swarm after approval.
   * This tells the Marketing Manager, SEO, and content agents to start working.
   */
  private async dispatchStrategyExecution(
    strategy: GrowthStrategy,
    tier: StrategyTier
  ): Promise<void> {
    const jasper = getJasperCommandAuthority();
    const tierData = strategy.tiers[tier];

    // Group actions by channel
    const actionsByChannel = new Map<string, StrategyAction[]>();
    for (const action of tierData.actions) {
      const existing = actionsByChannel.get(action.channel) ?? [];
      existing.push(action);
      actionsByChannel.set(action.channel, existing);
    }

    // Issue commands per channel
    const commandPromises: Promise<unknown>[] = [];

    // SEO actions → Marketing Manager SEO specialist
    const seoActions = actionsByChannel.get('seo') ?? [];
    if (seoActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'MARKETING_MANAGER',
          'EXECUTE_SEO_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: seoActions,
            budget: seoActions.reduce((s, a) => s + a.budgetAllocation, 0),
            keywords: strategy.dataContext.topKeywordGaps,
          },
          'HIGH'
        )
      );
    }

    // Content actions → Content Manager
    const contentActions = actionsByChannel.get('content') ?? [];
    if (contentActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'CONTENT_MANAGER',
          'EXECUTE_CONTENT_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: contentActions,
            budget: contentActions.reduce((s, a) => s + a.budgetAllocation, 0),
          },
          'NORMAL'
        )
      );
    }

    // Social actions → Marketing Manager social specialists
    const socialActions = actionsByChannel.get('social') ?? [];
    if (socialActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'MARKETING_MANAGER',
          'EXECUTE_SOCIAL_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: socialActions,
            budget: socialActions.reduce((s, a) => s + a.budgetAllocation, 0),
          },
          'NORMAL'
        )
      );
    }

    // Paid actions → Marketing Manager paid specialists
    const paidActions = actionsByChannel.get('paid') ?? [];
    if (paidActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'MARKETING_MANAGER',
          'EXECUTE_PAID_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: paidActions,
            budget: paidActions.reduce((s, a) => s + a.budgetAllocation, 0),
          },
          'NORMAL'
        )
      );
    }

    // Email actions → Outreach Manager
    const emailActions = actionsByChannel.get('email') ?? [];
    if (emailActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'OUTREACH_MANAGER',
          'EXECUTE_EMAIL_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: emailActions,
            budget: emailActions.reduce((s, a) => s + a.budgetAllocation, 0),
          },
          'NORMAL'
        )
      );
    }

    // Partnership actions → Intelligence Manager
    const partnershipActions = actionsByChannel.get('partnerships') ?? [];
    if (partnershipActions.length > 0) {
      commandPromises.push(
        jasper.issueCommand(
          'INTELLIGENCE_MANAGER',
          'EXECUTE_PARTNERSHIP_STRATEGY',
          {
            strategyId: strategy.id,
            tier,
            actions: partnershipActions,
          },
          'NORMAL'
        )
      );
    }

    try {
      await Promise.allSettled(commandPromises);
      logger.info('Strategy execution commands dispatched', {
        strategyId: strategy.id,
        tier,
        channelCount: actionsByChannel.size,
      });
    } catch (err) {
      logger.error(
        'Failed to dispatch some strategy commands',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  // ============================================================================
  // TIER BUILDERS
  // ============================================================================

  private buildAggressiveTier(
    constraints: BudgetConstraints,
    dataContext: GrowthStrategy['dataContext'],
    _businessData: Awaited<ReturnType<typeof aggregateBusinessData>>
  ): StrategyTierDetail {
    const budget = constraints.maxMonthlyBudget;
    const actions = this.generateActions(budget, constraints, dataContext, 'aggressive');

    return {
      tier: 'aggressive',
      label: 'Aggressive Growth',
      monthlyBudget: budget,
      expectedROI: 4.5,
      timeToResults: '2-3 months',
      summary: `Full-throttle growth: dominate SERP for ${dataContext.trackedKeywords} tracked keywords, outspend ${dataContext.competitorCount} competitors, and capture maximum market share. Includes paid ads, content blitz, and partnership outreach.`,
      actions,
      kpis: [
        'Organic traffic increase >50%',
        'Top 3 SERP for 60% of tracked keywords',
        'Lead generation increase >40%',
        'Domain authority increase >5 points',
        'Social engagement rate >5%',
      ],
      risks: [
        'High burn rate if campaigns underperform',
        'Competitor counter-moves may escalate ad costs',
        'Content quality may suffer at high volume',
      ],
    };
  }

  private buildCompetitiveTier(
    constraints: BudgetConstraints,
    dataContext: GrowthStrategy['dataContext'],
    _businessData: Awaited<ReturnType<typeof aggregateBusinessData>>
  ): StrategyTierDetail {
    const budget = Math.round(
      (constraints.maxMonthlyBudget + constraints.minMonthlyBudget) / 2
    );
    const actions = this.generateActions(budget, constraints, dataContext, 'competitive');

    return {
      tier: 'competitive',
      label: 'Competitive Match',
      monthlyBudget: budget,
      expectedROI: 3.0,
      timeToResults: '3-5 months',
      summary: `Match competitor spending and effort: targeted SEO for high-value keywords, moderate paid campaigns, and consistent content production. Focuses on closing gaps identified in competitor analysis.`,
      actions,
      kpis: [
        'Organic traffic increase >25%',
        'Top 10 SERP for 50% of tracked keywords',
        'Lead generation increase >20%',
        'Domain authority increase >3 points',
        'Social engagement rate >3%',
      ],
      risks: [
        'Slower time-to-results vs aggressive approach',
        'May not close gap against well-funded competitors',
      ],
    };
  }

  private buildScrappyTier(
    constraints: BudgetConstraints,
    dataContext: GrowthStrategy['dataContext'],
    _businessData: Awaited<ReturnType<typeof aggregateBusinessData>>
  ): StrategyTierDetail {
    const budget = Math.max(constraints.minMonthlyBudget, Math.round(constraints.maxMonthlyBudget * 0.2));
    const actions = this.generateActions(budget, constraints, dataContext, 'scrappy');

    return {
      tier: 'scrappy',
      label: 'Scrappy Bootstrap',
      monthlyBudget: budget,
      expectedROI: 6.0,
      timeToResults: '4-8 months',
      summary: `Maximum efficiency: leverage free/low-cost channels, focus on long-tail keywords competitors ignore, build organic presence through quality content and community engagement. Every dollar works twice.`,
      actions,
      kpis: [
        'Organic traffic increase >15%',
        'Top 20 SERP for 40% of tracked keywords',
        'Lead generation increase >10%',
        'Domain authority increase >2 points',
        'Build 10+ quality backlinks/month',
      ],
      risks: [
        'Significantly slower growth',
        'Limited ability to compete on paid channels',
        'Requires more manual effort',
      ],
    };
  }

  /**
   * Generate concrete strategy actions based on tier and budget.
   */
  private generateActions(
    totalBudget: number,
    constraints: BudgetConstraints,
    dataContext: GrowthStrategy['dataContext'],
    tier: StrategyTier
  ): StrategyAction[] {
    const actions: StrategyAction[] = [];
    let actionId = 1;
    const remaining = { budget: totalBudget };

    const allocate = (pct: number): number => Math.round(totalBudget * pct);

    // SEO — always included
    const seoBudget = tier === 'aggressive' ? allocate(0.25) : tier === 'competitive' ? allocate(0.3) : allocate(0.1);
    actions.push({
      id: `action_${actionId++}`,
      channel: 'seo',
      title: 'Technical SEO Audit & Fixes',
      description: `Run comprehensive technical SEO audit. Fix crawl errors, improve Core Web Vitals, optimize meta tags for ${dataContext.trackedKeywords} tracked keywords. Target long-tail gaps: ${dataContext.topKeywordGaps.slice(0, 3).join(', ') || 'TBD'}.`,
      budgetAllocation: Math.round(seoBudget * 0.3),
      priority: 1,
      impact: 'high',
      effort: tier === 'scrappy' ? 'high' : 'medium',
      cheaperAlternative: tier !== 'scrappy' ? {
        title: 'DIY SEO with free tools',
        description: 'Use Google Search Console, Screaming Frog (free), and manual fixes',
        estimatedCost: 0,
        tradeoffs: ['Slower implementation', 'Requires technical knowledge', 'No advanced insights'],
      } : null,
    });
    remaining.budget -= Math.round(seoBudget * 0.3);

    // Content/Blog strategy
    const contentBudget = tier === 'aggressive' ? allocate(0.2) : tier === 'competitive' ? allocate(0.25) : allocate(0.2);
    actions.push({
      id: `action_${actionId++}`,
      channel: 'content',
      title: 'SEO-Optimized Blog Content',
      description: tier === 'aggressive'
        ? `Publish 12-16 blog posts/month targeting tracked keywords and competitor gaps. Include pillar content, comparison posts, and thought leadership.`
        : tier === 'competitive'
          ? `Publish 6-8 blog posts/month targeting high-value keywords. Focus on comparison content and how-to guides.`
          : `Publish 2-4 high-quality blog posts/month targeting low-competition long-tail keywords with high intent.`,
      budgetAllocation: contentBudget,
      priority: 2,
      impact: 'high',
      effort: 'medium',
      cheaperAlternative: tier !== 'scrappy' ? {
        title: 'AI-assisted content with manual editing',
        description: 'Use AI to draft content, human editor for quality review',
        estimatedCost: Math.round(contentBudget * 0.3),
        tradeoffs: ['Lower unique insights', 'May need more editing', 'Faster turnaround'],
      } : null,
    });
    remaining.budget -= contentBudget;

    // Social media
    const socialBudget = tier === 'aggressive' ? allocate(0.15) : tier === 'competitive' ? allocate(0.15) : allocate(0.15);
    actions.push({
      id: `action_${actionId++}`,
      channel: 'social',
      title: 'Social Media Content & Engagement',
      description: tier === 'aggressive'
        ? `Daily posts across LinkedIn, Twitter, TikTok, Facebook. Paid boost for top-performing organic posts. Influencer partnerships.`
        : tier === 'competitive'
          ? `3-5 posts/week across LinkedIn and Twitter. Moderate paid amplification. Employee advocacy program.`
          : `2-3 posts/week on LinkedIn. Organic engagement strategy. Repurpose blog content for social snippets.`,
      budgetAllocation: socialBudget,
      priority: 3,
      impact: 'medium',
      effort: 'medium',
      cheaperAlternative: tier !== 'scrappy' ? {
        title: 'Organic-only social with auto-scheduling',
        description: 'Use free scheduling tools, focus on organic engagement and community building',
        estimatedCost: 0,
        tradeoffs: ['Lower reach', 'Slower follower growth', 'No paid amplification'],
      } : null,
    });
    remaining.budget -= socialBudget;

    // Paid advertising (aggressive and competitive only)
    if (tier !== 'scrappy') {
      const paidBudget = tier === 'aggressive' ? allocate(0.25) : allocate(0.15);
      actions.push({
        id: `action_${actionId++}`,
        channel: 'paid',
        title: 'Paid Search & Display Campaigns',
        description: tier === 'aggressive'
          ? `Google Ads campaigns targeting competitor brand keywords, high-intent search terms, and retargeting. Include YouTube pre-roll and LinkedIn sponsored content.`
          : `Google Ads for top 10 high-intent keywords. Retargeting campaigns for website visitors. Limited LinkedIn sponsored posts.`,
        budgetAllocation: paidBudget,
        priority: tier === 'aggressive' ? 2 : 4,
        impact: 'high',
        effort: 'low',
        cheaperAlternative: {
          title: 'Micro-budget PPC testing',
          description: 'Test with $5-10/day budgets on top 3 keywords only',
          estimatedCost: Math.round(paidBudget * 0.1),
          tradeoffs: ['Very limited reach', 'Slow data collection', 'May not hit volume thresholds'],
        },
      });
      remaining.budget -= paidBudget;
    }

    // Email marketing
    const emailBudget = tier === 'aggressive' ? allocate(0.1) : tier === 'competitive' ? allocate(0.1) : allocate(0.15);
    actions.push({
      id: `action_${actionId++}`,
      channel: 'email',
      title: 'Email Nurture & Outreach',
      description: tier === 'aggressive'
        ? `Weekly newsletter, automated nurture sequences for all lead stages, personalized outreach campaigns. A/B test subject lines and CTAs.`
        : tier === 'competitive'
          ? `Bi-weekly newsletter, automated nurture for MQLs, targeted outreach for high-value prospects.`
          : `Monthly newsletter repurposing blog content. Simple 3-email welcome sequence. Manual outreach for top prospects.`,
      budgetAllocation: emailBudget,
      priority: 4,
      impact: 'medium',
      effort: 'low',
      cheaperAlternative: tier !== 'scrappy' ? {
        title: 'Free-tier email tools',
        description: 'Use free tiers of email platforms, manual segmentation',
        estimatedCost: 0,
        tradeoffs: ['Limited automation', 'Smaller send limits', 'Fewer analytics'],
      } : null,
    });

    // Link building (SEO channel)
    actions.push({
      id: `action_${actionId++}`,
      channel: 'seo',
      title: 'Link Building & Digital PR',
      description: tier === 'aggressive'
        ? `Active outreach for guest posts, digital PR campaigns, HARO responses, broken link building. Target DA 40+ sites. Build 30+ links/month.`
        : tier === 'competitive'
          ? `Guest posting on industry blogs, HARO responses, resource page link building. Target DA 30+. Build 15+ links/month.`
          : `Community engagement for natural links, Reddit/forum participation, create linkable assets (tools, calculators, templates). Target 5+ links/month.`,
      budgetAllocation: Math.round(seoBudget * 0.7),
      priority: 2,
      impact: 'high',
      effort: 'high',
      cheaperAlternative: tier !== 'scrappy' ? {
        title: 'Organic link acquisition',
        description: 'Focus on creating linkable assets and community participation',
        estimatedCost: 0,
        tradeoffs: ['Unpredictable volume', 'Slower authority growth', 'Requires great content'],
      } : null,
    });

    // Partnerships (aggressive only gets dedicated budget)
    if (tier === 'aggressive') {
      actions.push({
        id: `action_${actionId++}`,
        channel: 'partnerships',
        title: 'Strategic Partnerships & Co-Marketing',
        description: `Identify complementary tools in ${constraints.industry}. Propose co-marketing campaigns, joint webinars, integration partnerships, and affiliate programs.`,
        budgetAllocation: allocate(0.05),
        priority: 5,
        impact: 'medium',
        effort: 'high',
        cheaperAlternative: {
          title: 'Informal partnership outreach',
          description: 'DM-based outreach, content swaps, and cross-promotion without formal agreements',
          estimatedCost: 0,
          tradeoffs: ['Less commitment from partners', 'Smaller scale', 'Slower to develop'],
        },
      });
    }

    return actions;
  }
}

// Singleton
let instance: StrategyGeneratorService | null = null;

export function getStrategyGeneratorService(): StrategyGeneratorService {
  instance ??= new StrategyGeneratorService();
  return instance;
}
