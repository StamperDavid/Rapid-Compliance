/**
 * Sequence Scheduler
 * Cron job that processes sequences and sends scheduled emails
 * Should run every hour via Cloud Scheduler or similar
 */

import { SequenceEngine } from './sequence-engine';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { ProspectEnrollment } from '@/types/outbound-sequence';

/**
 * Process all due sequence steps
 * Called by cron job every hour
 */
export async function processSequences(): Promise<{
  processed: number;
  errors: number;
}> {
  console.log('[Sequence Scheduler] Starting sequence processing...');

  let processed = 0;
  let errors = 0;

  try {
    // Get all organizations with active enrollments
    const organizations = await getAllOrganizations();

    for (const orgId of organizations) {
      try {
        // Get all active enrollments for this org
        const enrollments = await getActiveEnrollments(orgId);

        for (const enrollment of enrollments) {
          try {
            // Check if this enrollment is due for next step
            if (enrollment.nextStepAt) {
              const nextStepTime = new Date(enrollment.nextStepAt);
              const now = new Date();

              if (now >= nextStepTime) {
                // Process next step
                await SequenceEngine.processNextStep(enrollment.id, orgId);
                processed++;
              }
            }
          } catch (error) {
            console.error(`[Sequence Scheduler] Error processing enrollment ${enrollment.id}:`, error);
            errors++;
          }
        }
      } catch (error) {
        console.error(`[Sequence Scheduler] Error processing org ${orgId}:`, error);
        errors++;
      }
    }

    console.log(`[Sequence Scheduler] Completed. Processed: ${processed}, Errors: ${errors}`);

    return { processed, errors };
  } catch (error) {
    console.error('[Sequence Scheduler] Fatal error:', error);
    throw error;
  }
}

/**
 * Get all organizations with active sequences
 */
async function getAllOrganizations(): Promise<string[]> {
  try {
    // Get all organizations that have sequences
    const orgs = await FirestoreService.getAll(
      COLLECTIONS.ORGANIZATIONS,
      []
    );
    
    // Return org IDs
    return orgs.map((org: any) => org.id);
  } catch (error) {
    console.error('[Sequence Scheduler] Error getting organizations:', error);
    return [];
  }
}

/**
 * Get all active enrollments for an organization
 */
async function getActiveEnrollments(orgId: string): Promise<ProspectEnrollment[]> {
  try {
    const { where } = await import('firebase/firestore');
    
    // Query active enrollments
    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/enrollments`,
      [
        where('status', '==', 'active'),
      ]
    );

    return enrollments as ProspectEnrollment[];
  } catch (error) {
    console.error(`[Sequence Scheduler] Error getting enrollments for ${orgId}:`, error);
    return [];
  }
}

/**
 * Handle email bounce (called by webhook)
 */
export async function handleEmailBounce(
  enrollmentId: string,
  stepId: string,
  organizationId: string,
  reason?: string
): Promise<void> {
  console.log(`[Sequence Scheduler] Handling bounce for enrollment ${enrollmentId}, reason: ${reason || 'unknown'}`);

  // Get enrollment
  const enrollment = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
    enrollmentId
  ) as ProspectEnrollment;

  if (!enrollment) return;

  // Find step action
  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action) {
    action.status = 'bounced';
    action.bouncedAt = new Date().toISOString();
    action.bounceReason = reason || 'unknown';
    action.updatedAt = new Date().toISOString();
  }

  // Determine unenroll reason based on bounce type
  let unenrollReason: 'manual' | 'replied' | 'converted' | 'unsubscribed' | 'bounced' = 'bounced';
  if (reason === 'spam_report' || reason === 'unsubscribed') {
    unenrollReason = 'unsubscribed';
  }

  // Unenroll from sequence
  await SequenceEngine['unenrollProspect'](
    enrollment.prospectId,
    enrollment.sequenceId,
    organizationId,
    unenrollReason
  );
}

/**
 * Handle email reply (called by webhook)
 */
export async function handleEmailReply(
  enrollmentId: string,
  stepId: string,
  organizationId: string,
  replyContent: string
): Promise<void> {
  console.log(`[Sequence Scheduler] Handling reply for enrollment ${enrollmentId}`);

  // Get enrollment
  const enrollment = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
    enrollmentId
  ) as ProspectEnrollment;

  if (!enrollment) return;

  // Find step action
  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action) {
    action.status = 'replied';
    action.repliedAt = new Date().toISOString();
    action.updatedAt = new Date().toISOString();
  }

  // Get sequence
  const sequence = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequences`,
    enrollment.sequenceId
  );

  // If sequence is set to stop on response, pause enrollment
  if (sequence && (sequence as any).stopOnResponse) {
    enrollment.status = 'paused';
    enrollment.pausedAt = new Date().toISOString();
    enrollment.outcome = 'replied';
    enrollment.outcomeDate = new Date().toISOString();
  }

  enrollment.updatedAt = new Date().toISOString();

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
    enrollmentId,
    enrollment,
    false
  );
}

/**
 * Handle email open (called by webhook)
 */
export async function handleEmailOpen(
  enrollmentId: string,
  stepId: string,
  organizationId: string
): Promise<void> {
  const enrollment = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
    enrollmentId
  ) as ProspectEnrollment;

  if (!enrollment) return;

  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action && !action.openedAt) {
    action.status = 'opened';
    action.openedAt = new Date().toISOString();
    action.firstOpenedAt = action.firstOpenedAt || new Date().toISOString();
    action.updatedAt = new Date().toISOString();

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
      enrollmentId,
      enrollment,
      false
    );
  }
}

/**
 * Handle email click (called by webhook)
 */
export async function handleEmailClick(
  enrollmentId: string,
  stepId: string,
  organizationId: string
): Promise<void> {
  const enrollment = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
    enrollmentId
  ) as ProspectEnrollment;

  if (!enrollment) return;

  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action && !action.clickedAt) {
    action.status = 'clicked';
    action.clickedAt = new Date().toISOString();
    action.updatedAt = new Date().toISOString();

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
      enrollmentId,
      enrollment,
      false
    );
  }
}

