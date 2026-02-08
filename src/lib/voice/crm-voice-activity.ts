/**
 * CRM Voice Activity Logger
 * Logs all voice interactions to CRM records
 * Bi-directional sync with contact/lead/deal records
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { VoiceCall, SMSMessage, CallStatus, SMSStatus } from './types';

export interface VoiceActivity {
  id: string;
  callId: string;
  type: 'call' | 'sms' | 'voicemail' | 'transfer' | 'recording';
  direction: 'inbound' | 'outbound';
  status: CallStatus | SMSStatus;
  from: string;
  to: string;
  duration?: number;
  recordingUrl?: string;
  transcription?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  outcome?: string;
  notes?: string;
  userId?: string;
  userName?: string;
  aiAgentId?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
  companyId?: string;
  timestamp: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ActivitySearchParams {
  contactId?: string;
  leadId?: string;
  dealId?: string;
  type?: VoiceActivity['type'];
  direction?: 'inbound' | 'outbound';
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  avgCallDuration: number;
  totalSMS: number;
  voicemails: number;
  transferredCalls: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

class CRMVoiceActivityLogger {
  /**
   * Log a voice call activity
   */
  async logCall(
    call: VoiceCall,
    options?: {
      userId?: string;
      userName?: string;
      aiAgentId?: string;
      contactId?: string;
      leadId?: string;
      dealId?: string;
      outcome?: string;
      notes?: string;
      transcription?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }
  ): Promise<VoiceActivity | null> {
    try {
      // Auto-detect associated CRM records if not provided
      let { contactId, leadId, dealId } = options ?? {};
      if (!contactId && !leadId) {
        const associated = await this.findAssociatedRecords(call.from, call.to);
        contactId = associated.contactId ?? contactId;
        leadId = associated.leadId ?? leadId;
        dealId = associated.dealId ?? dealId;
      }

      const activity: Omit<VoiceActivity, 'id'> = {
        callId: call.callId,
        type: 'call',
        direction: call.direction,
        status: call.status,
        from: call.from,
        to: call.to,
        duration: call.duration,
        recordingUrl: call.recordingUrl,
        transcription: options?.transcription,
        sentiment: options?.sentiment,
        outcome: options?.outcome,
        notes: options?.notes,
        userId: options?.userId,
        userName: options?.userName,
        aiAgentId: options?.aiAgentId,
        contactId,
        leadId,
        dealId,
        timestamp: call.startTime ?? new Date(),
        endedAt: call.endTime,
        metadata: call.metadata,
      };

      const response = await fetch('/api/crm/voice-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });

      if (!response.ok) {
        throw new Error('Failed to log call activity');
      }

      const data = await response.json() as { id: string };

      // Update associated records with last contacted timestamp
      await this.updateLastContacted({ contactId, leadId, dealId });

      // Trigger workflow if applicable
      await this.triggerWorkflow('call.completed', {
        ...activity,
        id: data.id,
      });

      return { id: data.id, ...activity };
    } catch (error) {
      logger.error('[CRMVoiceActivity] Log call failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return null;
    }
  }

  /**
   * Log an SMS activity
   */
  async logSMS(
    message: SMSMessage,
    options?: {
      userId?: string;
      userName?: string;
      contactId?: string;
      leadId?: string;
      dealId?: string;
    }
  ): Promise<VoiceActivity | null> {
    try {
      let { contactId, leadId, dealId } = options ?? {};
      if (!contactId && !leadId) {
        const associated = await this.findAssociatedRecords(message.from, message.to);
        contactId = associated.contactId ?? contactId;
        leadId = associated.leadId ?? leadId;
        dealId = associated.dealId ?? dealId;
      }

      const activity: Omit<VoiceActivity, 'id'> = {
        callId: message.messageId,
        type: 'sms',
        direction: message.direction,
        status: message.status,
        from: message.from,
        to: message.to,
        notes: message.body,
        userId: options?.userId,
        userName: options?.userName,
        contactId,
        leadId,
        dealId,
        timestamp: message.sentAt ?? new Date(),
      };

      const response = await fetch('/api/crm/voice-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });

      if (!response.ok) {
        throw new Error('Failed to log SMS activity');
      }

      const data = await response.json() as { id: string };

      await this.updateLastContacted({ contactId, leadId, dealId });

      await this.triggerWorkflow('sms.sent', {
        ...activity,
        id: data.id,
      });

      return { id: data.id, ...activity };
    } catch (error) {
      logger.error('[CRMVoiceActivity] Log SMS failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return null;
    }
  }

  /**
   * Log a voicemail activity
   */
  async logVoicemail(
    callId: string,
    options: {
      from: string;
      to: string;
      recordingUrl: string;
      transcription?: string;
      duration?: number;
      contactId?: string;
      leadId?: string;
    }
  ): Promise<VoiceActivity | null> {
    try {
      let { contactId, leadId } = options;
      if (!contactId && !leadId) {
        const associated = await this.findAssociatedRecords(options.from, options.to);
        contactId = associated.contactId ?? contactId;
        leadId = associated.leadId ?? leadId;
      }

      const activity: Omit<VoiceActivity, 'id'> = {
        callId,
        type: 'voicemail',
        direction: 'inbound',
        status: 'completed',
        from: options.from,
        to: options.to,
        duration: options.duration,
        recordingUrl: options.recordingUrl,
        transcription: options.transcription,
        contactId,
        leadId,
        timestamp: new Date(),
      };

      const response = await fetch('/api/crm/voice-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });

      if (!response.ok) {
        throw new Error('Failed to log voicemail activity');
      }

      const data = await response.json() as { id: string };

      await this.triggerWorkflow('voicemail.received', {
        ...activity,
        id: data.id,
      });

      return { id: data.id, ...activity };
    } catch (error) {
      logger.error('[CRMVoiceActivity] Log voicemail failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return null;
    }
  }

  /**
   * Update call activity with disposition
   */
  async updateCallDisposition(
    callId: string,
    disposition: {
      outcome: string;
      notes?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
      nextAction?: string;
      nextActionDate?: Date;
    }
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/crm/voice-activity/${callId}/disposition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...disposition,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update call disposition');
      }

      // Create follow-up task if next action specified
      if (disposition.nextAction && disposition.nextActionDate) {
        await this.createFollowUpTask(callId, disposition);
      }

      return true;
    } catch (error) {
      logger.error('[CRMVoiceActivity] Update disposition failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return false;
    }
  }

  /**
   * Get activities for a record
   */
  async getActivities(params: ActivitySearchParams): Promise<VoiceActivity[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params.contactId) {queryParams.set('contactId', params.contactId);}
      if (params.leadId) {queryParams.set('leadId', params.leadId);}
      if (params.dealId) {queryParams.set('dealId', params.dealId);}
      if (params.type) {queryParams.set('type', params.type);}
      if (params.direction) {queryParams.set('direction', params.direction);}
      if (params.dateFrom) {queryParams.set('dateFrom', params.dateFrom.toISOString());}
      if (params.dateTo) {queryParams.set('dateTo', params.dateTo.toISOString());}
      if (params.userId) {queryParams.set('userId', params.userId);}
      if (params.limit) {queryParams.set('limit', String(params.limit));}
      if (params.offset) {queryParams.set('offset', String(params.offset));}

      const response = await fetch(`/api/crm/voice-activity?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json() as { activities?: VoiceActivity[] };
      return data.activities ?? [];
    } catch (error) {
      logger.error('[CRMVoiceActivity] Get activities failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return [];
    }
  }

  /**
   * Get activity statistics
   */
  async getStats(
    params?: {
      dateFrom?: Date;
      dateTo?: Date;
      userId?: string;
      contactId?: string;
    }
  ): Promise<ActivityStats> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.dateFrom) {queryParams.set('dateFrom', params.dateFrom.toISOString());}
      if (params?.dateTo) {queryParams.set('dateTo', params.dateTo.toISOString());}
      if (params?.userId) {queryParams.set('userId', params.userId);}
      if (params?.contactId) {queryParams.set('contactId', params.contactId);}

      const response = await fetch(`/api/crm/voice-activity/stats?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch activity stats');
      }

      const data = await response.json() as { stats: ActivityStats };
      return data.stats;
    } catch (error) {
      logger.error('[CRMVoiceActivity] Get stats failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return {
        totalCalls: 0,
        totalDuration: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        missedCalls: 0,
        avgCallDuration: 0,
        totalSMS: 0,
        voicemails: 0,
        transferredCalls: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      };
    }
  }

  /**
   * Find associated CRM records by phone number
   */
  private async findAssociatedRecords(
    from: string,
    to: string
  ): Promise<{ contactId?: string; leadId?: string; dealId?: string; companyId?: string }> {
    try {
      const response = await fetch('/api/crm/lookup-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumbers: [from, to],
        }),
      });

      if (!response.ok) {
        return {};
      }

      const data = await response.json() as {
        contactId?: string;
        leadId?: string;
        dealId?: string;
        companyId?: string;
      };
      return {
        contactId: data.contactId,
        leadId: data.leadId,
        dealId: data.dealId,
        companyId: data.companyId,
      };
    } catch (error) {
      logger.error('[CRMVoiceActivity] Find associated records failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
      return {};
    }
  }

  /**
   * Update last contacted timestamp on associated records
   */
  private async updateLastContacted(
    records: { contactId?: string; leadId?: string; dealId?: string }
  ): Promise<void> {
    try {
      await fetch('/api/crm/update-last-contacted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...records,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('[CRMVoiceActivity] Update last contacted failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
    }
  }

  /**
   * Trigger workflow based on voice activity
   */
  private async triggerWorkflow(
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await fetch('/api/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data,
          source: 'voice',
        }),
      });
    } catch (error) {
      logger.error('[CRMVoiceActivity] Trigger workflow failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
    }
  }

  /**
   * Create follow-up task
   */
  private async createFollowUpTask(
    callId: string,
    disposition: {
      nextAction?: string;
      nextActionDate?: Date;
      notes?: string;
    }
  ): Promise<void> {
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: disposition.nextAction,
          description: `Follow-up from call ${callId}. Notes: ${disposition.notes ?? ''}`,
          dueDate: disposition.nextActionDate?.toISOString(),
          type: 'follow-up',
          relatedTo: { type: 'call', id: callId },
        }),
      });
    } catch (error) {
      logger.error('[CRMVoiceActivity] Create follow-up task failed:', error instanceof Error ? error : new Error(String(error)), { file: 'crm-voice-activity.ts' });
    }
  }
}

export const crmVoiceActivity = new CRMVoiceActivityLogger();
export default crmVoiceActivity;
