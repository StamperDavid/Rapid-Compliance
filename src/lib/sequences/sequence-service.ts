/**
 * Sequence Service - Stub
 *
 * TODO: Implement full sequence enrollment logic.
 * This stub allows the form orchestrator trigger to compile.
 *
 * @module sequences/sequence-service
 */

import { logger } from '@/lib/logger/logger';

export interface EnrollInSequenceParams {
  sequenceId: string;
  leadId: string;
  email: string;
  orgId: string;
  workspaceId: string;
  source: string;
  sourceId: string;
}

/**
 * Enroll a lead in a nurture sequence
 *
 * TODO: Implement actual sequence enrollment logic
 */
export function enrollInSequence(params: EnrollInSequenceParams): Promise<string> {
  logger.info('enrollInSequence called (stub)', {
    sequenceId: params.sequenceId,
    leadId: params.leadId,
    source: params.source,
  });

  // Return a stub enrollment ID
  const enrollmentId = `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return Promise.resolve(enrollmentId);
}
