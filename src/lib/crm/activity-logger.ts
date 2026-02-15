/**
 * Activity Logger
 * Helper functions to auto-log activities from various sources
 * Call these from AI agents, email sequences, workflows, etc.
 */

import { Timestamp } from 'firebase/firestore';
import { createActivity } from './activity-service';
import type { CreateActivityInput, RelatedEntityType } from '@/types/activity';
import { logger } from '@/lib/logger/logger';

/**
 * Converts unknown values to string representation for metadata
 */
function toMetadataString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Log AI chat conversation
 */
export async function logAIChat(params: {
    conversationId: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  messageCount: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  intent?: string;
  summary?: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'ai_chat',
      direction: 'inbound',
      subject: `AI Conversation (${params.messageCount} messages)`,
      summary: params.summary ?? `Customer had ${params.messageCount} message conversation with AI agent`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName ?? 'AI Agent',
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        conversationId: params.conversationId,
        messageCount: params.messageCount,
        sentiment: params.sentiment,
        sentimentScore: params.sentimentScore,
        intent: params.intent,
      },
    };

    await createActivity(activityData);

    logger.info('AI chat activity logged', { conversationId: params.conversationId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log AI chat activity', err);
  }
}

/**
 * Log email sent
 */
export async function logEmailSent(params: {
    emailId: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  fromEmail: string;
  toEmail: string;
  ccEmails?: string[];
  subject: string;
  body?: string;
  userId?: string;
  userName?: string;
  sequenceId?: string;
  sequenceName?: string;
  sequenceStep?: number;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'email_sent',
      direction: 'outbound',
      subject: params.subject,
      body: params.body,
      summary: `Email sent: ${params.subject}`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        emailId: params.emailId,
        fromEmail: params.fromEmail,
        toEmail: params.toEmail,
        ccEmails: params.ccEmails,
        opens: 0,
        clicks: 0,
        sequenceId: params.sequenceId,
        sequenceName: params.sequenceName,
        sequenceStep: params.sequenceStep,
      },
    };

    await createActivity(activityData);

    logger.info('Email sent activity logged', { emailId: params.emailId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log email sent activity', err);
  }
}

/**
 * Log email opened
 */
export async function logEmailOpened(params: {
    emailId: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  subject: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'email_opened',
      direction: 'inbound',
      subject: `Opened: ${params.subject}`,
      summary: `Email was opened`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
      }],
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        emailId: params.emailId,
      },
    };

    await createActivity(activityData);

    logger.info('Email opened activity logged', { emailId: params.emailId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log email opened activity', err);
  }
}

/**
 * Log call made/received
 */
export async function logCall(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  direction: 'inbound' | 'outbound';
  duration: number; // seconds
  outcome: 'connected' | 'voicemail' | 'no_answer' | 'busy';
  notes?: string;
  recordingUrl?: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: params.direction === 'outbound' ? 'call_made' : 'call_received',
      direction: params.direction,
      subject: `Call ${params.outcome} (${Math.floor(params.duration / 60)}m ${params.duration % 60}s)`,
      summary: params.notes,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        callDuration: params.duration,
        callOutcome: params.outcome,
        callNotes: params.notes,
        callRecordingUrl: params.recordingUrl,
      },
    };

    await createActivity(activityData);

    logger.info('Call activity logged', { outcome: params.outcome, duration: params.duration });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log call activity', err);
  }
}

/**
 * Log meeting
 */
export async function logMeeting(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  meetingType: 'scheduled' | 'completed' | 'no_show';
  subject: string;
  duration?: number; // minutes
  attendees?: string[];
  notes?: string;
  meetingUrl?: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const type =
      params.meetingType === 'scheduled' ? 'meeting_scheduled' :
      params.meetingType === 'no_show' ? 'meeting_no_show' :
      'meeting_completed';

    const activityData: CreateActivityInput = {
      type,
      direction: 'internal',
      subject: params.subject,
      summary: params.notes,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        meetingDuration: params.duration,
        meetingAttendees: params.attendees,
        meetingUrl: params.meetingUrl,
        meetingOutcome: params.meetingType === 'scheduled' ? undefined : params.meetingType,
      },
    };

    await createActivity(activityData);

    logger.info('Meeting activity logged', { type: params.meetingType });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log meeting activity', err);
  }
}

/**
 * Log status/stage change
 */
export async function logStatusChange(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  fieldChanged: string;
  previousValue: unknown;
  newValue: unknown;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const type =
      params.relatedEntityType === 'deal' ? 'deal_stage_changed' :
      params.relatedEntityType === 'lead' ? 'lead_status_changed' :
      'field_updated';

    const previousValueStr = toMetadataString(params.previousValue);
    const newValueStr = toMetadataString(params.newValue);

    const activityData: CreateActivityInput = {
      type,
      direction: 'internal',
      subject: `${params.fieldChanged}: ${previousValueStr} → ${newValueStr}`,
      summary: `Updated ${params.fieldChanged} from "${previousValueStr}" to "${newValueStr}"`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        fieldChanged: params.fieldChanged,
        previousValue: previousValueStr,
        newValue: newValueStr,
      },
    };

    await createActivity(activityData);

    logger.info('Status change activity logged', { field: params.fieldChanged });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log status change activity', err);
  }
}

/**
 * Log workflow execution
 */
export async function logWorkflow(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  workflowId: string;
  workflowName: string;
  summary?: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'workflow_triggered',
      direction: 'internal',
      subject: `Workflow: ${params.workflowName}`,
      summary: params.summary ?? `Workflow "${params.workflowName}" was executed`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdByName: 'System',
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        workflowId: params.workflowId,
        workflowName: params.workflowName,
      },
    };

    await createActivity(activityData);

    logger.info('Workflow activity logged', { workflowId: params.workflowId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log workflow activity', err);
  }
}

/**
 * Log sequence enrollment/unenrollment
 */
export async function logSequenceChange(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  action: 'enrolled' | 'unenrolled';
  sequenceId: string;
  sequenceName: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: params.action === 'enrolled' ? 'sequence_enrolled' : 'sequence_unenrolled',
      direction: 'internal',
      subject: `${params.action === 'enrolled' ? 'Enrolled in' : 'Unenrolled from'} sequence: ${params.sequenceName}`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
      metadata: {
        sequenceId: params.sequenceId,
        sequenceName: params.sequenceName,
      },
    };

    await createActivity(activityData);

    logger.info('Sequence change activity logged', { action: params.action, sequenceId: params.sequenceId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log sequence change activity', err);
  }
}

/**
 * Log note added
 */
export async function logNote(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  subject?: string;
  body: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'note_added',
      direction: 'internal',
      subject: params.subject ?? 'Note added',
      body: params.body,
      summary: params.body.substring(0, 200),
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdBy: params.userId,
      createdByName: params.userName,
      occurredAt: Timestamp.fromDate(new Date()),
    };

    await createActivity(activityData);

    logger.info('Note activity logged');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log note activity', err);
  }
}

/**
 * Log enrichment completed
 */
export async function logEnrichment(params: {
    relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  dataPointsFound: number;
}): Promise<void> {
  try {
    const activityData: CreateActivityInput = {
      type: 'enrichment_completed',
      direction: 'internal',
      subject: `Data enrichment completed`,
      summary: `Found ${params.dataPointsFound} additional data points`,
      relatedTo: [{
        entityType: params.relatedEntityType,
        entityId: params.relatedEntityId,
        entityName: params.relatedEntityName,
      }],
      createdByName: 'System',
      occurredAt: Timestamp.fromDate(new Date()),
    };

    await createActivity(activityData);

    logger.info('Enrichment activity logged', { dataPoints: params.dataPointsFound });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to log enrichment activity', err);
  }
}

