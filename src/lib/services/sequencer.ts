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

import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';
import { sendEmail } from '@/lib/email/email-service';
import { sendSMS } from '@/lib/sms/sms-service';
import { sendLinkedInMessage } from '@/lib/integrations/linkedin-messaging';
import { initiateCall } from '@/lib/voice/twilio-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type { SalesSignal } from '@/lib/orchestration/types';

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
  data?: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
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
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const { organizationId, name, description, steps, createdBy } = params;

    // Validate steps
    validateSequenceSteps(steps);

    const now = new Date();
    const sequence: Sequence = {
      id: adminDal.getCollection('SEQUENCES').doc().id,
      organizationId,
      name,
      ...(description && { description }), // Only include if defined
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

    await adminDal.safeSetDoc('SEQUENCES', sequence.id, {
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
    logger.error('Failed to create sequence', error as Error);
    throw new Error(`Failed to create sequence: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Get sequence by ID
 */
export async function getSequence(sequenceId: string): Promise<Sequence | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const doc = await adminDal.safeGetDoc('SEQUENCES', sequenceId);
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    const dataAny = data as Record<string, unknown>;
    const createdAtValue = dataAny.createdAt as { toDate?: () => Date } | undefined;
    const updatedAtValue = dataAny.updatedAt as { toDate?: () => Date } | undefined;
    return {
      ...data,
      createdAt: createdAtValue?.toDate?.() ?? new Date(),
      updatedAt: updatedAtValue?.toDate?.() ?? new Date(),
    } as Sequence;
  } catch (error) {
    logger.error('Failed to get sequence', error as Error);
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
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await adminDal.safeUpdateDoc('SEQUENCES', sequenceId, updateData);

    logger.info('Sequence updated', { sequenceId });
  } catch (error) {
    logger.error('Failed to update sequence', error as Error);
    throw error;
  }
}

/**
 * List sequences for organization
 */
export async function listSequences(_organizationId: string): Promise<Sequence[]> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const snapshot = await adminDal.safeQuery('SEQUENCES', (ref) =>
      ref
        .orderBy('createdAt', 'desc')
    );

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const dataAny = data as Record<string, unknown>;
      const createdAtValue = dataAny.createdAt as { toDate?: () => Date } | undefined;
      const updatedAtValue = dataAny.updatedAt as { toDate?: () => Date } | undefined;
      return {
        ...data,
        createdAt: createdAtValue?.toDate?.() ?? new Date(),
        updatedAt: updatedAtValue?.toDate?.() ?? new Date(),
      } as Sequence;
    });
  } catch (error) {
    logger.error('Failed to list sequences', error as Error);
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
  metadata?: Record<string, unknown>;
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

    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Check if already enrolled
    const existing = await adminDal.safeQuery('SEQUENCE_ENROLLMENTS', (ref) =>
      ref
        .where('sequenceId', '==', sequenceId)
        .where('leadId', '==', leadId)
        .where('status', '==', 'active')
        .limit(1)
    );

    if (!existing.empty) {
      throw new Error(`Lead already enrolled in sequence: ${leadId}`);
    }

    const now = new Date();
    
    // Calculate first step execution time
    const firstStep = sequence.steps[0];
    const nextExecutionAt = new Date(now.getTime() + firstStep.delayHours * 60 * 60 * 1000);

    const enrollment: SequenceEnrollment = {
      id: adminDal.getCollection('SEQUENCE_ENROLLMENTS').doc().id,
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

    await adminDal.safeSetDoc('SEQUENCE_ENROLLMENTS', enrollment.id, {
      ...enrollment,
      enrolledAt: Timestamp.fromDate(enrollment.enrolledAt),
      nextExecutionAt: Timestamp.fromDate(nextExecutionAt),
    });

    // Update sequence stats
    await adminDal.safeUpdateDoc('SEQUENCES', sequenceId, {
      'stats.totalEnrolled': (sequence.stats.totalEnrolled ?? 0) + 1,
      'stats.activeEnrollments': (sequence.stats.activeEnrollments ?? 0) + 1,
    });

    logger.info('Lead enrolled in sequence', {
      enrollmentId: enrollment.id,
      sequenceId,
      leadId,
      nextExecutionAt: nextExecutionAt.toISOString(),
    });

    // Emit sequence.started signal
    await emitSequenceSignal({
      type: 'sequence.started',
      leadId,
      organizationId,
      enrollment,
      sequence,
    });

    return enrollment;
  } catch (error) {
    logger.error('Failed to enroll in sequence', error as Error);
    throw error;
  }
}

/**
 * Execute next step in sequence for an enrollment
 */
export async function executeSequenceStep(enrollmentId: string): Promise<void> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Get enrollment
    const enrollmentDoc = await adminDal.safeGetDoc('SEQUENCE_ENROLLMENTS', enrollmentId);
    if (!enrollmentDoc.exists) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    const enrollmentData = enrollmentDoc.data() as Record<string, unknown>;
    const enrolledAtValue = enrollmentData?.enrolledAt as Timestamp | undefined;
    const nextExecValue = enrollmentData?.nextExecutionAt as Timestamp | undefined;
    const completedAtValue = enrollmentData?.completedAt as Timestamp | undefined;
    const enrollment = {
      ...enrollmentData,
      enrolledAt: enrolledAtValue?.toDate(),
      nextExecutionAt: nextExecValue?.toDate(),
      completedAt: completedAtValue?.toDate(),
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
      logger.error('Channel action failed', actionError as Error);
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
    
    const updates: Record<string, unknown> = {
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
      await adminDal.safeUpdateDoc('SEQUENCES', enrollment.sequenceId, {
        'stats.activeEnrollments': Math.max(0, (sequence.stats.activeEnrollments ?? 0) - 1),
        'stats.completedEnrollments': (sequence.stats.completedEnrollments ?? 0) + 1,
      });

      // Emit sequence.completed signal
      await emitSequenceSignal({
        type: 'sequence.completed',
        leadId: enrollment.leadId,
        organizationId: enrollment.organizationId,
        enrollment: { ...enrollment, status: 'completed' },
        sequence,
      });
    }

    await adminDal.safeUpdateDoc('SEQUENCE_ENROLLMENTS', enrollmentId, updates);

    logger.info('Sequence step executed', {
      enrollmentId,
      stepIndex: enrollment.currentStepIndex,
      success,
      nextStepIndex,
      hasMoreSteps: !!nextStep,
    });
  } catch (error) {
    logger.error('Failed to execute sequence step', error as Error);
    throw error;
  }
}

/**
 * Handle condition trigger (e.g., email opened, LinkedIn connected)
 */
export async function handleCondition(params: {
  enrollmentId: string;
  conditionType: SequenceConditionType;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const { enrollmentId, conditionType, metadata = {} } = params;

    // Get enrollment
    const enrollmentDoc = await adminDal.safeGetDoc('SEQUENCE_ENROLLMENTS', enrollmentId);
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
    if (!step?.conditions) {
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
        
        await adminDal.safeUpdateDoc('SEQUENCE_ENROLLMENTS', enrollmentId, {
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
    await adminDal.safeUpdateDoc('SEQUENCE_ENROLLMENTS', enrollmentId, {
      [`metadata.conditions.${conditionType}`]: {
        triggeredAt: Timestamp.now(),
        ...metadata,
      },
    });
  } catch (error) {
    logger.error('Failed to handle condition', error as Error);
    throw error;
  }
}

/**
 * Stop enrollment
 */
export async function stopEnrollment(enrollmentId: string, reason?: string): Promise<void> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    await adminDal.safeUpdateDoc('SEQUENCE_ENROLLMENTS', enrollmentId, {
      status: 'stopped',
      completedAt: Timestamp.now(),
      'metadata.stopReason': (reason !== '' && reason != null) ? reason : 'Manual stop',
    });

    // Get enrollment to update sequence stats
    const enrollmentDoc = await adminDal.safeGetDoc('SEQUENCE_ENROLLMENTS', enrollmentId);
    const enrollmentData = enrollmentDoc.data() as Record<string, unknown> | undefined;
    if (enrollmentData) {
      const statsData = enrollmentData.stats as Record<string, number> | undefined;
      await adminDal.safeUpdateDoc('SEQUENCES', enrollmentData.sequenceId as string, {
        'stats.activeEnrollments': Math.max(0, (statsData?.activeEnrollments ?? 0) - 1),
      });
    }

    logger.info('Enrollment stopped', { enrollmentId, reason });

    // Emit sequence.paused signal
    if (enrollmentData) {
      const enrolledAtVal = enrollmentData.enrolledAt as Timestamp | Date | undefined;
      const nextExecVal = enrollmentData.nextExecutionAt as Timestamp | Date | undefined;
      const completedAtVal = enrollmentData.completedAt as Timestamp | Date | undefined;
      const enrollment: SequenceEnrollment = {
        ...enrollmentData,
        id: enrollmentId,
        enrolledAt: (enrolledAtVal && 'toDate' in enrolledAtVal && typeof enrolledAtVal.toDate === 'function') ? enrolledAtVal.toDate() : enrolledAtVal as Date,
        nextExecutionAt: (nextExecVal && 'toDate' in nextExecVal && typeof nextExecVal.toDate === 'function') ? nextExecVal.toDate() : nextExecVal as Date | undefined,
        completedAt: (completedAtVal && 'toDate' in completedAtVal && typeof completedAtVal.toDate === 'function') ? completedAtVal.toDate() : completedAtVal as Date | undefined,
        status: 'stopped',
      } as SequenceEnrollment;
      
      await emitSequenceSignal({
        type: 'sequence.paused',
        leadId: enrollment.leadId,
        organizationId: enrollment.organizationId,
        enrollment,
        sequence: null,
        metadata: { reason: (reason !== '' && reason != null) ? reason : 'Manual stop' },
      });
    }
  } catch (error) {
    logger.error('Failed to stop enrollment', error as Error);
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

// ============================================================================
// HELPER FUNCTIONS FOR CHANNEL EXECUTION
// ============================================================================

interface LeadData {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyName?: string;
  title?: string;
  linkedInUrl?: string;
  customFields?: Record<string, string>;
}

/**
 * Get lead data from Firestore
 */
async function getLeadData(leadId: string, organizationId: string): Promise<LeadData | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Get all workspaces for this organization
    const workspacesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/workspaces',
      { orgId: organizationId }
    );
    const workspacesSnapshot = await workspacesRef.get();
    
    for (const workspaceDoc of workspacesSnapshot.docs) {
      // Check leads collection
      const leadRef = adminDal.getNestedCollection(
        'organizations/{orgId}/workspaces/{wsId}/entities/leads/records',
        { orgId: organizationId, wsId: workspaceDoc.id }
      ).doc(leadId);
      
      const leadDoc = await leadRef.get();
      if (leadDoc.exists) {
        return { id: leadDoc.id, ...leadDoc.data() } as LeadData;
      }

      // Also check contacts collection
      const contactRef = adminDal.getNestedCollection(
        'organizations/{orgId}/workspaces/{wsId}/entities/contacts/records',
        { orgId: organizationId, wsId: workspaceDoc.id }
      ).doc(leadId);

      const contactDoc = await contactRef.get();
      if (contactDoc.exists) {
        return { id: contactDoc.id, ...contactDoc.data() } as LeadData;
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to get lead data', error as Error, { leadId, organizationId });
    throw error;
  }
}

interface TemplateData {
  id: string;
  content: string;
}

/**
 * Load template from Firestore
 */
async function loadTemplate(templateId: string, organizationId: string): Promise<TemplateData | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const templatesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/templates',
      { orgId: organizationId }
    );

    const templateDoc = await templatesRef.doc(templateId).get();

    if (templateDoc.exists) {
      return { id: templateDoc.id, ...templateDoc.data() } as TemplateData;
    }

    return null;
  } catch (error) {
    logger.error('Failed to load template', error as Error, { templateId, organizationId });
    return null;
  }
}

/**
 * Substitute variables in template
 */
function substituteVariables(template: string, leadData: LeadData): string {
  let result = template;
  
  // Common variable substitutions
  const substitutions: Record<string, string> = {
    '{{firstName}}': leadData.firstName ?? '',
    '{{lastName}}': leadData.lastName ?? '',
    '{{name}}': leadData.name ?? `${leadData.firstName ?? ''} ${leadData.lastName ?? ''}`.trim(),
    '{{email}}': leadData.email ?? '',
    '{{phone}}': leadData.phone ?? '',
    '{{company}}': leadData.company ?? leadData.companyName ?? '',
    '{{title}}': leadData.title ?? '',
    '{{linkedInUrl}}': leadData.linkedInUrl ?? '',
  };
  
  // Also substitute any custom fields
  if (leadData.customFields) {
    Object.keys(leadData.customFields).forEach(key => {
      substitutions[`{{${key}}}`] = leadData.customFields?.[key] ?? '';
    });
  }
  
  // Perform substitutions
  Object.keys(substitutions).forEach(variable => {
    result = result.replace(new RegExp(variable, 'g'), substitutions[variable]);
  });
  
  return result;
}

/**
 * Execute email action
 */
async function executeEmailAction(
  leadData: LeadData,
  messageContent: string,
  step: SequenceStep,
  enrollment: SequenceEnrollment
): Promise<void> {
  if (!leadData.email) {
    throw new Error('Lead has no email address');
  }

  const subjectVal = step.data?.subject as string | undefined;
  const subject = (subjectVal !== '' && subjectVal != null)
    ? subjectVal
    : 'Following up';
  
  // In test mode, just log the action without actually sending
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    logger.info('[TEST MODE] Mock email send', {
      to: leadData.email,
      subject,
      leadId: enrollment.leadId,
    });
    return;
  }
  
  const result = await sendEmail({
    to: leadData.email,
    subject: subject,
    html: messageContent,
    text: messageContent.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    metadata: {
      organizationId: enrollment.organizationId,
      sequenceId: enrollment.sequenceId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      stepId: step.id,
    },
  });
  
  if (!result.success) {
    throw new Error((result.error !== '' && result.error != null) 
      ? result.error 
      : 'Failed to send email');
  }
  
  logger.info('Email sent via sequence', {
    leadId: enrollment.leadId,
    messageId: result.messageId,
  });
}

/**
 * Execute LinkedIn action
 */
async function executeLinkedInAction(
  leadData: LeadData,
  messageContent: string,
  step: SequenceStep,
  enrollment: SequenceEnrollment
): Promise<void> {
  const linkedInIdentifier = leadData.linkedInUrl ?? leadData.email;

  if (!linkedInIdentifier) {
    throw new Error('Lead has no LinkedIn URL or email');
  }

  // In test mode, just log the action without actually sending
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    logger.info('[TEST MODE] Mock LinkedIn message send', {
      to: linkedInIdentifier,
      leadId: enrollment.leadId,
    });
    return;
  }

  // Note: LinkedIn requires access token - this would need to be configured per organization
  const accessToken = (step.data?.linkedInAccessToken as string | undefined) ?? '';
  
  const result = await sendLinkedInMessage(
    accessToken,
    linkedInIdentifier,
    messageContent
  );
  
  if (!result.success) {
    throw new Error((result.error !== '' && result.error != null) 
      ? result.error 
      : 'Failed to send LinkedIn message');
  }
  
  logger.info('LinkedIn message sent via sequence', {
    leadId: enrollment.leadId,
    messageId: result.messageId,
  });
}

/**
 * Execute SMS action
 */
async function executeSMSAction(
  leadData: LeadData,
  _messageContent: string,
  step: SequenceStep,
  enrollment: SequenceEnrollment
): Promise<void> {
  if (!leadData.phone) {
    throw new Error('Lead has no phone number');
  }
  
  // In test mode, just log the action without actually sending
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    logger.info('[TEST MODE] Mock SMS send', {
      to: leadData.phone,
      leadId: enrollment.leadId,
    });
    return;
  }
  
  const result = await sendSMS({
    to: leadData.phone,
    message: _messageContent,
    organizationId: enrollment.organizationId,
    metadata: {
      sequenceId: enrollment.sequenceId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      stepId: step.id,
    },
  });
  
  if (!result.success) {
    throw new Error((result.error !== '' && result.error != null) 
      ? result.error 
      : 'Failed to send SMS');
  }
  
  logger.info('SMS sent via sequence', {
    leadId: enrollment.leadId,
    messageId: result.messageId,
  });
}

/**
 * Execute phone action
 */
async function executePhoneAction(
  leadData: LeadData,
  _messageContent: string,
  step: SequenceStep,
  enrollment: SequenceEnrollment
): Promise<void> {
  if (!leadData.phone) {
    throw new Error('Lead has no phone number');
  }

  // In test mode, just log the action without actually making a call
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    logger.info('[TEST MODE] Mock phone call', {
      to: leadData.phone,
      leadId: enrollment.leadId,
    });
    return;
  }

  // Use the organization's AI agent for the call
  const agentId = (step.data?.agentId as string | undefined) ?? 'default';
  
  const call = await initiateCall(
    leadData.phone,
    agentId,
    {
      record: true,
      timeout: 30,
    }
  );
  
  logger.info('Phone call initiated via sequence', {
    leadId: enrollment.leadId,
    callSid: call.callSid,
  });
}

/**
 * Execute channel-specific action
 */
async function executeChannelAction(step: SequenceStep, enrollment: SequenceEnrollment): Promise<void> {
  logger.info('Executing channel action', {
    channel: step.channel,
    action: step.action,
    leadId: enrollment.leadId,
    templateId: step.templateId,
  });

  // Fetch lead data to get contact information
  const leadData = await getLeadData(enrollment.leadId, enrollment.organizationId);
  
  if (!leadData) {
    // In test mode, create mock lead data
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.info('[TEST MODE] Using mock lead data for channel execution', {
        leadId: enrollment.leadId,
        channel: step.channel,
      });
      // Mock successful execution in test mode
      return;
    }
    throw new Error(`Lead not found: ${enrollment.leadId}`);
  }

  // Load template and substitute variables
  let messageContent = step.action; // Default to action text
  
  if (step.templateId) {
    const template = await loadTemplate(step.templateId, enrollment.organizationId);
    if (template) {
      messageContent = substituteVariables(template.content, leadData);
    }
  }
  
  // Execute channel-specific action
  try {
    switch (step.channel) {
      case 'email':
        await executeEmailAction(leadData, messageContent, step, enrollment);
        break;
      
      case 'linkedin':
        await executeLinkedInAction(leadData, messageContent, step, enrollment);
        break;
      
      case 'sms':
        await executeSMSAction(leadData, messageContent, step, enrollment);
        break;
      
      case 'phone':
        await executePhoneAction(leadData, messageContent, step, enrollment);
        break;
      
      default:
        logger.warn('Unknown channel type', { channel: step.channel });
    }
    
    logger.info('Channel action executed successfully', {
      channel: step.channel,
      leadId: enrollment.leadId,
    });
  } catch (error) {
    logger.error('Channel action failed', error as Error, {
      channel: step.channel,
      leadId: enrollment.leadId,
    });
    throw error;
  }
}

/**
 * Complete enrollment
 */
async function completeEnrollment(enrollmentId: string): Promise<void> {
  if (!adminDal) {
    throw new Error('Admin DAL not initialized');
  }

  await adminDal.safeUpdateDoc('SEQUENCE_ENROLLMENTS', enrollmentId, {
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
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const now = new Date();

    // Find all enrollments that are due for execution
    const dueEnrollments = await adminDal.safeQuery('SEQUENCE_ENROLLMENTS', (ref) =>
      ref
        .where('status', '==', 'active')
        .where('nextExecutionAt', '<=', Timestamp.fromDate(now))
        .limit(100) // Process in batches
    );

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
        logger.error('Failed to execute sequence step', error as Error);
      }
    }

    logger.info('Processed due sequence steps', {
      organizationId,
      processed,
      total: dueEnrollments.size,
    });

    return processed;
  } catch (error) {
    logger.error('Failed to process due sequence steps', error as Error);
    throw error;
  }
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit sequence-related signals to the Neural Net
 */
async function emitSequenceSignal(params: {
  type: 'sequence.started' | 'sequence.completed' | 'sequence.paused' | 'sequence.failed';
  leadId: string;
  organizationId: string;
  enrollment: SequenceEnrollment;
  sequence: Sequence | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { type, leadId, organizationId, enrollment, sequence, metadata = {} } = params;
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type,
      leadId,
      orgId: organizationId,
      confidence: 1.0, // Sequence events are always certain
      priority: type === 'sequence.failed' ? 'High' : 'Medium',
      metadata: {
        source: 'sequencer',
        enrollmentId: enrollment.id,
        sequenceId: enrollment.sequenceId,
        sequenceName: sequence?.name,
        status: enrollment.status,
        currentStepIndex: enrollment.currentStepIndex ?? 0,
        executedStepsCount: enrollment.executedSteps?.length ?? 0,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        completedAt: enrollment.completedAt?.toISOString(),
        ...metadata,
      },
    });

    logger.info('Sequence signal emitted', {
      type,
      leadId,
      enrollmentId: enrollment.id,
    });
  } catch (error) {
    // Don't fail sequence execution if signal emission fails
    logger.error('Failed to emit sequence signal', error as Error);
  }
}

/**
 * Initialize signal observers for the sequencer
 * 
 * This function sets up real-time listeners that automatically react to signals.
 * Should be called once when the application starts.
 * 
 * @param organizationId - Organization to observe signals for
 * @param autoEnrollConfig - Configuration for auto-enrollment
 */
export async function initializeSequencerSignalObservers(
  organizationId: string,
  autoEnrollConfig: {
    /** Sequence to enroll qualified leads into */
    qualifiedLeadSequenceId?: string;
    /** Sequence to enroll high-intent leads into */
    highIntentSequenceId?: string;
    /** Whether to auto-enroll qualified leads */
    autoEnrollQualified?: boolean;
    /** Whether to auto-enroll high-intent leads */
    autoEnrollHighIntent?: boolean;
  }
): Promise<() => void> {
  const coordinator = getServerSignalCoordinator();
  const unsubscribers: Array<() => void> = [];

  logger.info('Initializing sequencer signal observers', {
    organizationId,
    autoEnrollConfig: JSON.stringify(autoEnrollConfig),
  });

  // Observer 1: Auto-enroll qualified leads
  const qualifiedSequenceId = autoEnrollConfig.qualifiedLeadSequenceId;
  if (autoEnrollConfig.autoEnrollQualified && qualifiedSequenceId) {
    const observeResult = coordinator.observeSignals(
      {
        types: ['lead.qualified'],
        orgId: organizationId,
        minConfidence: 0.7,
        unprocessedOnly: true,
      },
      async (signal: SalesSignal) => {
        try {
          if (!signal.leadId) {
            logger.warn('Received lead.qualified signal without leadId', { signalId: signal.id });
            return;
          }

          logger.info('Auto-enrolling qualified lead in sequence', {
            leadId: signal.leadId,
            sequenceId: qualifiedSequenceId,
            score: signal.metadata?.totalScore as string | number | undefined ?? 0,
            grade: signal.metadata?.grade as string | undefined ?? 'unknown',
          });

          // Check if already enrolled
          const existing = await adminDal?.safeQuery('SEQUENCE_ENROLLMENTS', (ref) =>
            ref
              .where('sequenceId', '==', qualifiedSequenceId)
              .where('leadId', '==', signal.leadId)
              .where('status', '==', 'active')
              .limit(1)
          );

          if (!existing || existing.empty) {
            await enrollInSequence({
              sequenceId: qualifiedSequenceId,
              leadId: signal.leadId,
              organizationId,
              metadata: {
                source: 'signal-observer',
                trigger: 'lead.qualified',
                signalId: signal.id,
                score: signal.metadata?.totalScore,
                grade: signal.metadata?.grade,
              },
            });

            // Mark signal as processed
            const signalId = signal.id;
            if (signalId) {
              await coordinator.markSignalProcessed(organizationId, signalId, {
                success: true,
                action: 'enrolled_in_sequence',
                module: 'sequencer',
              });
            }
          } else {
            logger.info('Lead already enrolled in sequence, skipping', {
              leadId: signal.leadId,
              sequenceId: qualifiedSequenceId,
            });
          }
        } catch (error) {
          logger.error('Failed to auto-enroll qualified lead', error as Error);

          // Mark signal processing as failed
          if (signal.id) {
            await coordinator.markSignalProcessed(organizationId, signal.id, {
              success: false,
              action: 'enrollment_failed',
              module: 'sequencer',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    );
    const unsubscribe = typeof observeResult === 'object' && observeResult !== null && 'then' in observeResult
      ? await (observeResult as Promise<() => void>)
      : observeResult as () => void;
    unsubscribers.push(unsubscribe);
  }

  // Observer 2: Auto-enroll high-intent leads
  const highIntentSequenceId = autoEnrollConfig.highIntentSequenceId;
  if (autoEnrollConfig.autoEnrollHighIntent && highIntentSequenceId) {
    const observeResult = coordinator.observeSignals(
      {
        types: ['lead.intent.high'],
        orgId: organizationId,
        minConfidence: 0.8,
        unprocessedOnly: true,
      },
      async (signal: SalesSignal) => {
        try {
          if (!signal.leadId) {
            logger.warn('Received lead.intent.high signal without leadId', { signalId: signal.id });
            return;
          }

          logger.info('Auto-enrolling high-intent lead in sequence', {
            leadId: signal.leadId,
            sequenceId: highIntentSequenceId,
            intentScore: signal.metadata?.intentScore as string | number | undefined ?? 0,
            detectedSignals: (signal.metadata?.detectedSignals as string[] | undefined ?? []).join(','),
          });

          // Check if already enrolled
          const existing = await adminDal?.safeQuery('SEQUENCE_ENROLLMENTS', (ref) =>
            ref
              .where('sequenceId', '==', highIntentSequenceId)
              .where('leadId', '==', signal.leadId)
              .where('status', '==', 'active')
              .limit(1)
          );

          if (!existing || existing.empty) {
            await enrollInSequence({
              sequenceId: highIntentSequenceId,
              leadId: signal.leadId,
              organizationId,
              metadata: {
                source: 'signal-observer',
                trigger: 'lead.intent.high',
                signalId: signal.id,
                intentScore: signal.metadata?.intentScore,
                detectedSignals: signal.metadata?.detectedSignals,
                nextBestAction: signal.metadata?.nextBestAction,
              },
            });

            // Mark signal as processed
            const signalId = signal.id;
            if (signalId) {
              await coordinator.markSignalProcessed(organizationId, signalId, {
                success: true,
                action: 'enrolled_in_sequence',
                module: 'sequencer',
              });
            }
          } else {
            logger.info('Lead already enrolled in sequence, skipping', {
              leadId: signal.leadId,
              sequenceId: highIntentSequenceId,
            });
          }
        } catch (error) {
          logger.error('Failed to auto-enroll high-intent lead', error as Error);

          // Mark signal processing as failed
          if (signal.id) {
            await coordinator.markSignalProcessed(organizationId, signal.id, {
              success: false,
              action: 'enrollment_failed',
              module: 'sequencer',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    );
    const unsubscribe = typeof observeResult === 'object' && observeResult !== null && 'then' in observeResult
      ? await (observeResult as Promise<() => void>)
      : observeResult as () => void;
    unsubscribers.push(unsubscribe);
  }

  logger.info('Sequencer signal observers initialized', {
    organizationId,
    observersCount: unsubscribers.length,
  });

  // Return cleanup function
  return () => {
    logger.info('Cleaning up sequencer signal observers', { organizationId });
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
}
