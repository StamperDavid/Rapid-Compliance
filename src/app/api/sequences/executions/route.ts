/**
 * Sequence Executions API
 *
 * Provides real-time monitoring of sequence step executions.
 * Shows recent activity across all sequences for live monitoring.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import type { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// TYPES
// ============================================================================

interface SequenceExecution {
  executionId: string;
  sequenceId: string;
  sequenceName: string;
  leadId: string;
  leadName?: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'skipped';
  executedAt: Date;
  error?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

// Firestore document types
interface ExecutedStep {
  stepId: string;
  stepIndex: number;
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  response?: string;
  success: boolean;
  error?: string;
  executedAt?: Timestamp;
}

interface NativeEnrollmentData {
  sequenceId: string;
  leadId: string;
  executedSteps?: ExecutedStep[];
  status: string;
  currentStepIndex: number;
  nextExecutionAt?: Timestamp;
  enrolledAt: Timestamp;
  organizationId: string;
}

interface SequenceDocData {
  name?: string;
}

interface LeadDocData {
  name?: string;
  email?: string;
}

interface LegacyStepAction {
  stepId: string;
  stepOrder: number;
  subject?: string;
  status: string;
  sentAt?: string;
  error?: string;
  variant?: string;
}

interface LegacyEnrollmentData {
  sequenceId: string;
  prospectId: string;
  stepActions?: LegacyStepAction[];
  enrolledAt: Timestamp;
}

// ============================================================================
// GET RECENT EXECUTIONS
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
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50');
    const sequenceId = searchParams.get('sequenceId');
    const sequenceIdForLog = (sequenceId !== '' && sequenceId != null) ? sequenceId : 'all';

    logger.info('[Executions API] Fetching recent executions', {
      organizationId,
      limit,
      sequenceId: sequenceIdForLog,
    });

    const sequenceIdFilter = (sequenceId !== '' && sequenceId != null) ? sequenceId : undefined;
    const executions = await getRecentExecutions(organizationId, limit, sequenceIdFilter);

    return NextResponse.json({ executions });

  } catch (error: unknown) {
    logger.error('[Executions API] Error fetching executions', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get recent sequence executions
 */
async function getRecentExecutions(
  organizationId: string,
  limit: number = 50,
  sequenceId?: string
): Promise<SequenceExecution[]> {
  if (!adminDal) {
    return [];
  }

  try {
    const executions: SequenceExecution[] = [];

    // Fetch native Hunter-Closer sequence enrollments
    // PENTHOUSE: organizationId filter removed (single-tenant mode)
    const enrollmentsRef = adminDal.getCollection('SEQUENCE_ENROLLMENTS');
    const nativeQuery = sequenceId
      ? enrollmentsRef.where('sequenceId', '==', sequenceId)
      : enrollmentsRef;

    const nativeEnrollmentsSnap = await nativeQuery
      .orderBy('enrolledAt', 'desc')
      .limit(limit)
      .get();

    // Process native enrollments
    for (const doc of nativeEnrollmentsSnap.docs) {
      const rawData = doc.data();
      const data = rawData as NativeEnrollmentData;
      const executedSteps: ExecutedStep[] = data.executedSteps ?? [];

      // Get sequence name
      let sequenceName = 'Unknown Sequence';
      try {
        const seqRef = adminDal.getNestedDocRef('sequences/{sequenceId}', { sequenceId: data.sequenceId });
        const seqDoc = await seqRef.get();
        if (seqDoc.exists) {
          const seqData = seqDoc.data() as SequenceDocData | undefined;
          sequenceName = seqData?.name ?? sequenceName;
        }
      } catch (_err) {
        logger.warn('[Executions] Could not fetch sequence name', { sequenceId: data.sequenceId });
      }

      // Get lead name
      let leadName: string | undefined;
      try {
        const leadRef = adminDal.getNestedDocRef('leads/{leadId}', { leadId: data.leadId });
        const leadDoc = await leadRef.get();
        if (leadDoc.exists) {
          const leadData = leadDoc.data() as LeadDocData | undefined;
          leadName = leadData?.name ?? leadData?.email;
        }
      } catch (_err) {
        logger.warn('[Executions] Could not fetch lead name', { leadId: data.leadId });
      }

      // Add each executed step as a separate execution
      for (const step of executedSteps) {
        executions.push({
          executionId: `${doc.id}_${step.stepId}`,
          sequenceId: data.sequenceId,
          sequenceName,
          leadId: data.leadId,
          leadName,
          stepIndex: step.stepIndex,
          channel: step.channel,
          action: (step.response !== '' && step.response != null) ? step.response : 'Executed',
          status: step.success ? 'success' : step.error ? 'failed' : 'pending',
          executedAt: step.executedAt?.toDate() ?? new Date(),
          error: step.error,
          metadata: {
            enrollmentId: doc.id,
            enrollmentStatus: data.status,
          },
        });
      }

      // If currently executing, add a pending execution
      if (data.status === 'active' && data.nextExecutionAt) {
        const nextExecutionDate = data.nextExecutionAt.toDate();
        executions.push({
          executionId: `${doc.id}_next`,
          sequenceId: data.sequenceId,
          sequenceName,
          leadId: data.leadId,
          leadName,
          stepIndex: data.currentStepIndex,
          channel: 'email', // Default, will be updated when executed
          action: 'Scheduled',
          status: 'pending',
          executedAt: nextExecutionDate,
          metadata: {
            enrollmentId: doc.id,
            scheduledFor: nextExecutionDate.toISOString(),
          },
        });
      }
    }

    // Fetch legacy OutboundSequence enrollments for backward compatibility
    const legacyEnrollmentsRef = adminDal.getNestedCollection(
      'organizations/{orgId}/sequenceEnrollments',
      { orgId: organizationId }
    );
    const legacyEnrollmentsSnap = await legacyEnrollmentsRef
      .orderBy('enrolledAt', 'desc')
      .limit(limit)
      .get();

    for (const doc of legacyEnrollmentsSnap.docs) {
      const rawLegacyData = doc.data();
      const data = rawLegacyData as LegacyEnrollmentData;
      const stepActions: LegacyStepAction[] = data.stepActions ?? [];

      // Get sequence name
      let sequenceName = 'Unknown Sequence';
      try {
        const seqRef = adminDal.getNestedDocRef(
          'organizations/{orgId}/sequences/{sequenceId}',
          { orgId: organizationId, sequenceId: data.sequenceId }
        );
        const seqDoc = await seqRef.get();
        if (seqDoc.exists) {
          const seqData = seqDoc.data() as SequenceDocData | undefined;
          sequenceName = seqData?.name ?? sequenceName;
        }
      } catch (_err) {
        logger.warn('[Executions] Could not fetch legacy sequence name', { sequenceId: data.sequenceId });
      }

      // Add each step action as an execution
      for (const action of stepActions) {
        executions.push({
          executionId: `legacy_${doc.id}_${action.stepId}`,
          sequenceId: data.sequenceId,
          sequenceName,
          leadId: data.prospectId,
          leadName: undefined, // Legacy system doesn't store lead names
          stepIndex: action.stepOrder,
          channel: 'email', // Legacy is email-only
          action: (action.subject !== '' && action.subject != null) ? action.subject : 'Email sent',
          status: mapLegacyStatus(action.status),
          executedAt: action.sentAt ? new Date(action.sentAt) : new Date(),
          error: action.error,
          metadata: {
            enrollmentId: doc.id,
            variant: action.variant,
          },
        });
      }
    }

    // Sort by most recent and limit
    executions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    return executions.slice(0, limit);

  } catch (error: unknown) {
    logger.error('[Executions] Error fetching executions', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Map legacy step action status to execution status
 */
function mapLegacyStatus(status: string): 'pending' | 'executing' | 'success' | 'failed' | 'skipped' {
  switch (status) {
    case 'scheduled':
      return 'pending';
    case 'sent':
    case 'delivered':
    case 'opened':
    case 'clicked':
    case 'replied':
      return 'success';
    case 'failed':
    case 'bounced':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'pending';
  }
}
