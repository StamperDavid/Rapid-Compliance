/**
 * Sequence Executions API
 * 
 * Provides real-time monitoring of sequence step executions.
 * Shows recent activity across all sequences for live monitoring.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

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
  metadata?: Record<string, any>;
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
    const organizationId = user.organizationId!;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sequenceId = searchParams.get('sequenceId');

    logger.info('[Executions API] Fetching recent executions', {
      organizationId,
      limit,
      sequenceId: sequenceId || 'all',
    });

    const executions = await getRecentExecutions(organizationId, limit, sequenceId || undefined);

    return NextResponse.json({ executions });

  } catch (error) {
    logger.error('[Executions API] Error fetching executions', error);
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
    const enrollmentsRef = adminDal.getCollection('SEQUENCE_ENROLLMENTS');
    let nativeQuery = enrollmentsRef.where('organizationId', '==', organizationId);

    if (sequenceId) {
      nativeQuery = nativeQuery.where('sequenceId', '==', sequenceId);
    }

    const nativeEnrollmentsSnap = await nativeQuery
      .orderBy('enrolledAt', 'desc')
      .limit(limit)
      .get();

    // Process native enrollments
    for (const doc of nativeEnrollmentsSnap.docs) {
      const data = doc.data();
      const executedSteps = data.executedSteps ?? [];
      
      // Get sequence name
      let sequenceName = 'Unknown Sequence';
      try {
        const seqRef = adminDal.getNestedDocRef('sequences/{sequenceId}', { sequenceId: data.sequenceId });
        const seqDoc = await seqRef.get();
        if (seqDoc.exists) {
          sequenceName = seqDoc.data()?.name || sequenceName;
        }
      } catch (err) {
        logger.warn('[Executions] Could not fetch sequence name', { sequenceId: data.sequenceId });
      }

      // Get lead name
      let leadName: string | undefined;
      try {
        const leadRef = adminDal.getNestedDocRef('leads/{leadId}', { leadId: data.leadId });
        const leadDoc = await leadRef.get();
        if (leadDoc.exists) {
          const leadData = leadDoc.data();
          leadName = leadData?.name || leadData?.email;
        }
      } catch (err) {
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
          action: step.response || 'Executed',
          status: step.success ? 'success' : step.error ? 'failed' : 'pending',
          executedAt: step.executedAt?.toDate() || new Date(),
          error: step.error,
          metadata: {
            enrollmentId: doc.id,
            enrollmentStatus: data.status,
          },
        });
      }

      // If currently executing, add a pending execution
      if (data.status === 'active' && data.nextExecutionAt) {
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
          executedAt: data.nextExecutionAt?.toDate() || new Date(),
          metadata: {
            enrollmentId: doc.id,
            scheduledFor: data.nextExecutionAt?.toDate().toISOString(),
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
      const data = doc.data();
      const stepActions = data.stepActions ?? [];

      // Get sequence name
      let sequenceName = 'Unknown Sequence';
      try {
        const seqRef = adminDal.getNestedDocRef(
          'organizations/{orgId}/sequences/{sequenceId}',
          { orgId: organizationId, sequenceId: data.sequenceId }
        );
        const seqDoc = await seqRef.get();
        if (seqDoc.exists) {
          sequenceName = seqDoc.data()?.name || sequenceName;
        }
      } catch (err) {
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
          action: action.subject || 'Email sent',
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

  } catch (error) {
    logger.error('[Executions] Error fetching executions', error);
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
