/**
 * Omni-Channel Sequencer
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * 
 * Native sequence manager for outreach orchestration across multiple channels:
 * - Email
 * - LinkedIn
 * - Phone
 * - SMS
 * 
 * Replaces: Outreach.io, Salesloft, Apollo sequences
 * 
 * Features:
 * - If/then conditional logic
 * - Multi-channel support
 * - Delay management
 * - Fallback handling
 * - Status tracking
 * - Analytics
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// TYPES
// ============================================================================

export type SequenceChannel = 'email' | 'linkedin' | 'phone' | 'sms';

export type SequenceConditionType = 
  | 'email_bounced' 
  | 'email_opened' 
  | 'email_clicked'
  | 'email_replied'
  | 'linkedin_connected'
  | 'linkedin_viewed'
  | 'linkedin_replied'
  | 'phone_answered'
  | 'phone_voicemail'
  | 'sms_replied'
  | 'no_response'
  | 'any_response';

export interface SequenceCondition {
  type: SequenceConditionType;
  /** Jump to specific step index if condition met */
  nextStepIndex?: number;
  /** Execute fallback step if condition met */
  fallback?: SequenceStep;
  /** Wait time in hours before checking condition */
  checkAfterHours?: number;
}

export interface SequenceStep {
  id: string;
  stepIndex: number;
  channel: SequenceChannel;
  action: string; // e.g., "Send email", "LinkedIn connection request", "Call"
  /** Template ID for the message/action */
  templateId?: string;
  /** Delay in hours before executing this step */
  delayHours: number;
  /** Conditions to check after this step */
  conditions?: SequenceCondition[];
  /** Custom data for the action */
  data?: Record<string, any>;
}

export interface Sequence {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Analytics
  stats: {
    totalEnrolled: number;
    activeEnrollments: number;
    completedEnrollments: number;
    responseRate: number;
  };
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  leadId: string;
  organizationId: string;
  
  // Status
  status: 'active' | 'paused' | 'completed' | 'stopped' | 'failed';
  currentStepIndex: number;
  
  // Execution tracking
  executedSteps: Array<{
    stepId: string;
    stepIndex: number;
    channel: SequenceChannel;
    executedAt: Date;
    success: boolean;
    response?: string;
    error?: string;
  }>;
  
  // Scheduling
  nextExecutionAt?: Date;
  enrolledAt: Date;
  completedAt?: Date;
  
  // Metadata
  metadata: Record<string, any>;
}

// ============================================================================
// SEQUENCE CRUD
// ============================================================================

/**
 * Create a new sequence
 */
export async function createSequence(params: {
  organizationId: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
  createdBy: string;
}): Promise<Sequence> {
  try {
    const { organizationId, name, description, steps, createdBy } = params;

    // Validate steps
    validateSequenceSteps(steps);

    const now = new Date();
    const sequence: Sequence = {
      id: db.collection('sequences').doc().id,
      organizationId,
      name,
      description,
      steps,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy,
      stats: {
        totalEnrolled: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
        responseRate: 0,
      },
    };

    await db.collection('sequences').doc(sequence.id).set({
      ...sequence,
      createdAt: Timestamp.fromDate(sequence.createdAt),
      updatedAt: Timestamp.fromDate(sequence.updatedAt),
    });

    logger.info('Sequence created', {
      sequenceId: sequence.id,
      organizationId,
      stepsCount: steps.length,
    });

    return sequence;
  } catch (error) {
    logger.error('Failed to create sequence', error);
    throw new Error(`Failed to create sequence: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Get sequence by ID
 */
export async function getSequence(sequenceId: string): Promise<Sequence | null> {
  try {
    const doc = await db.collection('sequences').doc(sequenceId).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Sequence;
  } catch (error) {
    logger.error('Failed to get sequence', error, { sequenceId });
    throw error;
  }
}

/**
 * Update sequence
 */
export async function updateSequence(
  sequenceId: string,
  updates: Partial<Omit<Sequence, 'id' | 'organizationId' | 'createdAt'>>
): Promise<void> {
  try {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await db.collection('sequences').doc(sequenceId).update(updateData);

    logger.info('Sequence updated', { sequenceId });
  } catch (error) {
    logger.error('Failed to update sequence', error, { sequenceId });
    throw error;
  }
}

/**
 * List sequences for organization
 */
export async function listSequences(organizationId: string): Promise<Sequence[]> {
  try {
    const snapshot = await db
      .collection('sequences')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Sequence;
    });
  } catch (error) {
    logger.error('Failed to list sequences', error, { organizationId });
    throw error;
  }
}

// ============================================================================
// ENROLLMENT MANAGEMENT
// ============================================================================

/**
 * Enroll a lead in a sequence
 */
export async function enrollInSequence(params: {
  sequenceId: string;
  leadId: string;
  organizationId: string;
  metadata?: Record<string, any>;
}): Promise<SequenceEnrollment> {
  try {
    const { sequenceId, leadId, organizationId, metadata = {} } = params;

    // Get sequence
    const sequence = await getSequence(sequenceId);
    if (!sequence) {
      throw new Error(`Sequence not found: ${sequenceId}`);
    }

    if (!sequence.isActive) {
      throw new Error(`Sequence is not active: ${sequenceId}`);
    }

    // Check if already enrolled
    const existing = await db
      .collection('sequenceEnrollments')
      .where('sequenceId', '==', sequenceId)
      .where('leadId', '==', leadId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new Error(`Lead already enrolled in sequence: ${leadId}`);
    }

    const now = new Date();
    
    // Calculate first step execution time
    const firstStep = sequence.steps[0];
    const nextExecutionAt = new Date(now.getTime() + firstStep.delayHours * 60 * 60 * 1000);

    const enrollment: SequenceEnrollment = {
      id: db.collection('sequenceEnrollments').doc().id,
      sequenceId,
      leadId,
      organizationId,
      status: 'active',
      currentStepIndex: 0,
      executedSteps: [],
      nextExecutionAt,
      enrolledAt: now,
      metadata,
    };

    await db.collection('sequenceEnrollments').doc(enrollment.id).set({
      ...enrollment,
      enrolledAt: Timestamp.fromDate(enrollment.enrolledAt),
      nextExecutionAt: Timestamp.fromDate(nextExecutionAt),
    });

    // Update sequence stats
    await db.collection('sequences').doc(sequenceId).update({
      'stats.totalEnrolled': (sequence.stats.totalEnrolled || 0) + 1,
      'stats.activeEnrollments': (sequence.stats.activeEnrollments || 0) + 1,
    });

    logger.info('Lead enrolled in sequence', {
      enrollmentId: enrollment.id,
      sequenceId,
      leadId,
      nextExecutionAt: nextExecutionAt.toISOString(),
    });

    return enrollment;
  } catch (error) {
    logger.error('Failed to enroll in sequence', error, params);
    throw error;
  }
}

/**
 * Execute next step in sequence for an enrollment
 */
export async function executeSequenceStep(enrollmentId: string): Promise<void> {
  try {
    // Get enrollment
    const enrollmentDoc = await db.collection('sequenceEnrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    const enrollment = {
      ...enrollmentDoc.data(),
      enrolledAt: enrollmentDoc.data()?.enrolledAt?.toDate(),
      nextExecutionAt: enrollmentDoc.data()?.nextExecutionAt?.toDate(),
      completedAt: enrollmentDoc.data()?.completedAt?.toDate(),
    } as SequenceEnrollment;

    if (enrollment.status !== 'active') {
      logger.info('Enrollment not active, skipping execution', {
        enrollmentId,
        status: enrollment.status,
      });
      return;
    }

    // Get sequence
    const sequence = await getSequence(enrollment.sequenceId);
    if (!sequence) {
      throw new Error(`Sequence not found: ${enrollment.sequenceId}`);
    }

    // Get current step
    const currentStep = sequence.steps[enrollment.currentStepIndex];
    if (!currentStep) {
      // Sequence complete
      await completeEnrollment(enrollmentId);
      return;
    }

    logger.info('Executing sequence step', {
      enrollmentId,
      stepIndex: enrollment.currentStepIndex,
      channel: currentStep.channel,
      action: currentStep.action,
    });

    // Execute the action based on channel
    let success = false;
    let error: string | undefined;

    try {
      await executeChannelAction(currentStep, enrollment);
      success = true;
    } catch (actionError) {
      error = actionError instanceof Error ? actionError.message : 'Unknown error';
      logger.error('Channel action failed', actionError, {
        enrollmentId,
        stepIndex: enrollment.currentStepIndex,
      });
    }

    // Record execution
    const executedStep = {
      stepId: currentStep.id,
      stepIndex: currentStep.stepIndex,
      channel: currentStep.channel,
      executedAt: new Date(),
      success,
      error,
    };

    // Update enrollment
    const nextStepIndex = enrollment.currentStepIndex + 1;
    const nextStep = sequence.steps[nextStepIndex];
    
    const updates: any = {
      executedSteps: [...enrollment.executedSteps, executedStep],
      currentStepIndex: nextStepIndex,
    };

    if (nextStep) {
      // Calculate next execution time
      const nextExecutionAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);
      updates.nextExecutionAt = Timestamp.fromDate(nextExecutionAt);
    } else {
      // No more steps - mark as completed
      updates.status = 'completed';
      updates.completedAt = Timestamp.now();
      updates.nextExecutionAt = null;

      // Update sequence stats
      await db.collection('sequences').doc(enrollment.sequenceId).update({
        'stats.activeEnrollments': Math.max(0, (sequence.stats.activeEnrollments || 0) - 1),
        'stats.completedEnrollments': (sequence.stats.completedEnrollments || 0) + 1,
      });
    }

    await db.collection('sequenceEnrollments').doc(enrollmentId).update(updates);

    logger.info('Sequence step executed', {
      enrollmentId,
      stepIndex: enrollment.currentStepIndex,
      success,
      nextStepIndex,
      hasMoreSteps: !!nextStep,
    });
  } catch (error) {
    logger.error('Failed to execute sequence step', error, { enrollmentId });
    throw error;
  }
}

/**
 * Handle condition trigger (e.g., email opened, LinkedIn connected)
 */
export async function handleCondition(params: {
  enrollmentId: string;
  conditionType: SequenceConditionType;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const { enrollmentId, conditionType, metadata = {} } = params;

    // Get enrollment
    const enrollmentDoc = await db.collection('sequenceEnrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    const enrollment = enrollmentDoc.data() as SequenceEnrollment;

    // Get sequence
    const sequence = await getSequence(enrollment.sequenceId);
    if (!sequence) {
      throw new Error(`Sequence not found: ${enrollment.sequenceId}`);
    }

    // Get last executed step
    const lastExecutedStep = enrollment.executedSteps[enrollment.executedSteps.length - 1];
    if (!lastExecutedStep) {
      logger.warn('No executed steps found for enrollment', { enrollmentId });
      return;
    }

    // Find the step in sequence
    const step = sequence.steps.find((s) => s.id === lastExecutedStep.stepId);
    if (!step || !step.conditions) {
      return;
    }

    // Find matching condition
    const condition = step.conditions.find((c) => c.type === conditionType);
    if (!condition) {
      return;
    }

    logger.info('Condition triggered', {
      enrollmentId,
      conditionType,
      stepId: step.id,
    });

    // Handle condition
    if (condition.nextStepIndex !== undefined) {
      // Jump to specific step
      const nextStep = sequence.steps[condition.nextStepIndex];
      if (nextStep) {
        const nextExecutionAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);
        
        await db.collection('sequenceEnrollments').doc(enrollmentId).update({
          currentStepIndex: condition.nextStepIndex,
          nextExecutionAt: Timestamp.fromDate(nextExecutionAt),
        });

        logger.info('Jumped to step due to condition', {
          enrollmentId,
          fromStepIndex: enrollment.currentStepIndex,
          toStepIndex: condition.nextStepIndex,
        });
      }
    } else if (condition.fallback) {
      // Execute fallback step
      await executeChannelAction(condition.fallback, enrollment);
      
      logger.info('Executed fallback step', {
        enrollmentId,
        channel: condition.fallback.channel,
      });
    }

    // Store condition trigger in metadata
    await db.collection('sequenceEnrollments').doc(enrollmentId).update({
      [`metadata.conditions.${conditionType}`]: {
        triggeredAt: Timestamp.now(),
        ...metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to handle condition', error, params);
    throw error;
  }
}

/**
 * Stop enrollment
 */
export async function stopEnrollment(enrollmentId: string, reason?: string): Promise<void> {
  try {
    await db.collection('sequenceEnrollments').doc(enrollmentId).update({
      status: 'stopped',
      completedAt: Timestamp.now(),
      'metadata.stopReason': reason || 'Manual stop',
    });

    // Get enrollment to update sequence stats
    const enrollment = (await db.collection('sequenceEnrollments').doc(enrollmentId).get()).data();
    if (enrollment) {
      await db.collection('sequences').doc(enrollment.sequenceId).update({
        'stats.activeEnrollments': Math.max(0, (enrollment.stats?.activeEnrollments || 0) - 1),
      });
    }

    logger.info('Enrollment stopped', { enrollmentId, reason });
  } catch (error) {
    logger.error('Failed to stop enrollment', error, { enrollmentId });
    throw error;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate sequence steps
 */
function validateSequenceSteps(steps: SequenceStep[]): void {
  if (!steps || steps.length === 0) {
    throw new Error('Sequence must have at least one step');
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    if (!step.channel) {
      throw new Error(`Step ${i} missing channel`);
    }
    
    if (!step.action) {
      throw new Error(`Step ${i} missing action`);
    }
    
    if (typeof step.delayHours !== 'number' || step.delayHours < 0) {
      throw new Error(`Step ${i} has invalid delayHours`);
    }

    if (step.stepIndex !== i) {
      throw new Error(`Step ${i} has incorrect stepIndex: ${step.stepIndex}`);
    }
  }
}

/**
 * Execute channel-specific action
 */
async function executeChannelAction(step: SequenceStep, enrollment: SequenceEnrollment): Promise<void> {
  // This is a placeholder - actual implementation would call:
  // - Email service for email channel
  // - LinkedIn scraper for LinkedIn channel
  // - Twilio for SMS channel
  // - Phone service for phone channel

  logger.info('Executing channel action', {
    channel: step.channel,
    action: step.action,
    leadId: enrollment.leadId,
    templateId: step.templateId,
  });

  // TODO: Implement actual channel execution
  // For now, just log the action
  
  switch (step.channel) {
    case 'email':
      // await sendEmail({ ... });
      logger.info('[SEQUENCE] Email action', { step, enrollment });
      break;
    
    case 'linkedin':
      // await sendLinkedInMessage({ ... });
      logger.info('[SEQUENCE] LinkedIn action', { step, enrollment });
      break;
    
    case 'sms':
      // await sendSMS({ ... });
      logger.info('[SEQUENCE] SMS action', { step, enrollment });
      break;
    
    case 'phone':
      // await makePhoneCall({ ... });
      logger.info('[SEQUENCE] Phone action', { step, enrollment });
      break;
  }
}

/**
 * Complete enrollment
 */
async function completeEnrollment(enrollmentId: string): Promise<void> {
  await db.collection('sequenceEnrollments').doc(enrollmentId).update({
    status: 'completed',
    completedAt: Timestamp.now(),
  });

  logger.info('Enrollment completed', { enrollmentId });
}

// ============================================================================
// BATCH EXECUTION
// ============================================================================

/**
 * Process due sequence enrollments
 * Should be called by a cron job every hour
 */
export async function processDueSequenceSteps(organizationId: string): Promise<number> {
  try {
    const now = new Date();

    // Find all enrollments that are due for execution
    const dueEnrollments = await db
      .collection('sequenceEnrollments')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .where('nextExecutionAt', '<=', Timestamp.fromDate(now))
      .limit(100) // Process in batches
      .get();

    logger.info('Processing due sequence steps', {
      organizationId,
      count: dueEnrollments.size,
    });

    let processed = 0;

    for (const doc of dueEnrollments.docs) {
      try {
        await executeSequenceStep(doc.id);
        processed++;
      } catch (error) {
        logger.error('Failed to execute sequence step', error, {
          enrollmentId: doc.id,
        });
      }
    }

    logger.info('Processed due sequence steps', {
      organizationId,
      processed,
      total: dueEnrollments.size,
    });

    return processed;
  } catch (error) {
    logger.error('Failed to process due sequence steps', error, { organizationId });
    throw error;
  }
}
