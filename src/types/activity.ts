/**
 * Activity Types & Schema
 * Tracks all interactions with leads, contacts, and deals
 */

import type { Timestamp } from 'firebase/firestore';

export type ActivityType = 
  | 'email_sent'
  | 'email_received'
  | 'email_opened'
  | 'email_clicked'
  | 'call_made'
  | 'call_received'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'meeting_no_show'
  | 'ai_chat'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'form_submitted'
  | 'website_visit'
  | 'document_viewed'
  | 'deal_stage_changed'
  | 'lead_status_changed'
  | 'field_updated'
  | 'enrichment_completed'
  | 'sequence_enrolled'
  | 'sequence_unenrolled'
  | 'workflow_triggered'
  | 'sms_sent'
  | 'sms_received';

export type ActivityDirection = 'inbound' | 'outbound' | 'internal';

export type RelatedEntityType = 'lead' | 'contact' | 'company' | 'deal' | 'opportunity';

export interface Activity {
  id: string;
  organizationId: string;
  workspaceId: string;
  
  // Activity details
  type: ActivityType;
  direction?: ActivityDirection;
  subject?: string;
  body?: string;
  summary?: string; // AI-generated summary for long activities
  
  // Related entities (polymorphic relations)
  relatedTo: Array<{
    entityType: RelatedEntityType;
    entityId: string;
    entityName?: string; // Denormalized for display
  }>;
  
  // Attribution
  createdBy?: string; // User ID who created/triggered
  createdByName?: string; // Denormalized
  assignedTo?: string; // User ID responsible
  assignedToName?: string;
  
  // Metadata by type
  metadata?: {
    // Email specific
    emailId?: string;
    fromEmail?: string;
    toEmail?: string;
    ccEmails?: string[];
    threadId?: string;
    opens?: number;
    clicks?: number;
    linkClicked?: string;
    
    // Call specific
    callDuration?: number; // seconds
    callRecordingUrl?: string;
    callOutcome?: 'connected' | 'voicemail' | 'no_answer' | 'busy';
    callNotes?: string;
    
    // Meeting specific
    meetingDuration?: number; // minutes
    meetingUrl?: string;
    meetingAttendees?: string[];
    meetingOutcome?: 'completed' | 'no_show' | 'rescheduled' | 'cancelled';
    
    // AI Chat specific
    conversationId?: string;
    messageCount?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentimentScore?: number;
    intent?: string;
    
    // Deal/Lead changes
    previousValue?: unknown;
    newValue?: unknown;
    fieldChanged?: string;
    
    // Document specific
    documentUrl?: string;
    documentName?: string;
    viewDuration?: number;
    
    // Website visit
    pageUrl?: string;
    pageTitle?: string;
    visitDuration?: number;
    
    // Task specific
    taskId?: string;
    taskDueDate?: string;
    taskPriority?: 'low' | 'normal' | 'high';
    
    // Sequence specific
    sequenceId?: string;
    sequenceName?: string;
    sequenceStep?: number;
    
    // Workflow specific
    workflowId?: string;
    workflowName?: string;
  };
  
  // Timestamps
  occurredAt: Timestamp; // Firestore Timestamp - when activity actually happened
  createdAt: Timestamp; // When record was created (might differ from occurredAt)
  
  // Display flags
  isPinned?: boolean;
  isImportant?: boolean;
  tags?: string[];
}

export interface ActivityFilters {
  entityType?: RelatedEntityType;
  entityId?: string;
  types?: ActivityType[];
  direction?: ActivityDirection;
  createdBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface ActivityStats {
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  lastActivityDate?: Date;
  mostCommonType?: ActivityType;
  avgActivitiesPerDay?: number;
  engagementScore?: number; // 0-100 based on frequency and recency
}

export interface ActivityInsight {
  type: 'warning' | 'info' | 'success';
  message: string;
  recommendation?: string;
  confidence?: number;
}

// Helper type for creating activities without ID/timestamps
export type CreateActivityInput = Omit<Activity, 'id' | 'createdAt' | 'organizationId' | 'workspaceId'>;

// Activity grouping for timeline display
export interface TimelineGroup {
  date: string; // YYYY-MM-DD
  activities: Activity[];
}

// Next best action based on activity history
export interface NextBestAction {
  action: 'send_email' | 'make_call' | 'schedule_meeting' | 'send_proposal' | 'follow_up' | 'escalate' | 'wait';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reasoning: string;
  suggestedDueDate?: Date;
  confidence: number; // 0-100
  basedOn: string[]; // Activity IDs that informed this recommendation
}

