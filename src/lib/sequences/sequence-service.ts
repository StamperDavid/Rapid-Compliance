/**
 * Sequence Service
 *
 * Wrapper around the Omni-Channel Sequencer for form-based enrollments.
 * This service adapts the form orchestrator interface to the real sequencer.
 *
 * @module sequences/sequence-service
 */

import { logger } from '@/lib/logger/logger';

export interface EnrollInSequenceParams {
  sequenceId: string;
  leadId: string;
  email: string;
  workspaceId: string;
  source: string;
  sourceId: string;
}

/**
 * Enroll a lead in a nurture sequence
 *
 * This function delegates to the real Omni-Channel Sequencer while
 * maintaining compatibility with the form orchestrator interface.
 */
export async function enrollInSequence(params: EnrollInSequenceParams): Promise<string> {
  logger.info('Enrolling lead in sequence', {
    sequenceId: params.sequenceId,
    leadId: params.leadId,
    source: params.source,
  });

  try {
    // Import the real sequencer dynamically to avoid circular dependencies
    const { enrollInSequence: realEnroll } = await import('@/lib/services/sequencer');

    // Call the real sequencer with adapted parameters
    const enrollment = await realEnroll({
      sequenceId: params.sequenceId,
      leadId: params.leadId,
      metadata: {
        email: params.email,
        workspaceId: params.workspaceId,
        source: params.source,
        sourceId: params.sourceId,
      },
    });

    logger.info('Lead enrolled in sequence', {
      enrollmentId: enrollment.id,
      sequenceId: params.sequenceId,
      leadId: params.leadId,
    });

    return enrollment.id;
  } catch (error) {
    logger.error('Failed to enroll lead in sequence',
      error instanceof Error ? error : new Error(String(error)),
      { sequenceId: params.sequenceId, leadId: params.leadId }
    );
    throw error;
  }
}
