/**
 * Coaching Analytics Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * Core engine for analyzing sales rep performance across all metrics.
 * Aggregates data from deals, emails, activities, workflows, and revenue.
 * 
 * CORE CAPABILITIES:
 * - Multi-source data aggregation (deals, emails, activities, workflows)
 * - Performance metric calculation (conversion, efficiency, skills)
 * - Team benchmarking and percentile rankings
 * - Trend analysis (improving vs declining)
 * - Skill scoring based on behavioral patterns
 * - Performance tier classification
 * 
 * INTEGRATION:
 * - Admin DAL for Firestore queries
 * - Deal Scoring system
 * - Email Writer metrics
 * - Workflow Automation tracking
 * - Revenue Forecasting data
 */

import type { FirestoreAdminDAL } from '@/lib/firebase/admin-dal';
import { adminDb } from '@/lib/firebase/admin';
import type {
  RepPerformanceMetrics,
  DealPerformanceMetrics,
  CommunicationMetrics,
  ActivityMetrics,
  ConversionMetrics,
  RevenueMetrics,
  EfficiencyMetrics,
  SkillScores,
  PerformanceComparison,
  PerformanceTier,
  TimePeriod,
  CustomDateRange
} from './types';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DealData {
  id: string;
  status?: string;
  stage?: string;
  value?: number;
  healthScore?: number;
  createdAt?: { toDate?: () => Date } | Date | string;
  closedAt?: { toDate?: () => Date } | Date | string;
  firstContactAt?: { toDate?: () => Date } | Date | string;
  proposalSentAt?: { toDate?: () => Date } | Date | string;
  winProbability?: number;
}

interface EmailData {
  type?: string;
  replied?: boolean;
  sentAt?: { toDate?: () => Date } | Date | string;
  repliedAt?: { toDate?: () => Date } | Date | string;
  customInstructions?: string;
  isFollowUp?: boolean;
}

interface ActivityData {
  type?: string;
  completed?: boolean;
}

interface TeamMetrics {
  overallScore: number;
  winRate: number;
  revenue: number;
  activityPerDay: number;
  efficiency: number;
}

interface RepMetricsForComparison {
  overallScore: number;
  deals: DealPerformanceMetrics;
  communication: CommunicationMetrics;
  activity: ActivityMetrics;
  revenue: RevenueMetrics;
  efficiency: EfficiencyMetrics;
}

interface UserData {
  name?: string;
  email?: string;
  quota?: number;
}

// ============================================================================
// ANALYTICS ENGINE CLASS
// ============================================================================

export class CoachingAnalyticsEngine {
  constructor(private adminDal: FirestoreAdminDAL) {}

  /**
   * Analyzes performance for a single sales rep
   */
  async analyzeRepPerformance(
    repId: string,
    period: TimePeriod,
    customRange?: CustomDateRange
  ): Promise<RepPerformanceMetrics> {
    const startTime = Date.now();
    
    try {
      // Get date range for analysis
      const { startDate, endDate } = this.getDateRange(period, customRange);
      
      // Get rep info
      const repDoc = await this.adminDal.getCollection('USERS').doc(repId).get();
      if (!repDoc.exists) {
        throw new Error(`Rep not found: ${repId}`);
      }
      
      const repData = repDoc.data() as UserData | undefined;
      const repDataName = repData?.name;
      const repName = (repDataName !== '' && repDataName != null) ? repDataName : 'Unknown';
      const repEmail = repData?.email ?? '';

      // Fetch all metrics in parallel
      const [
        deals,
        communication,
        activity,
        conversion,
        revenue,
        efficiency,
        teamMetrics
      ] = await Promise.all([
        this.analyzeDealMetrics(repId, startDate, endDate),
        this.analyzeCommunicationMetrics(repId, startDate, endDate),
        this.analyzeActivityMetrics(repId, startDate, endDate),
        this.analyzeConversionMetrics(repId, startDate, endDate),
        this.analyzeRevenueMetrics(repId, startDate, endDate),
        this.analyzeEfficiencyMetrics(repId, startDate, endDate),
        this.getTeamAverageMetrics(startDate, endDate)
      ]);
      
      // Calculate skill scores
      const skills = this.calculateSkillScores({
        deals,
        communication,
        activity,
        conversion,
        revenue,
        efficiency
      });
      
      // Calculate overall performance score (weighted average)
      const overallScore = this.calculateOverallScore({
        deals,
        communication,
        activity,
        conversion,
        revenue,
        efficiency,
        skills
      });
      
      // Determine performance tier
      const tier = this.determinePerformanceTier(overallScore, deals.winRate, revenue.quotaAttainment);
      
      // Calculate comparison to team average
      const vsTeamAverage = this.calculateTeamComparison(
        { overallScore, deals, communication, activity, revenue, efficiency },
        teamMetrics
      );
      
      logger.info('Rep performance analysis completed', {
        repId,
        period,
        overallScore,
        tier,
        durationMs: Date.now() - startTime
      });
      
      return {
        repId,
        repName,
        repEmail,
        period,
        startDate,
        endDate,
        deals,
        communication,
        activity,
        conversion,
        revenue,
        efficiency,
        skills,
        overallScore,
        tier,
        vsTeamAverage
      };
    } catch (error) {
      logger.error('Error analyzing rep performance', error instanceof Error ? error : new Error(String(error)), { repId });
      throw error;
    }
  }

  /**
   * Analyzes deal performance metrics
   */
  private async analyzeDealMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DealPerformanceMetrics> {
    try {
      // Query deals for this rep in the time period
      const dealsRef = this.adminDal.getCollection('DEALS');
      const snapshot = await dealsRef
        .where('ownerId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DealData));
      
      const totalDeals = deals.length;
      const activeDeals = deals.filter((d: DealData) => !['won', 'lost', 'closed'].includes(d.status ?? '')).length;
      const dealsWon = deals.filter((d: DealData) => d.status === 'won').length;
      const dealsLost = deals.filter((d: DealData) => d.status === 'lost').length;
      const closedDeals = dealsWon + dealsLost;
      const winRate = closedDeals > 0 ? dealsWon / closedDeals : 0;
      
      // Calculate average deal size
      const wonDeals = deals.filter((d: DealData) => d.status === 'won');

      const totalValue = wonDeals.reduce((sum: number, d: DealData) => sum + (d.value ?? 0), 0);
      const averageDealSize = wonDeals.length > 0 ? totalValue / wonDeals.length : 0;
      
      // Calculate average deal cycle
      const cycleTimes = wonDeals
        .filter((d: DealData) => d.createdAt && d.closedAt)
        .map((d: DealData) => {
          const createdAtValue = d.createdAt;
          const closedAtValue = d.closedAt;
          if (!createdAtValue || !closedAtValue) {
            return 0;
          }
          const created = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
            ? createdAtValue.toDate()
            : (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue as string));
          const closed = typeof closedAtValue === 'object' && closedAtValue !== null && 'toDate' in closedAtValue && typeof closedAtValue.toDate === 'function'
            ? closedAtValue.toDate()
            : (closedAtValue instanceof Date ? closedAtValue : new Date(closedAtValue as string));
          return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });
      const averageCycleDays = cycleTimes.length > 0
        ? cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length
        : 0;
      
      // Calculate deal velocity (deals per week)
      const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const dealVelocity = periodDays > 0 ? (totalDeals / periodDays) * 7 : 0;
      
      // Count at-risk deals (using deal scoring data if available)
      const atRiskDeals = deals.filter((d: DealData) =>
        d.healthScore !== undefined && d.healthScore < 50
      ).length;

      // Health distribution
      const healthDistribution = {
        healthy: deals.filter((d: DealData) => d.healthScore !== undefined && d.healthScore >= 70).length,
        warning: deals.filter((d: DealData) => d.healthScore !== undefined && d.healthScore >= 50 && d.healthScore < 70).length,
        critical: deals.filter((d: DealData) => d.healthScore !== undefined && d.healthScore < 50).length
      };
      
      return {
        totalDeals,
        activeDeals,
        dealsWon,
        dealsLost,
        winRate,
        averageDealSize,
        averageCycleDays,
        dealVelocity,
        atRiskDeals,
        healthDistribution
      };
    } catch (error) {
      logger.error('Error analyzing deal metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      // Return zero metrics on error
      return {
        totalDeals: 0,
        activeDeals: 0,
        dealsWon: 0,
        dealsLost: 0,
        winRate: 0,
        averageDealSize: 0,
        averageCycleDays: 0,
        dealVelocity: 0,
        atRiskDeals: 0,
        healthDistribution: { healthy: 0, warning: 0, critical: 0 }
      };
    }
  }

  /**
   * Analyzes communication quality metrics
   */
  private async analyzeCommunicationMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CommunicationMetrics> {
    if (!adminDb) {
      return {
        emailsGenerated: 0,
        emailsSent: 0,
        emailResponseRate: 0,
        averageResponseTime: 0,
        aiEmailUsageRate: 0,
        personalizationScore: 0,
        followUpConsistency: 0,
      };
    }

    try {
      // Query email activities (using organization sub-collection pattern)
      // This data may not exist yet, so we handle gracefully
      const prefix = process.env.NODE_ENV === 'production' ? '' : 'test_';
      const emailsRef = adminDb.collection(`${prefix}email_activities`);
      const snapshot = await emailsRef
        .where('userId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const emails = snapshot.docs.map(doc => doc.data() as EmailData);

      const emailsGenerated = emails.filter((e: EmailData) => e.type === 'generated').length;
      const emailsSent = emails.filter((e: EmailData) => e.type === 'sent').length;

      // Calculate response rate
      const sentEmails = emails.filter((e: EmailData) => e.type === 'sent');
      const repliedEmails = sentEmails.filter((e: EmailData) => e.replied === true).length;
      const emailResponseRate = sentEmails.length > 0 ? repliedEmails / sentEmails.length : 0;
      
      // Calculate average response time (hours)
      const responseTimes = emails
        .filter((e: EmailData) => e.sentAt && e.repliedAt)
        .map((e: EmailData) => {
          const sentAtValue = e.sentAt;
          const repliedAtValue = e.repliedAt;
          if (!sentAtValue || !repliedAtValue) {
            return 0;
          }
          const sent = typeof sentAtValue === 'object' && sentAtValue !== null && 'toDate' in sentAtValue && typeof sentAtValue.toDate === 'function'
            ? sentAtValue.toDate()
            : (sentAtValue instanceof Date ? sentAtValue : new Date(sentAtValue as string));
          const replied = typeof repliedAtValue === 'object' && repliedAtValue !== null && 'toDate' in repliedAtValue && typeof repliedAtValue.toDate === 'function'
            ? repliedAtValue.toDate()
            : (repliedAtValue instanceof Date ? repliedAtValue : new Date(repliedAtValue as string));
          return (replied.getTime() - sent.getTime()) / (1000 * 60 * 60);
        });
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;
      
      // AI email usage rate
      const aiEmailUsageRate = emailsSent > 0 ? emailsGenerated / emailsSent : 0;
      
      // Personalization score (based on custom instructions usage)
      const personalizedEmails = emails.filter((e: EmailData) => e.customInstructions && e.customInstructions.length > 10).length;
      const personalizationScore = emailsSent > 0 ? (personalizedEmails / emailsSent) * 100 : 0;

      // Follow-up consistency (percentage of emails that are follow-ups)
      const followUpEmails = emails.filter((e: EmailData) => e.isFollowUp === true).length;
      const followUpConsistency = emailsSent > 0 ? (followUpEmails / emailsSent) * 100 : 0;
      
      return {
        emailsGenerated,
        emailsSent,
        emailResponseRate,
        averageResponseTime,
        aiEmailUsageRate,
        personalizationScore,
        followUpConsistency
      };
    } catch (error) {
      logger.error('Error analyzing communication metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      return {
        emailsGenerated: 0,
        emailsSent: 0,
        emailResponseRate: 0,
        averageResponseTime: 0,
        aiEmailUsageRate: 0,
        personalizationScore: 0,
        followUpConsistency: 0
      };
    }
  }

  /**
   * Analyzes activity level metrics
   */
  private async analyzeActivityMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityMetrics> {
    if (!adminDb) {
      return {
        totalActivities: 0,
        activitiesPerDay: 0,
        callsMade: 0,
        meetingsHeld: 0,
        tasksCompleted: 0,
        taskCompletionRate: 0,
        workflowsTriggered: 0,
        crmUpdates: 0,
      };
    }

    try {
      // Query activities (using direct collection reference as ACTIVITIES may not be in enum)
      const prefix = process.env.NODE_ENV === 'production' ? '' : 'test_';
      const activitiesRef = adminDb.collection(`${prefix}activities`);
      const snapshot = await activitiesRef
        .where('userId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const activities = snapshot.docs.map(doc => doc.data() as ActivityData);

      const totalActivities = activities.length;
      const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const activitiesPerDay = periodDays > 0 ? totalActivities / periodDays : 0;

      const callsMade = activities.filter((a: ActivityData) => a.type === 'call').length;
      const meetingsHeld = activities.filter((a: ActivityData) => a.type === 'meeting').length;
      const tasksCompleted = activities.filter((a: ActivityData) => a.type === 'task' && a.completed).length;
      const totalTasks = activities.filter((a: ActivityData) => a.type === 'task').length;
      const taskCompletionRate = totalTasks > 0 ? tasksCompleted / totalTasks : 0;
      
      // Query workflow executions (reuse prefix from above)
      const workflowsRef = adminDb.collection(`${prefix}workflow_executions`);
      const workflowSnapshot = await workflowsRef
        .where('triggeredBy', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      const workflowsTriggered = workflowSnapshot.size;
      
      // CRM updates (deal updates + contact updates)
      const crmUpdates = activities.filter((a: ActivityData) =>
        ['deal_update', 'contact_update', 'note_added'].includes(a.type ?? '')
      ).length;
      
      return {
        totalActivities,
        activitiesPerDay,
        callsMade,
        meetingsHeld,
        tasksCompleted,
        taskCompletionRate,
        workflowsTriggered,
        crmUpdates
      };
    } catch (error) {
      logger.error('Error analyzing activity metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      return {
        totalActivities: 0,
        activitiesPerDay: 0,
        callsMade: 0,
        meetingsHeld: 0,
        tasksCompleted: 0,
        taskCompletionRate: 0,
        workflowsTriggered: 0,
        crmUpdates: 0
      };
    }
  }

  /**
   * Analyzes conversion funnel metrics
   */
  private async analyzeConversionMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ConversionMetrics> {
    try {
      // Query deals for conversion analysis
      const dealsRef = this.adminDal.getCollection('DEALS');
      const snapshot = await dealsRef
        .where('ownerId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const deals = snapshot.docs.map(doc => doc.data() as DealData);

      // Count deals at each stage
      const leadCount = deals.filter((d: DealData) => d.stage === 'lead' || d.stage === 'prospecting').length;
      const opportunityCount = deals.filter((d: DealData) =>
        ['qualification', 'needs_analysis', 'discovery'].includes(d.stage ?? '')
      ).length;
      const proposalCount = deals.filter((d: DealData) =>
        ['proposal', 'negotiation'].includes(d.stage ?? '')
      ).length;
      const closedCount = deals.filter((d: DealData) => d.status === 'won').length;
      
      // Calculate conversion rates
      const totalLeads = leadCount + opportunityCount + proposalCount + closedCount;
      const leadToOpportunity = totalLeads > 0 
        ? (opportunityCount + proposalCount + closedCount) / totalLeads 
        : 0;
      const opportunityToProposal = (opportunityCount + proposalCount + closedCount) > 0
        ? (proposalCount + closedCount) / (opportunityCount + proposalCount + closedCount)
        : 0;
      const proposalToClose = (proposalCount + closedCount) > 0
        ? closedCount / (proposalCount + closedCount)
        : 0;
      const overallConversion = totalLeads > 0 ? closedCount / totalLeads : 0;
      
      // Identify drop-off points
      const dropOffPoints = [
        {
          stage: 'Lead → Opportunity',
          dropOffRate: 1 - leadToOpportunity
        },
        {
          stage: 'Opportunity → Proposal',
          dropOffRate: 1 - opportunityToProposal
        },
        {
          stage: 'Proposal → Close',
          dropOffRate: 1 - proposalToClose
        }
      ].filter(point => point.dropOffRate > 0.3); // Only show significant drop-offs
      
      return {
        leadToOpportunity,
        opportunityToProposal,
        proposalToClose,
        overallConversion,
        dropOffPoints
      };
    } catch (error) {
      logger.error('Error analyzing conversion metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      return {
        leadToOpportunity: 0,
        opportunityToProposal: 0,
        proposalToClose: 0,
        overallConversion: 0,
        dropOffPoints: []
      };
    }
  }

  /**
   * Analyzes revenue performance metrics
   */
  private async analyzeRevenueMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueMetrics> {
    try {
      // Query deals for revenue analysis
      const dealsRef = this.adminDal.getCollection('DEALS');
      const snapshot = await dealsRef
        .where('ownerId', '==', repId)
        .get();
      
      const allDeals = snapshot.docs.map(doc => doc.data() as DealData);

      // Total revenue (won deals in period)
      const wonDeals = allDeals.filter((d: DealData) => {
        if (d.status !== 'won' || !d.closedAt) {
          return false;
        }
        const closedAt = d.closedAt;
        const closedDate = typeof closedAt === 'object' && closedAt !== null && 'toDate' in closedAt && typeof closedAt.toDate === 'function'
          ? closedAt.toDate()
          : (closedAt instanceof Date ? closedAt : new Date(closedAt as string));
        return closedDate >= startDate && closedDate <= endDate;
      });
      const totalRevenue = wonDeals.reduce((sum: number, d: DealData) => sum + (d.value ?? 0), 0);
      
      // Get quota from user profile
      const repDoc = await this.adminDal.getCollection('USERS').doc(repId).get();
      const repQuotaData = repDoc.data() as UserData | undefined;
      const quota = repQuotaData?.quota ?? 0;
      const quotaAttainment = quota > 0 ? totalRevenue / quota : 0;
      
      // Pipeline value (active deals)
      const activeDeals = allDeals.filter((d: DealData) =>
        !['won', 'lost', 'closed'].includes(d.status ?? '')
      );
      const pipelineValue = activeDeals.reduce((sum: number, d: DealData) => sum + (d.value ?? 0), 0);

      // Weighted pipeline (value * probability)
      const weightedPipeline = activeDeals.reduce((sum: number, d: DealData) => {
        const value = d.value ?? 0;
        const probability = d.winProbability ?? 0.5;
        return sum + (value * probability);
      }, 0);
      
      // Forecast accuracy (compare previous forecasts to actual)
      const forecastAccuracy = 0.85; // Placeholder - would need historical forecast data
      
      // Average contract value
      const acv = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;
      
      // Growth rate (compare to previous period)
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setTime(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousWonDeals = allDeals.filter((d: DealData) => {
        if (d.status !== 'won' || !d.closedAt) {
          return false;
        }
        const closedAt = d.closedAt;
        const closedDate = typeof closedAt === 'object' && closedAt !== null && 'toDate' in closedAt && typeof closedAt.toDate === 'function'
          ? closedAt.toDate()
          : (closedAt instanceof Date ? closedAt : new Date(closedAt as string));
        return closedDate >= previousPeriodStart && closedDate < startDate;
      });
      const previousRevenue = previousWonDeals.reduce((sum: number, d: DealData) => sum + (d.value ?? 0), 0);
      const growthRate = previousRevenue > 0 ? (totalRevenue - previousRevenue) / previousRevenue : 0;
      
      return {
        totalRevenue,
        quota,
        quotaAttainment,
        pipelineValue,
        weightedPipeline,
        forecastAccuracy,
        acv,
        growthRate
      };
    } catch (error) {
      logger.error('Error analyzing revenue metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      return {
        totalRevenue: 0,
        quota: 0,
        quotaAttainment: 0,
        pipelineValue: 0,
        weightedPipeline: 0,
        forecastAccuracy: 0,
        acv: 0,
        growthRate: 0
      };
    }
  }

  /**
   * Analyzes efficiency metrics
   */
  private async analyzeEfficiencyMetrics(
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EfficiencyMetrics> {
    if (!adminDb || !this.adminDal) {
      return {
        timeToFirstContact: 0,
        timeToProposal: 0,
        timeToClose: 0,
        meetingsPerDeal: 0,
        emailsPerDeal: 0,
        touchPointsPerDeal: 0,
        automationUsage: 0,
        hoursSaved: 0,
      };
    }

    try {
      // Get environment prefix once for all queries
      const prefix = process.env.NODE_ENV === 'production' ? '' : 'test_';
      
      // Query deals for efficiency analysis
      const dealsRef = this.adminDal.getCollection('DEALS');
      const snapshot = await dealsRef
        .where('ownerId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const deals = snapshot.docs.map(doc => doc.data() as DealData);

      // Time to first contact
      const firstContactTimes = deals
        .filter((d: DealData) => d.createdAt && d.firstContactAt)
        .map((d: DealData) => {
          const createdAtValue = d.createdAt;
          const firstContactAtValue = d.firstContactAt;
          if (!createdAtValue || !firstContactAtValue) {
            return 0;
          }
          const created = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
            ? createdAtValue.toDate()
            : (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue as string));
          const contacted = typeof firstContactAtValue === 'object' && firstContactAtValue !== null && 'toDate' in firstContactAtValue && typeof firstContactAtValue.toDate === 'function'
            ? firstContactAtValue.toDate()
            : (firstContactAtValue instanceof Date ? firstContactAtValue : new Date(firstContactAtValue as string));
          return (contacted.getTime() - created.getTime()) / (1000 * 60 * 60);
        });
      const timeToFirstContact = firstContactTimes.length > 0
        ? firstContactTimes.reduce((sum, t) => sum + t, 0) / firstContactTimes.length
        : 0;
      
      // Time to proposal
      const proposalTimes = deals
        .filter((d: DealData) => d.createdAt && d.proposalSentAt)
        .map((d: DealData) => {
          const createdAtValue = d.createdAt;
          const proposalSentAtValue = d.proposalSentAt;
          if (!createdAtValue || !proposalSentAtValue) {
            return 0;
          }
          const created = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
            ? createdAtValue.toDate()
            : (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue as string));
          const proposal = typeof proposalSentAtValue === 'object' && proposalSentAtValue !== null && 'toDate' in proposalSentAtValue && typeof proposalSentAtValue.toDate === 'function'
            ? proposalSentAtValue.toDate()
            : (proposalSentAtValue instanceof Date ? proposalSentAtValue : new Date(proposalSentAtValue as string));
          return (proposal.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });
      const timeToProposal = proposalTimes.length > 0
        ? proposalTimes.reduce((sum, t) => sum + t, 0) / proposalTimes.length
        : 0;
      
      // Time to close
      const closeTimes = deals
        .filter((d: DealData) => d.createdAt && d.closedAt && d.status === 'won')
        .map((d: DealData) => {
          const createdAtValue = d.createdAt;
          const closedAtValue = d.closedAt;
          if (!createdAtValue || !closedAtValue) {
            return 0;
          }
          const created = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
            ? createdAtValue.toDate()
            : (createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue as string));
          const closed = typeof closedAtValue === 'object' && closedAtValue !== null && 'toDate' in closedAtValue && typeof closedAtValue.toDate === 'function'
            ? closedAtValue.toDate()
            : (closedAtValue instanceof Date ? closedAtValue : new Date(closedAtValue as string));
          return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });
      const timeToClose = closeTimes.length > 0
        ? closeTimes.reduce((sum, t) => sum + t, 0) / closeTimes.length
        : 0;
      
      // Touch points per deal (meetings + emails)
      const activitiesRef = adminDb.collection(`${prefix}activities`);
      const activitiesSnapshot = await activitiesRef
        .where('userId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      const activities = activitiesSnapshot.docs.map(doc => doc.data() as ActivityData);
      const meetingsPerDeal = deals.length > 0
        ? activities.filter((a: ActivityData) => a.type === 'meeting').length / deals.length
        : 0;
      const emailsPerDeal = deals.length > 0
        ? activities.filter((a: ActivityData) => a.type === 'email').length / deals.length
        : 0;
      const touchPointsPerDeal = meetingsPerDeal + emailsPerDeal;
      
      // AI automation usage
      const workflowsRef = adminDb.collection(`${prefix}workflow_executions`);
      const workflowSnapshot = await workflowsRef
        .where('triggeredBy', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      const workflowExecutions = workflowSnapshot.size;
      const totalActivities = activities.length;
      const automationUsage = totalActivities > 0 ? workflowExecutions / totalActivities : 0;
      
      // Hours saved (estimate: 5 min per workflow, 10 min per AI email)
      const emailActivities = await adminDb.collection(`${prefix}email_activities`)
        .where('userId', '==', repId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      const aiEmails = emailActivities.docs.filter(doc => (doc.data() as EmailData).type === 'generated').length;
      const hoursSaved = (workflowExecutions * 5 + aiEmails * 10) / 60;
      
      return {
        timeToFirstContact,
        timeToProposal,
        timeToClose,
        meetingsPerDeal,
        emailsPerDeal,
        touchPointsPerDeal,
        automationUsage,
        hoursSaved
      };
    } catch (error) {
      logger.error('Error analyzing efficiency metrics', error instanceof Error ? error : new Error(String(error)), { repId });
      return {
        timeToFirstContact: 0,
        timeToProposal: 0,
        timeToClose: 0,
        meetingsPerDeal: 0,
        emailsPerDeal: 0,
        touchPointsPerDeal: 0,
        automationUsage: 0,
        hoursSaved: 0
      };
    }
  }

  /**
   * Calculates skill scores based on performance metrics
   */
  private calculateSkillScores(metrics: {
    deals: DealPerformanceMetrics;
    communication: CommunicationMetrics;
    activity: ActivityMetrics;
    conversion: ConversionMetrics;
    revenue: RevenueMetrics;
    efficiency: EfficiencyMetrics;
  }): SkillScores {
    const { deals, communication, activity, conversion, revenue, efficiency } = metrics;
    
    return {
      // Prospecting: based on deal velocity and pipeline value
      prospecting: Math.min(100, (deals.dealVelocity * 10 + (revenue.pipelineValue / 100000) * 20)),
      
      // Discovery: based on qualification and conversion
      discovery: Math.min(100, conversion.leadToOpportunity * 100),
      
      // Needs analysis: based on conversion to proposal
      needsAnalysis: Math.min(100, conversion.opportunityToProposal * 100),
      
      // Presentation: based on proposal to close rate
      presentation: Math.min(100, conversion.proposalToClose * 100),
      
      // Objection handling: inferred from win rate
      objectionHandling: Math.min(100, deals.winRate * 100),
      
      // Negotiation: based on average deal size vs pipeline
      negotiation: Math.min(100, (deals.averageDealSize / 100000) * 50 + deals.winRate * 50),
      
      // Closing: based on win rate and quota attainment
      closing: Math.min(100, (deals.winRate * 50 + revenue.quotaAttainment * 50)),
      
      // Relationship building: based on email response rate and follow-up
      relationshipBuilding: Math.min(100, 
        communication.emailResponseRate * 50 + communication.followUpConsistency * 0.5
      ),
      
      // Product knowledge: inferred from presentation and objection handling
      productKnowledge: Math.min(100, (conversion.proposalToClose * 60 + deals.winRate * 40)),
      
      // CRM hygiene: based on activity logging
      crmHygiene: Math.min(100, Math.min(activity.activitiesPerDay * 10, 100)),
      
      // Time management: based on efficiency metrics
      timeManagement: Math.min(100, (1 / Math.max(efficiency.timeToClose / 30, 0.1)) * 50),
      
      // AI tool adoption: based on automation usage
      aiToolAdoption: Math.min(100, 
        efficiency.automationUsage * 50 + communication.aiEmailUsageRate * 50
      )
    };
  }

  /**
   * Calculates overall performance score (weighted average)
   */
  private calculateOverallScore(metrics: {
    deals: DealPerformanceMetrics;
    communication: CommunicationMetrics;
    activity: ActivityMetrics;
    conversion: ConversionMetrics;
    revenue: RevenueMetrics;
    efficiency: EfficiencyMetrics;
    skills: SkillScores;
  }): number {
    const { deals, revenue, skills } = metrics;
    
    // Weighted score components
    const skillScores = [
      skills.prospecting,
      skills.discovery,
      skills.needsAnalysis,
      skills.presentation,
      skills.objectionHandling,
      skills.negotiation,
      skills.closing,
      skills.relationshipBuilding,
      skills.productKnowledge,
      skills.crmHygiene,
      skills.timeManagement,
      skills.aiToolAdoption
    ];
    const averageSkillScore = skillScores.reduce((sum, score) => sum + score, 0) / skillScores.length;

    const components = [
      { value: revenue.quotaAttainment * 100, weight: 0.30 }, // Quota attainment: 30%
      { value: deals.winRate * 100, weight: 0.20 },           // Win rate: 20%
      { value: averageSkillScore, weight: 0.30 }, // Skills avg: 30%
      { value: Math.min(deals.dealVelocity * 20, 100), weight: 0.10 }, // Velocity: 10%
      { value: Math.min(revenue.growthRate * 50 + 50, 100), weight: 0.10 } // Growth: 10%
    ];
    
    const weightedSum = components.reduce((sum, comp) => sum + (comp.value * comp.weight), 0);
    return Math.min(100, Math.max(0, weightedSum));
  }

  /**
   * Determines performance tier based on overall score and key metrics
   */
  private determinePerformanceTier(
    overallScore: number,
    winRate: number,
    quotaAttainment: number
  ): PerformanceTier {
    // Top performer: 85+ score AND (80%+ win rate OR 120%+ quota)
    if (overallScore >= 85 && (winRate >= 0.8 || quotaAttainment >= 1.2)) {
      return 'top_performer';
    }
    
    // High performer: 70+ score AND (60%+ win rate OR 100%+ quota)
    if (overallScore >= 70 && (winRate >= 0.6 || quotaAttainment >= 1.0)) {
      return 'high_performer';
    }
    
    // Average: 50-70 score
    if (overallScore >= 50) {
      return 'average';
    }
    
    // Needs improvement: 30-50 score
    if (overallScore >= 30) {
      return 'needs_improvement';
    }
    
    // At risk: < 30 score
    return 'at_risk';
  }

  /**
   * Gets team average metrics for benchmarking
   */
  private async getTeamAverageMetrics(
    _startDate: Date,
    _endDate: Date
  ): Promise<TeamMetrics> {
    try {
      // Query all users with sales role
      const usersRef = this.adminDal.getCollection('USERS');
      const snapshot = await usersRef
        .where('role', '==', 'sales')
        .get();

      const userIds = snapshot.docs.map(doc => doc.id);

      if (userIds.length === 0) {
        return this.getDefaultTeamMetrics();
      }

      // Calculate metrics for all reps (simplified - in production, would cache these)
      // TODO: In future, use startDate and endDate for time-based calculations
      const metrics: TeamMetrics = {
        overallScore: 65,
        winRate: 0.45,
        revenue: 50000,
        activityPerDay: 12,
        efficiency: 0.6
      };

      return metrics;
    } catch (error) {
      logger.error('Error getting team average metrics', error instanceof Error ? error : new Error(String(error)));
      return this.getDefaultTeamMetrics();
    }
  }

  /**
   * Returns default team metrics
   */
  private getDefaultTeamMetrics(): TeamMetrics {
    return {
      overallScore: 60,
      winRate: 0.40,
      revenue: 40000,
      activityPerDay: 10,
      efficiency: 0.50
    };
  }

  /**
   * Calculates comparison to team average
   */
  private calculateTeamComparison(
    repMetrics: RepMetricsForComparison,
    teamMetrics: TeamMetrics
  ): PerformanceComparison {
    const overallScoreDelta = repMetrics.overallScore - teamMetrics.overallScore;
    const winRateDelta = repMetrics.deals.winRate - teamMetrics.winRate;
    const revenueDelta = repMetrics.revenue.totalRevenue - teamMetrics.revenue;
    const activityDelta = repMetrics.activity.activitiesPerDay - teamMetrics.activityPerDay;
    const efficiencyDelta = repMetrics.efficiency.automationUsage - teamMetrics.efficiency;
    
    // Calculate percentile rank (simplified)
    const percentileRank = Math.min(100, Math.max(0, 50 + overallScoreDelta));
    
    return {
      overallScoreDelta,
      winRateDelta,
      revenueDelta,
      activityDelta,
      efficiencyDelta,
      percentileRank
    };
  }

  /**
   * Gets date range for a time period
   */
  private getDateRange(
    period: TimePeriod,
    customRange?: CustomDateRange
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;
    
    if (period === 'custom' && customRange) {
      return { startDate: customRange.startDate, endDate: customRange.endDate };
    }
    
    switch (period) {
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'last_6_months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'last_12_months':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return { startDate, endDate };
  }
}
