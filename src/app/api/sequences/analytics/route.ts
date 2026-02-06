/**
 * Sequence Analytics API
 * 
 * Aggregates performance metrics from:
 * 1. Native Hunter-Closer sequencer (src/lib/services/sequencer.ts)
 * 2. Legacy OutboundSequence system (for backward compatibility)
 * 
 * Provides comprehensive analytics for sequence performance monitoring.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// TYPES
// ============================================================================

// Firestore document types
interface FirestoreTimestamp {
  toDate(): Date;
}

interface NativeSequenceStats {
  totalEnrolled?: number;
  activeEnrollments?: number;
  completedEnrollments?: number;
  responseRate?: number;
}

interface StepMetrics {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
}

interface NativeSequenceStep {
  id: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  metrics?: StepMetrics;
}

interface NativeSequenceData {
  organizationId?: string;
  name: string;
  isActive: boolean;
  stats?: NativeSequenceStats;
  steps?: NativeSequenceStep[];
  createdAt?: FirestoreTimestamp;
  lastExecutedAt?: FirestoreTimestamp;
}

interface LegacyStepData {
  id: string;
  type: string;
  subject?: string;
  body?: string;
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
}

interface LegacySequenceAnalytics {
  totalEnrolled?: number;
  activeProspects?: number;
  completedProspects?: number;
  totalSent?: number;
  totalDelivered?: number;
  totalOpened?: number;
  totalClicked?: number;
  totalReplied?: number;
  deliveryRate?: number;
  openRate?: number;
  clickRate?: number;
  replyRate?: number;
  lastRun?: string;
}

interface LegacySequenceData {
  name: string;
  status: string;
  analytics?: LegacySequenceAnalytics;
  steps?: LegacyStepData[];
  createdAt?: string;
}

interface SequencePerformance {
  sequenceId: string;
  sequenceName: string;
  isActive: boolean;
  channel: 'email' | 'linkedin' | 'phone' | 'sms' | 'multi-channel';
  
  // Enrollment metrics
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  
  // Engagement metrics
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  
  // Conversion rates
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  
  // Step-by-step breakdown
  stepPerformance: StepPerformance[];
  
  // Timeline
  createdAt: Date;
  lastExecutedAt?: Date;
}

interface StepPerformance {
  stepId: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  
  // Conversion funnel
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface AnalyticsSummary {
  // Overall performance
  totalSequences: number;
  activeSequences: number;
  totalEnrollments: number;
  activeEnrollments: number;
  
  // Aggregate engagement
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  
  // Average rates
  avgDeliveryRate: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgReplyRate: number;
  
  // Top performers
  topSequencesByReplyRate: Array<{ id: string; name: string; replyRate: number }>;
  topSequencesByEngagement: Array<{ id: string; name: string; engagementScore: number }>;
  
  // Channel breakdown
  channelPerformance: {
    email: { sent: number; delivered: number; opened: number; replied: number };
    linkedin: { sent: number; delivered: number; opened: number; replied: number };
    sms: { sent: number; delivered: number; replied: number };
    phone: { sent: number; replied: number };
  };
}

// ============================================================================
// GET ANALYTICS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user: _user } = authResult;
    const { searchParams } = new URL(request.url);
    const sequenceId = searchParams.get('sequenceId');

    // Date range filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const dateRange = parseDateRange(startDate, endDate);

    logger.info('[Analytics API] Fetching analytics', {
      sequenceId: (sequenceId !== '' && sequenceId != null) ? sequenceId : 'all',
      dateRange: dateRange ? `${dateRange.start.toISOString()} - ${dateRange.end.toISOString()}` : 'all-time',
    });

    // If specific sequence requested, return detailed analytics
    if (sequenceId) {
      const performance = await getSequencePerformance(DEFAULT_ORG_ID, sequenceId, dateRange);
      if (!performance) {
        return NextResponse.json(
          { error: 'Sequence not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ performance });
    }

    // Otherwise, return summary analytics for all sequences
    const [performances, summary] = await Promise.all([
      getAllSequencePerformances(DEFAULT_ORG_ID, dateRange),
      getAnalyticsSummary(DEFAULT_ORG_ID, dateRange),
    ]);

    return NextResponse.json({
      summary,
      sequences: performances,
    });

  } catch (error) {
    logger.error('[Analytics API] Error fetching analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate NativeSequenceData from Firestore DocumentData
 */
function isNativeSequenceData(data: unknown): data is NativeSequenceData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;
  return typeof d.name === 'string' && typeof d.isActive === 'boolean';
}

/**
 * Type guard to validate LegacySequenceData from Firestore DocumentData
 */
function isLegacySequenceData(data: unknown): data is LegacySequenceData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;
  return typeof d.name === 'string' && typeof d.status === 'string';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse date range from query parameters
 */
function parseDateRange(startDate: string | null, endDate: string | null): { start: Date; end: Date } | null {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  // Set end date to end of day
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Get performance metrics for a specific sequence
 */
async function getSequencePerformance(
  organizationId: string,
  sequenceId: string,
  _dateRange?: { start: Date; end: Date } | null
): Promise<SequencePerformance | null> {
  try {
    if (!adminDal) {
      return null;
    }

    // Try native Hunter-Closer sequencer first
    const nativeSeqRef = adminDal.getNestedDocRef('sequences/{sequenceId}', { sequenceId });
    const nativeSeqDoc = await nativeSeqRef.get();

    if (nativeSeqDoc.exists) {
      const data = nativeSeqDoc.data();
      if (data?.organizationId !== organizationId) {
        return null;
      }

      if (!isNativeSequenceData(data)) {
        logger.error('[Analytics] Invalid native sequence data structure', undefined, { sequenceId });
        return null;
      }

      return buildNativeSequencePerformance(sequenceId, data);
    }

    // Fallback to legacy OutboundSequence system
    const legacySeqRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/sequences/{sequenceId}',
      { orgId: organizationId, sequenceId }
    );
    const legacySeqDoc = await legacySeqRef.get();

    if (!legacySeqDoc.exists) {
      return null;
    }

    const legacyData = legacySeqDoc.data();
    if (!legacyData) {
      return null;
    }

    if (!isLegacySequenceData(legacyData)) {
      logger.error('[Analytics] Invalid legacy sequence data structure', undefined, { sequenceId });
      return null;
    }

    return buildLegacySequencePerformance(sequenceId, legacyData);

  } catch (error) {
    logger.error('[Analytics] Error fetching sequence performance', error instanceof Error ? error : new Error(String(error)), { sequenceId });
    throw error;
  }
}

/**
 * Get performance for all sequences in an organization
 */
async function getAllSequencePerformances(
  organizationId: string,
  _dateRange?: { start: Date; end: Date } | null
): Promise<SequencePerformance[]> {
  if (!adminDal) {
    return [];
  }

  try {
    const performances: SequencePerformance[] = [];

    const nativeSeqsRef = adminDal.getCollection('SEQUENCES');
    const nativeSeqsSnap = await nativeSeqsRef.get();

    for (const doc of nativeSeqsSnap.docs) {
      const data = doc.data();
      if (isNativeSequenceData(data)) {
        performances.push(buildNativeSequencePerformance(doc.id, data));
      } else {
        logger.warn('[Analytics] Skipping native sequence with invalid data structure', { sequenceId: doc.id });
      }
    }

    // Fetch legacy OutboundSequences
    const legacySeqsRef = adminDal.getNestedCollection(
      'organizations/{orgId}/sequences',
      { orgId: organizationId }
    );
    const legacySeqsSnap = await legacySeqsRef.get();

    for (const doc of legacySeqsSnap.docs) {
      const data = doc.data();
      if (isLegacySequenceData(data)) {
        performances.push(buildLegacySequencePerformance(doc.id, data));
      } else {
        logger.warn('[Analytics] Skipping legacy sequence with invalid data structure', { sequenceId: doc.id });
      }
    }

    return performances;

  } catch (error) {
    logger.error('[Analytics] Error fetching all performances', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Build performance object from native Hunter-Closer sequence
 */
function buildNativeSequencePerformance(
  sequenceId: string,
  data: NativeSequenceData
): SequencePerformance {
  const stats: NativeSequenceStats = data.stats ?? {
    totalEnrolled: 0,
    activeEnrollments: 0,
    completedEnrollments: 0,
    responseRate: 0,
  };

  // Aggregate step metrics
  const stepPerformance: StepPerformance[] = (data.steps ?? []).map((step: NativeSequenceStep) => {
    const sent = step.metrics?.sent ?? 0;
    const delivered = step.metrics?.delivered ?? 0;
    const opened = step.metrics?.opened ?? 0;
    const clicked = step.metrics?.clicked ?? 0;
    const replied = step.metrics?.replied ?? 0;

    return {
      stepId: step.id,
      stepIndex: step.stepIndex,
      channel: step.channel,
      action: step.action,
      sent,
      delivered,
      opened,
      clicked,
      replied,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
    };
  });

  // Calculate totals
  const totalSent = stepPerformance.reduce((sum, step) => sum + step.sent, 0);
  const totalDelivered = stepPerformance.reduce((sum, step) => sum + step.delivered, 0);
  const totalOpened = stepPerformance.reduce((sum, step) => sum + step.opened, 0);
  const totalClicked = stepPerformance.reduce((sum, step) => sum + step.clicked, 0);
  const totalReplied = stepPerformance.reduce((sum, step) => sum + step.replied, 0);

  // Determine primary channel
  const channelCounts = stepPerformance.reduce((acc, step) => {
    acc[step.channel] = (acc[step.channel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const primaryChannelKey = Object.keys(channelCounts)[0];
  const isMultiChannel = Object.entries(channelCounts).length > 1;

  let primaryChannel: 'email' | 'linkedin' | 'phone' | 'sms' | 'multi-channel' = 'email';
  if (isMultiChannel) {
    primaryChannel = 'multi-channel';
  } else if (primaryChannelKey && ['email', 'linkedin', 'phone', 'sms'].includes(primaryChannelKey)) {
    primaryChannel = primaryChannelKey as 'email' | 'linkedin' | 'phone' | 'sms';
  }

  return {
    sequenceId,
    sequenceName: data.name,
    isActive: data.isActive,
    channel: primaryChannel,
    totalEnrolled: stats.totalEnrolled ?? 0,
    activeEnrollments: stats.activeEnrollments ?? 0,
    completedEnrollments: stats.completedEnrollments ?? 0,
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalReplied,
    deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
    openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
    clickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
    replyRate: totalDelivered > 0 ? (totalReplied / totalDelivered) * 100 : 0,
    stepPerformance,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    lastExecutedAt: data.lastExecutedAt?.toDate(),
  };
}

/**
 * Build performance object from legacy OutboundSequence
 */
function buildLegacySequencePerformance(
  sequenceId: string,
  data: LegacySequenceData
): SequencePerformance {
  const analytics: LegacySequenceAnalytics = data.analytics ?? {};

  // Build step performance from legacy steps
  const stepPerformance: StepPerformance[] = (data.steps ?? []).map((step: LegacyStepData, index: number) => {
    const sent = step.sent ?? 0;
    const delivered = step.delivered ?? 0;
    const opened = step.opened ?? 0;
    const clicked = step.clicked ?? 0;
    const replied = step.replied ?? 0;

    // Determine action description
    let action = 'Email';
    if (step.subject && step.subject !== '') {
      action = step.subject;
    } else if (step.body && step.body !== '') {
      action = step.body.substring(0, 50);
    }

    return {
      stepId: step.id,
      stepIndex: index,
      channel: mapLegacyStepType(step.type),
      action,
      sent,
      delivered,
      opened,
      clicked,
      replied,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
    };
  });

  return {
    sequenceId,
    sequenceName: data.name,
    isActive: data.status === 'active',
    channel: 'email', // Legacy system is email-only
    totalEnrolled: analytics.totalEnrolled ?? 0,
    activeEnrollments: analytics.activeProspects ?? 0,
    completedEnrollments: analytics.completedProspects ?? 0,
    totalSent: analytics.totalSent ?? 0,
    totalDelivered: analytics.totalDelivered ?? 0,
    totalOpened: analytics.totalOpened ?? 0,
    totalClicked: analytics.totalClicked ?? 0,
    totalReplied: analytics.totalReplied ?? 0,
    deliveryRate: analytics.deliveryRate ?? 0,
    openRate: analytics.openRate ?? 0,
    clickRate: analytics.clickRate ?? 0,
    replyRate: analytics.replyRate ?? 0,
    stepPerformance,
    createdAt: data.createdAt && data.createdAt !== '' ? new Date(data.createdAt) : new Date(),
    lastExecutedAt: analytics.lastRun && analytics.lastRun !== '' ? new Date(analytics.lastRun) : undefined,
  };
}

/**
 * Map legacy step types to channels
 */
function mapLegacyStepType(type: string): 'email' | 'linkedin' | 'phone' | 'sms' {
  if (type.includes('linkedin')) {return 'linkedin';}
  if (type.includes('sms')) {return 'sms';}
  if (type.includes('call') || type.includes('phone')) {return 'phone';}
  return 'email';
}

/**
 * Get summary analytics across all sequences
 */
async function getAnalyticsSummary(
  organizationId: string,
  dateRange?: { start: Date; end: Date } | null
): Promise<AnalyticsSummary> {
  try {
    const performances = await getAllSequencePerformances(organizationId, dateRange);

    const activeSequences = performances.filter(p => p.isActive).length;
    
    // Aggregate metrics
    let totalSent = 0;
    let totalDelivered = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalReplied = 0;
    let totalEnrollments = 0;
    let activeEnrollments = 0;

    const channelPerformance = {
      email: { sent: 0, delivered: 0, opened: 0, replied: 0 },
      linkedin: { sent: 0, delivered: 0, opened: 0, replied: 0 },
      sms: { sent: 0, delivered: 0, replied: 0 },
      phone: { sent: 0, replied: 0 },
    };

    for (const perf of performances) {
      totalSent += perf.totalSent;
      totalDelivered += perf.totalDelivered;
      totalOpened += perf.totalOpened;
      totalClicked += perf.totalClicked;
      totalReplied += perf.totalReplied;
      totalEnrollments += perf.totalEnrolled;
      activeEnrollments += perf.activeEnrollments;

      // Aggregate by channel
      for (const step of perf.stepPerformance) {
        if (step.channel === 'email') {
          channelPerformance.email.sent += step.sent;
          channelPerformance.email.delivered += step.delivered;
          channelPerformance.email.opened += step.opened;
          channelPerformance.email.replied += step.replied;
        } else if (step.channel === 'linkedin') {
          channelPerformance.linkedin.sent += step.sent;
          channelPerformance.linkedin.delivered += step.delivered;
          channelPerformance.linkedin.opened += step.opened;
          channelPerformance.linkedin.replied += step.replied;
        } else if (step.channel === 'sms') {
          channelPerformance.sms.sent += step.sent;
          channelPerformance.sms.delivered += step.delivered;
          channelPerformance.sms.replied += step.replied;
        } else if (step.channel === 'phone') {
          channelPerformance.phone.sent += step.sent;
          channelPerformance.phone.replied += step.replied;
        }
      }
    }

    // Calculate averages
    const avgDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const avgOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const avgClickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
    const avgReplyRate = totalDelivered > 0 ? (totalReplied / totalDelivered) * 100 : 0;

    // Top performers by reply rate
    const topSequencesByReplyRate = performances
      .filter(p => p.totalDelivered > 0)
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 5)
      .map(p => ({
        id: p.sequenceId,
        name: p.sequenceName,
        replyRate: p.replyRate,
      }));

    // Top performers by engagement score (composite)
    const topSequencesByEngagement = performances
      .filter(p => p.totalDelivered > 0)
      .map(p => ({
        id: p.sequenceId,
        name: p.sequenceName,
        engagementScore: (p.openRate * 0.3) + (p.clickRate * 0.3) + (p.replyRate * 0.4),
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);

    return {
      totalSequences: performances.length,
      activeSequences,
      totalEnrollments,
      activeEnrollments,
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalReplied,
      avgDeliveryRate,
      avgOpenRate,
      avgClickRate,
      avgReplyRate,
      topSequencesByReplyRate,
      topSequencesByEngagement,
      channelPerformance,
    };

  } catch (error) {
    logger.error('[Analytics] Error building summary', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
