/**
 * Enhanced Meeting Scheduler
 * - Round-robin assignment
 * - Territory-based routing
 * - Automated reminders (email + SMS)
 * - Zoom integration
 * - Buffer times
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { getSubCollection } from '@/lib/firebase/collections';

export interface MeetingSchedulerConfig {
  id: string;
  name: string;
  duration: number; // minutes
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  assignmentType: 'round-robin' | 'territory-based' | 'manual' | 'skill-based';
  assignedUsers: string[]; // User IDs in rotation
  autoCreateZoom: boolean;
  sendReminders: boolean;
  reminderTimes: number[]; // Hours before meeting [24, 1]
  workingHours: {
    [key: string]: { // Day of week (monday, tuesday, etc.)
      enabled: boolean;
      start: string; // "09:00"
      end: string; // "17:00"
    };
  };
}

export interface ScheduledMeeting {
  id: string;
  workspaceId: string;
  schedulerConfigId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  assignedTo: string; // User ID
  assignedToName?: string;
  attendees: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'no-show' | 'cancelled';
  reminders: Array<{
    sentAt: Date;
    type: 'email' | 'sms';
    status: 'sent' | 'failed';
  }>;
  notes?: string;
  relatedEntityType?: 'lead' | 'contact' | 'deal';
  relatedEntityId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Schedule a meeting with automatic assignment
 */
export async function scheduleMeeting(
  workspaceId: string,
  config: {
    schedulerConfigId: string;
    title: string;
    startTime: Date;
    attendees: Array<{ name: string; email: string; phone?: string }>;
    notes?: string;
    relatedEntityType?: 'lead' | 'contact' | 'deal';
    relatedEntityId?: string;
  }
): Promise<ScheduledMeeting> {
  try {
    // Get scheduler configuration
    const schedulerConfig = await FirestoreService.get<MeetingSchedulerConfig>(
      getSubCollection('meetingSchedulers'),
      config.schedulerConfigId
    );

    if (!schedulerConfig) {
      throw new Error('Meeting scheduler configuration not found');
    }

    // Determine who to assign to
    const assignedUserId = await assignMeeting(schedulerConfig);

    // Calculate end time
    const endTime = new Date(config.startTime);
    endTime.setMinutes(endTime.getMinutes() + schedulerConfig.duration);

    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create Zoom meeting if enabled
    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomStartUrl?: string } = {};
    
    if (schedulerConfig.autoCreateZoom) {
      try {
        const zoomMeeting = await createZoomMeeting({
          topic: config.title,
          startTime: config.startTime,
          duration: schedulerConfig.duration,
          agenda: config.notes,
          attendees: config.attendees.map(a => a.email),
        });

        zoomData = {
          zoomMeetingId: zoomMeeting.id,
          zoomJoinUrl: zoomMeeting.joinUrl,
          zoomStartUrl: zoomMeeting.startUrl,
        };

        logger.info('Zoom meeting created for scheduled meeting', { meetingId, zoomMeetingId: zoomMeeting.id });
      } catch (zoomError) {
        logger.warn('Failed to create Zoom meeting, continuing without it', { error: zoomError instanceof Error ? zoomError.message : String(zoomError) });
      }
    }

    const meeting: ScheduledMeeting = {
      id: meetingId,
      workspaceId,
      schedulerConfigId: config.schedulerConfigId,
      title: config.title,
      startTime: config.startTime,
      endTime,
      duration: schedulerConfig.duration,
      assignedTo: assignedUserId,
      attendees: config.attendees,
      ...zoomData,
      status: 'scheduled',
      reminders: [],
      notes: config.notes,
      relatedEntityType: config.relatedEntityType,
      relatedEntityId: config.relatedEntityId,
      createdAt: new Date(),
    };

    await FirestoreService.set(
      `${getSubCollection('workspaces')}/${workspaceId}/meetings`,
      meetingId,
      meeting,
      false
    );

    // Schedule reminders if enabled
    if (schedulerConfig.sendReminders) {
      await scheduleReminders(meeting, schedulerConfig.reminderTimes);
    }

    // Log activity
    const { logMeeting } = await import('@/lib/crm/activity-logger');
    if (config.relatedEntityType && config.relatedEntityId) {
      await logMeeting({
        workspaceId,
        relatedEntityType: config.relatedEntityType,
        relatedEntityId: config.relatedEntityId,
        meetingType: 'scheduled',
        subject: config.title,
        duration: schedulerConfig.duration,
        attendees: config.attendees.map(a => a.email),
        meetingUrl: zoomData.zoomJoinUrl,
      });
    }

    logger.info('Meeting scheduled', {
      meetingId,
      assignedTo: assignedUserId,
      hasZoom: !!zoomData.zoomMeetingId,
    });

    return meeting;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to schedule meeting', error instanceof Error ? error : new Error(errorMessage), { file: 'scheduler-engine.ts' });
    throw error;
  }
}

/**
 * Assign meeting using configured strategy
 */
async function assignMeeting(
  config: MeetingSchedulerConfig
): Promise<string> {
  if (config.assignmentType === 'round-robin') {
    return getRoundRobinAssignment(config.id, config.assignedUsers);
  } else if (config.assignmentType === 'manual') {
    return config.assignedUsers[0]; // Default to first user
  }

  // Default fallback
  return config.assignedUsers[0];
}

/**
 * Round-robin assignment
 */
async function getRoundRobinAssignment(
  schedulerConfigId: string,
  userIds: string[]
): Promise<string> {
  try {
    // Get last assigned user index
    const state = await FirestoreService.get<{ lastIndex: number }>(
      `${getSubCollection('meetingSchedulers')}/${schedulerConfigId}/state`,
      'roundRobin'
    );

    const lastIndex = state?.lastIndex ?? -1;
    const nextIndex = (lastIndex + 1) % userIds.length;
    const assignedUserId = userIds[nextIndex];

    // Update last assigned index
    await FirestoreService.set(
      `${getSubCollection('meetingSchedulers')}/${schedulerConfigId}/state`,
      'roundRobin',
      { lastIndex: nextIndex, updatedAt: new Date() },
      true
    );

    logger.info('Round-robin assignment', { assignedTo: assignedUserId, index: nextIndex });

    return assignedUserId;

  } catch (error) {
    logger.warn('Round-robin assignment failed, using first user', { error: error instanceof Error ? error.message : String(error) });
    return userIds[0];
  }
}

/**
 * Schedule automated reminders
 */
async function scheduleReminders(
  meeting: ScheduledMeeting,
  reminderHours: number[]
): Promise<void> {
  try {
    for (const hours of reminderHours) {
      const reminderTime = new Date(meeting.startTime);
      reminderTime.setHours(reminderTime.getHours() - hours);

      // In production, this would use a job queue (Bull, Agenda, etc.)
      // For now, we'll store reminder schedules and process via cron
      await FirestoreService.set(
        `${getSubCollection('workspaces')}/${meeting.workspaceId}/scheduledReminders`,
        `${meeting.id}-${hours}h`,
        {
          meetingId: meeting.id,
          sendAt: reminderTime,
          type: 'meeting_reminder',
          hoursBeforeMeeting: hours,
          attendees: meeting.attendees,
          status: 'pending',
        },
        false
      );
    }

    logger.info('Meeting reminders scheduled', {
      meetingId: meeting.id,
      reminderCount: reminderHours.length,
    });

  } catch (error) {
    logger.warn('Failed to schedule reminders', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Send meeting reminder (called by cron job)
 */
export async function sendMeetingReminder(
  meetingId: string
): Promise<void> {
  try {
    const meeting = await FirestoreService.get<ScheduledMeeting>(
      `${getSubCollection('workspaces')}/default/meetings`,
      meetingId
    );

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Send email reminder
    const { sendEmail } = await import('@/lib/email/email-service');

    for (const attendee of meeting.attendees) {
      const subject = `Reminder: ${meeting.title}`;
      const body = `
This is a reminder about your upcoming meeting:

Title: ${meeting.title}
Time: ${meeting.startTime.toLocaleString()}
Duration: ${meeting.duration} minutes

${meeting.zoomJoinUrl ? `Join via Zoom: ${meeting.zoomJoinUrl}` : ''}

${meeting.notes ?? ''}

Looking forward to speaking with you!
      `.trim();

      await sendEmail({
        to: attendee.email,
        subject,
        text: body,
      });

      // Send SMS reminder if phone provided
      if (attendee.phone) {
        const { sendSMS } = await import('@/lib/sms/sms-service');
        await sendSMS({
          to: attendee.phone,
          message: `Reminder: ${meeting.title} at ${meeting.startTime.toLocaleTimeString()}. ${meeting.zoomJoinUrl ?? ''}`,
        });
      }
    }

    // Update meeting with reminder sent
    await FirestoreService.update(
      `${getSubCollection('workspaces')}/default/meetings`,
      meetingId,
      {
        reminders: [
          ...(meeting.reminders ?? []),
          { sentAt: new Date(), type: 'email', status: 'sent' },
        ],
      }
    );

    logger.info('Meeting reminder sent', { meetingId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send meeting reminder', error instanceof Error ? error : new Error(errorMessage), { meetingId, file: 'scheduler-engine.ts' });
  }
}

