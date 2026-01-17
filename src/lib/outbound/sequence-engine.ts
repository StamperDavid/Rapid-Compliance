/**
 * Sequence Engine
 * Core logic for managing and executing email sequences
 */

import type {
  OutboundSequence,
  ProspectEnrollment,
  SequenceStep,
  StepAction
} from '@/types/outbound-sequence';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';

interface ProspectData {
  email?: string;
  name?: string;
  linkedInUrl?: string;
  phone?: string;
}

interface OrgData {
  emailProvider?: string;
  fromEmail?: string;
}

interface IntegrationData {
  service?: string;
  accessToken?: string;
}

interface StepStats {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  successRate?: number;
  updatedAt?: Date;
}

export class SequenceEngine {
  /**
   * Enroll a prospect in a sequence
   */
  static async enrollProspect(
    prospectId: string,
    sequenceId: string,
    organizationId: string
  ): Promise<ProspectEnrollment> {
    

    // Load sequence
    const sequence = await this.getSequence(sequenceId, organizationId);
    if (!sequence) {
      throw new Error('Sequence not found');
    }

    if (sequence.status !== 'active') {
      throw new Error('Cannot enroll in inactive sequence');
    }

    // Check if already enrolled
    const existing = await this.getEnrollment(prospectId, sequenceId, organizationId);
    if (existing?.status === 'active') {
      throw new Error('Prospect already enrolled in this sequence');
    }

    // Create enrollment
    const enrollment: ProspectEnrollment = {
      id: `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sequenceId,
      prospectId,
      organizationId,
      status: 'active',
      currentStep: 0,
      enrolledAt: new Date().toISOString(),
      nextStepAt: this.calculateNextStepTime(sequence.steps[0]),
      stepActions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save enrollment
    await this.saveEnrollment(enrollment);

    // Schedule first step
    await this.scheduleStep(enrollment, sequence.steps[0]);

    // Update sequence analytics
    await this.updateSequenceAnalytics(sequenceId, organizationId, {
      totalEnrolled: 1,
      activeProspects: 1,
    });

    

    return enrollment;
  }

  /**
   * Unenroll a prospect from a sequence
   */
  static async unenrollProspect(
    prospectId: string,
    sequenceId: string,
    organizationId: string,
    reason: 'manual' | 'replied' | 'converted' | 'unsubscribed' | 'bounced'
  ): Promise<void> {
    

    const enrollment = await this.getEnrollment(prospectId, sequenceId, organizationId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    enrollment.status = reason === 'unsubscribed' ? 'unsubscribed' : 
                         reason === 'bounced' ? 'bounced' : 'removed';
    enrollment.outcome = reason === 'manual' ? 'removed' : reason;
    enrollment.outcomeDate = new Date().toISOString();
    enrollment.completedAt = new Date().toISOString();
    enrollment.updatedAt = new Date().toISOString();

    await this.saveEnrollment(enrollment);

    // Update sequence analytics
    await this.updateSequenceAnalytics(sequenceId, organizationId, {
      activeProspects: -1,
      completedProspects: 1,
    });
  }

  /**
   * Process next step for a prospect
   */
  static async processNextStep(
    enrollmentId: string,
    organizationId: string
  ): Promise<void> {
    const enrollment = await this.getEnrollmentById(enrollmentId, organizationId);
    if (enrollment?.status !== 'active') {
      return; // Nothing to process
    }

    const sequence = await this.getSequence(enrollment.sequenceId, organizationId);
    if (sequence?.status !== 'active') {
      return;
    }

    const currentStepIndex = enrollment.currentStep;
    const currentStep = sequence.steps[currentStepIndex];

    if (!currentStep) {
      // Sequence completed
      await this.completeEnrollment(enrollment, organizationId);
      return;
    }

    // Check if it's time to send
    const now = new Date();
    const nextStepTime = enrollment.nextStepAt ? new Date(enrollment.nextStepAt) : now;

    if (now < nextStepTime) {
      return; // Not time yet
    }

    // Check step conditions
    if (!this.checkStepConditions(enrollment, currentStep)) {
      
      await this.skipStep(enrollment, currentStep, organizationId);
      return;
    }

    // Execute step
    await this.executeStep(enrollment, currentStep, sequence, organizationId);
  }

  /**
   * Execute a sequence step (send email, create task, etc.)
   */
  private static async executeStep(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    sequence: OutboundSequence,
    organizationId: string
  ): Promise<void> {
    

    try {
      // Create step action
      const action: StepAction = {
        stepId: step.id,
        stepOrder: step.order,
        scheduledFor:enrollment.nextStepAt ?? new Date().toISOString(),
        status: 'sent',
        subject: step.subject,
        body: step.body,
        createdAt: new Date().toISOString(),
      };

      // Execute based on step type
      switch (step.type) {
        case 'email': {
          await this.sendEmail(enrollment, step, organizationId);
          action.sentAt = new Date().toISOString();
          break;
        }

        case 'linkedin_message': {
          await this.sendLinkedInMessage(enrollment, step, organizationId);
          action.sentAt = new Date().toISOString();
          break;
        }

        case 'sms': {
          await this.sendSMS(enrollment, step, organizationId);
          action.sentAt = new Date().toISOString();
          break;
        }

        case 'call_task':
        case 'manual_task': {
          await this.createTask(enrollment, step, organizationId);
          action.status = 'scheduled';
          break;
        }
      }

      // Add action to enrollment
      enrollment.stepActions.push(action);

      // Move to next step
      enrollment.currentStep += 1;

      // Schedule next step
      const nextStep = sequence.steps[enrollment.currentStep];
      if (nextStep) {
        enrollment.nextStepAt = this.calculateNextStepTime(nextStep, new Date());
      } else {
        // No more steps - mark as completed
        enrollment.nextStepAt = undefined;
      }

      enrollment.updatedAt = new Date().toISOString();

      await this.saveEnrollment(enrollment);

      // Update step analytics
      await this.updateStepAnalytics(step.id, organizationId, {
        sent: 1,
      });

      // Update sequence analytics
      await this.updateSequenceAnalytics(sequence.id, organizationId, {
        totalSent: 1,
      });

      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Sequence Engine] Error executing step:', error instanceof Error ? error : undefined, { file: 'sequence-engine.ts' });

      // Record failed action
      const failedAction: StepAction = {
        stepId: step.id,
        stepOrder: step.order,
        scheduledFor:enrollment.nextStepAt ?? new Date().toISOString(),
        status: 'failed',
        error: errorMessage,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      enrollment.stepActions.push(failedAction);
      enrollment.updatedAt = new Date().toISOString();

      await this.saveEnrollment(enrollment);
    }
  }

  /**
   * Send email for a step
   */
  private static async sendEmail(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    organizationId: string
  ): Promise<void> {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    // Get prospect email from CRM
    const prospect: ProspectData | null = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/leads`,
      enrollment.prospectId
    );

    if (!prospect?.email) {
      throw new Error('Prospect email not found');
    }

    // Get organization settings to determine email provider
    const orgData: OrgData | null = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
    const emailProvider = (orgData?.emailProvider !== '' && orgData?.emailProvider != null)
      ? orgData.emailProvider
      : 'gmail'; // Default to Gmail
    const fromEmail = (orgData?.fromEmail !== '' && orgData?.fromEmail != null)
      ? orgData.fromEmail
      : process.env.FROM_EMAIL;

    if (!fromEmail) {
      throw new Error('FROM_EMAIL not configured for this organization');
    }

    // Try Gmail API first (free, integrated)
    try {
      const { sendEmailViaGmail } = await import('@/lib/integrations/gmail-service');
      
      await sendEmailViaGmail({
        to: prospect.email,
        from: fromEmail,
        subject:(step.subject !== '' && step.subject != null) ? step.subject : 'Follow-up',
        body: step.body,
        organizationId,
        metadata: {
          enrollmentId: enrollment.id,
          stepId: step.id,
          prospectId: enrollment.prospectId,
        },
      });

      logger.info('Sequence Engine Email sent via Gmail to prospect.email}', { file: 'sequence-engine.ts' });
      return;
    } catch (gmailError) {
      const gmailErrorMessage = gmailError instanceof Error ? gmailError.message : 'Unknown Gmail error';
      logger.warn('[Sequence Engine] Gmail send failed, trying fallback', { error: gmailErrorMessage, file: 'sequence-engine.ts' });
      
      // Fallback to SendGrid if Gmail fails
      if (emailProvider === 'sendgrid') {
        const { getAPIKey } = await import('@/lib/config/api-keys');
        const sendgridKey = await getAPIKey(organizationId, 'sendgrid');
        
        if (!sendgridKey) {
          throw new Error('Gmail failed and SendGrid not configured. Cannot send email.');
        }

        const { sendEmail } = await import('@/lib/email/sendgrid-service');
        const result = await sendEmail({
          to: prospect.email,
          subject: (step.subject !== '' && step.subject != null) 
            ? step.subject 
            : 'Follow-up',
          html: step.body,
          tracking: {
            trackOpens: true,
            trackClicks: true,
          },
          metadata: {
            enrollmentId: enrollment.id,
            stepId: step.id,
            organizationId,
            prospectId: enrollment.prospectId,
          },
        }, sendgridKey);

        if (!result.success) {
          throw new Error((result.error !== '' && result.error != null) 
            ? result.error 
            : 'Failed to send email via SendGrid');
        }

        logger.info('Sequence Engine Email sent via SendGrid to prospect.email}', { file: 'sequence-engine.ts' });
      } else {
        throw gmailError;
      }
    }
  }

  /**
   * Send LinkedIn message
   */
  private static async sendLinkedInMessage(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    organizationId: string
  ): Promise<void> {
    
    
    // Get prospect details
    const prospect: ProspectData | null = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/prospects`,
      enrollment.prospectId
    );

    if (!prospect) {
      throw new Error(`Prospect ${enrollment.prospectId} not found`);
    }

    // Get LinkedIn integration credentials
    const integrations: IntegrationData[] = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`
    );
    const integration = integrations.filter((i) => i.service === 'linkedin');

    if (!integration || integration.length === 0) {
      throw new Error('LinkedIn integration not configured');
    }

    const linkedInToken = integration[0].accessToken ?? '';

    // Send LinkedIn message via RapidAPI or LinkedIn API
    const { sendLinkedInMessage } = await import('@/lib/integrations/linkedin-messaging');

    await sendLinkedInMessage(
      linkedInToken,
      prospect.linkedInUrl ?? prospect.email ?? '',
      step.content ?? '',
      organizationId
    );
    
    // Track step execution
    await this.trackStepExecution(enrollment.id, step.id, organizationId, 'success');
  }

  /**
   * Send SMS
   */
  private static async sendSMS(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    organizationId: string
  ): Promise<void> {
    
    
    // Get prospect details
    const prospect: ProspectData | null = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/prospects`,
      enrollment.prospectId
    );

    if (!prospect?.phone) {
      throw new Error(`Prospect ${enrollment.prospectId} has no phone number`);
    }
    
    // Send SMS via Twilio
    const { sendSMS } = await import('@/lib/sms/sms-service');
    
    const result = await sendSMS({
      to: prospect.phone,
      message: step.content ?? '',
      organizationId,
    });
    
    if (!result.success) {
      throw new Error((result.error !== '' && result.error != null) 
        ? result.error 
        : 'Failed to send SMS');
    }
    
    // Save SMS record with Twilio message ID for webhook tracking
    const smsRecordId = result.messageId ?? `${Date.now()}-${enrollment.prospectId}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/smsMessages`,
      smsRecordId,
      {
        id: smsRecordId,
        messageId: result.messageId, // Twilio SID for webhook matching
        prospectId: enrollment.prospectId,
        sequenceId: enrollment.sequenceId,
        enrollmentId: enrollment.id,
        stepId: step.id,
        to: prospect.phone,
        message: step.content,
        status: 'sent',
        sentAt: new Date().toISOString(),
        provider: (result.provider !== '' && result.provider != null) 
          ? result.provider 
          : 'twilio',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    
    // Track step execution
    await this.trackStepExecution(enrollment.id, step.id, organizationId, 'success');
  }

  /**
   * Create task
   */
  private static async createTask(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    organizationId: string
  ): Promise<void> {
    
    
    // Get prospect details
    const prospect: ProspectData | null = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/prospects`,
      enrollment.prospectId
    );

    if (!prospect) {
      throw new Error(`Prospect ${enrollment.prospectId} not found`);
    }

    // Calculate task due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (step.taskDueDays ?? 1));
    
    // Create task in CRM
    const taskId = `task-${Date.now()}-${enrollment.prospectId}`;
    const task = {
      id: taskId,
      organizationId,
      title: (step.taskTitle !== '' && step.taskTitle != null)
        ? step.taskTitle
        : `Follow up with ${prospect.name}`,
      description: step.content ?? `Automated task from sequence: ${enrollment.sequenceId}`,
      type: 'follow-up',
      status: 'pending',
      priority: step.taskPriority ?? 'medium',
      dueDate,
      relatedTo: {
        type: 'prospect',
        id: enrollment.prospectId,
        name: prospect.name,
      },
      sequenceId: enrollment.sequenceId,
      stepId: step.id,
      assignedTo: (step.taskAssignee !== '' && step.taskAssignee != null) 
        ? step.taskAssignee 
        : 'unassigned',
      createdBy: 'sequence-engine',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/tasks`,
      taskId,
      task
    );
    
    // Track step execution
    await this.trackStepExecution(enrollment.id, step.id, organizationId, 'success');
  }
  
  /**
   * Track step execution for analytics
   */
  private static async trackStepExecution(
    enrollmentId: string,
    stepId: string,
    organizationId: string,
    status: 'success' | 'failed' | 'skipped',
    error?: string
  ): Promise<void> {
    try {
      const analyticsId = `${enrollmentId}-${stepId}-${Date.now()}`;
      
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequenceAnalytics`,
        analyticsId,
        {
          enrollmentId,
          stepId,
          status,
          error,
          executedAt: new Date(),
          createdAt: new Date(),
        }
      );
      
      // Update step statistics
      const statsId = `step-${stepId}`;
      const currentStats: StepStats | null = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequenceStepStats`,
        statsId
      );

      const stats: StepStats = currentStats ?? {
        totalExecutions: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
      };

      stats.totalExecutions = (stats.totalExecutions ?? 0) + 1;
      if (status === 'success') {stats.successCount = (stats.successCount ?? 0) + 1;}
      if (status === 'failed') {stats.failedCount = (stats.failedCount ?? 0) + 1;}
      if (status === 'skipped') {stats.skippedCount = (stats.skippedCount ?? 0) + 1;}
      stats.successRate = (stats.successCount / stats.totalExecutions) * 100;
      stats.updatedAt = new Date();
      
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequenceStepStats`,
        statsId,
        stats
      );
    } catch (error) {
      logger.error('[Sequence Engine] Error tracking step execution:', error, { file: 'sequence-engine.ts' });
      // Don't throw - analytics failure shouldn't stop execution
    }
  }

  /**
   * Calculate when next step should execute
   */
  private static calculateNextStepTime(
    step: SequenceStep,
    fromDate: Date = new Date()
  ): string {
    const nextTime = new Date(fromDate);
    nextTime.setDate(nextTime.getDate() + (step.delayDays ?? 0));
    
    if (step.delayHours !== null && step.delayHours !== undefined) {
      nextTime.setHours(nextTime.getHours() + step.delayHours);
    }

    // Apply send time if specified
    if (step.sendTime) {
      nextTime.setHours(step.sendTime.hour, step.sendTime.minute, 0, 0);
    }

    return nextTime.toISOString();
  }

  /**
   * Check if step conditions are met
   */
  private static checkStepConditions(
    enrollment: ProspectEnrollment,
    step: SequenceStep
  ): boolean {
    if (!step.conditions || step.conditions.length === 0) {
      return true; // No conditions, always proceed
    }

    for (const condition of step.conditions) {
      switch (condition.type) {
        case 'opened_previous': {
          const previousOpened = enrollment.stepActions.some(
            a => a.stepOrder === step.order - 1 && a.openedAt
          );
          if (!previousOpened) {return false;}
          break;
        }

        case 'not_opened_previous': {
          const previousNotOpened = !enrollment.stepActions.some(
            a => a.stepOrder === step.order - 1 && a.openedAt
          );
          if (!previousNotOpened) {return false;}
          break;
        }

        case 'replied': {
          const hasReplied = enrollment.stepActions.some(a => a.repliedAt);
          if (!hasReplied) {return false;}
          break;
        }

        case 'not_replied': {
          const hasNotReplied = !enrollment.stepActions.some(a => a.repliedAt);
          if (!hasNotReplied) {return false;}
          break;
        }
      }
    }

    return true;
  }

  /**
   * Skip a step
   */
  private static async skipStep(
    enrollment: ProspectEnrollment,
    step: SequenceStep,
    _organizationId: string
  ): Promise<void> {
    const skippedAction: StepAction = {
      stepId: step.id,
      stepOrder: step.order,
      scheduledFor:enrollment.nextStepAt ?? new Date().toISOString(),
      status: 'skipped',
      createdAt: new Date().toISOString(),
    };

    enrollment.stepActions.push(skippedAction);
    enrollment.currentStep += 1;
    enrollment.updatedAt = new Date().toISOString();

    await this.saveEnrollment(enrollment);
  }

  /**
   * Complete enrollment
   */
  private static async completeEnrollment(
    enrollment: ProspectEnrollment,
    organizationId: string
  ): Promise<void> {
    enrollment.status = 'completed';
    enrollment.outcome = 'completed';
    enrollment.completedAt = new Date().toISOString();
    enrollment.outcomeDate = new Date().toISOString();
    enrollment.updatedAt = new Date().toISOString();

    await this.saveEnrollment(enrollment);

    await this.updateSequenceAnalytics(enrollment.sequenceId, organizationId, {
      activeProspects: -1,
      completedProspects: 1,
    });
  }

  /**
   * Get sequence from Firestore
   */
  private static async getSequence(
    sequenceId: string,
    organizationId: string
  ): Promise<OutboundSequence | null> {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequences`,
      sequenceId
    );
  }

  /**
   * Get enrollment
   */
  private static async getEnrollment(
    prospectId: string,
    sequenceId: string,
    organizationId: string
  ): Promise<ProspectEnrollment | null> {
    try {
      const { where, limit } = await import('firebase/firestore');
      
      const enrollments = await FirestoreService.getAll<ProspectEnrollment>(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
        [
          where('prospectId', '==', prospectId),
          where('sequenceId', '==', sequenceId),
          limit(1)
        ]
      );
      
      return enrollments.length > 0 ? enrollments[0] : null;
    } catch (error) {
      logger.error('[SequenceEngine] Error getting enrollment:', error, { file: 'sequence-engine.ts' });
    return null;
    }
  }

  /**
   * Get enrollment by ID
   */
  private static async getEnrollmentById(
    enrollmentId: string,
    organizationId: string
  ): Promise<ProspectEnrollment | null> {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
      enrollmentId
    );
  }

  /**
   * Save enrollment
   */
  private static async saveEnrollment(enrollment: ProspectEnrollment): Promise<void> {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${enrollment.organizationId}/enrollments`,
      enrollment.id,
      enrollment,
      false
    );
  }

  /**
   * Update sequence analytics
   */
  private static async updateSequenceAnalytics(
    sequenceId: string,
    organizationId: string,
    updates: Partial<OutboundSequence['analytics']>
  ): Promise<void> {
    const sequence = await this.getSequence(sequenceId, organizationId);
    if (!sequence) {return;}

    // Increment analytics
    if (updates && sequence.analytics) {
      const analytics = sequence.analytics as Record<string, number | undefined>;
      Object.keys(updates).forEach((key) => {
        const value = updates[key as keyof typeof updates];
        if (typeof value === 'number') {
          analytics[key] = (analytics[key] ?? 0) + value;
        }
      });

      // Recalculate rates
      const totalSent = sequence.analytics.totalSent ?? 0;
      const totalDelivered = sequence.analytics.totalDelivered ?? 0;
      const totalEnrolled = sequence.analytics.totalEnrolled ?? 0;
      
      sequence.analytics.deliveryRate = totalSent > 0
        ? ((totalDelivered / totalSent) * 100)
        : 0;

      sequence.analytics.openRate = totalDelivered > 0
        ? (((sequence.analytics.totalOpened ?? 0) / totalDelivered) * 100)
        : 0;

      sequence.analytics.clickRate = totalDelivered > 0
        ? (((sequence.analytics.totalClicked ?? 0) / totalDelivered) * 100)
        : 0;

      sequence.analytics.replyRate = totalDelivered > 0
        ? (((sequence.analytics.totalReplied ?? 0) / totalDelivered) * 100)
        : 0;

      sequence.analytics.conversionRate = totalEnrolled > 0
        ? (((sequence.analytics.meetingsBooked ?? 0) / totalEnrolled) * 100)
        : 0;

      sequence.analytics.lastRun = new Date().toISOString();
    }

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/sequences`,
      sequenceId,
      sequence,
      false
    );
  }

  /**
   * Update step analytics
   */
  private static async updateStepAnalytics(
    stepId: string,
    organizationId: string,
    updates: Partial<SequenceStep>
  ): Promise<void> {
    try {
      // Find the sequence that contains this step
      const sequencesPath = `organizations/${organizationId}/sequences`;
      const sequences = await FirestoreService.getAll<OutboundSequence>(sequencesPath);
      
      let targetSequence: OutboundSequence | null = null;
      let targetStepIndex = -1;
      
      for (const sequence of sequences) {
        const stepIndex = sequence.steps.findIndex(s => s.id === stepId);
        if (stepIndex !== -1) {
          targetSequence = sequence;
          targetStepIndex = stepIndex;
          break;
        }
      }
      
      if (!targetSequence || targetStepIndex === -1) {
        logger.warn('Step not found for analytics update', { stepId, organizationId });
        return;
      }
      
      // Get the current step
      const step = targetSequence.steps[targetStepIndex];
      
      // Update analytics fields with increments
      const updatedStep = {
        ...step,
        sent: (step.sent ?? 0) + (updates.sent ?? 0),
        delivered: (step.delivered ?? 0) + (updates.delivered ?? 0),
        opened: (step.opened ?? 0) + (updates.opened ?? 0),
        clicked: (step.clicked ?? 0) + (updates.clicked ?? 0),
        replied: (step.replied ?? 0) + (updates.replied ?? 0),
        updatedAt: new Date().toISOString(),
      };
      
      // Update the step in the sequence
      targetSequence.steps[targetStepIndex] = updatedStep;
      
      // Save the updated sequence
      const sequencePath = `organizations/${organizationId}/sequences`;
      await FirestoreService.update(sequencePath, targetSequence.id, {
        steps: targetSequence.steps,
        updatedAt: new Date().toISOString(),
      });
      
      logger.info('Step analytics updated', {
        stepId,
        organizationId,
        updates,
        newValues: {
          sent: updatedStep.sent,
          delivered: updatedStep.delivered,
          opened: updatedStep.opened,
          clicked: updatedStep.clicked,
          replied: updatedStep.replied,
        },
      });
    } catch (error) {
      logger.error('Failed to update step analytics', error as Error, {
        stepId,
        organizationId,
        updates,
      });
      // Don't throw - analytics updates shouldn't break the main flow
    }
  }

  /**
   * Schedule a step for execution
   */
  private static async scheduleStep(
    _enrollment: ProspectEnrollment,
    _step: SequenceStep
  ): Promise<void> {
    // In production, this would add to a job queue
    await Promise.resolve();
  }
}

