/**
 * Outbound Sequence Types
 * Multi-step email sequences with automation
 */

export interface SequenceSettings {
  stopOnReply?: boolean;
  stopOnBounce?: boolean;
  stopOnBounc?: boolean; // Typo variant for backward compatibility
  stopOnUnsubscribe?: boolean;
  sendingWindow?: {
    enabled: boolean;
    timezone: string;
    days: number[]; // 0-6, where 0 is Sunday
    startHour: number;
    endHour: number;
  };
}

export interface OutboundSequence {
  id: string;
  organizationId: string;
  workspaceId?: string;
  
  // Metadata
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'draft' | 'archived';
  
  // Steps
  steps: SequenceStep[];
  
  // Enrollment
  enrollmentCriteria?: EnrollmentCriteria;
  autoEnroll?: boolean; // Auto-enroll new prospects
  
  // Behavior (individual flags - legacy)
  stopOnResponse?: boolean; // Pause sequence if prospect replies
  stopOnConversion?: boolean; // Stop if prospect converts (meeting booked, deal created)
  stopOnUnsubscribe?: boolean; // Remove if they unsubscribe
  stopOnBounce?: boolean; // Remove if email bounces
  
  // Settings (grouped settings - preferred)
  settings?: SequenceSettings;
  
  // Analytics
  analytics?: SequenceAnalytics;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  order: number; // 1, 2, 3, etc.
  
  // Timing
  delayDays: number; // Days to wait after previous step (or sequence start for step 1)
  delayHours?: number; // Additional hours delay
  sendTime?: SendTime; // Specific time to send (e.g., 9am in prospect's timezone)
  
  // Content
  type: 'email' | 'linkedin_message' | 'sms' | 'call_task' | 'manual_task';
  subject?: string; // For emails
  body: string;
  content?: string; // Alias for body (for backward compatibility)
  
  // Task-specific fields
  taskDueDays?: number;
  taskTitle?: string;
  taskPriority?: 'low' | 'medium' | 'high' | 'urgent';
  taskAssignee?: string;
  
  // Conditions (only send if...)
  conditions?: StepCondition[];
  
  // A/B Testing
  variants?: SequenceStepVariant[];
  
  // Analytics
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface SendTime {
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string; // IANA timezone or 'prospect' or 'organization'
}

export interface StepCondition {
  type: 'opened_previous' | 'clicked_previous' | 'not_opened_previous' | 'replied' | 'not_replied' | 'custom_field';
  value?: unknown;
}

export interface SequenceStepVariant {
  id: string;
  subject?: string;
  body: string;
  weight: number; // Percentage of prospects who get this variant (0-100)
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

export interface EnrollmentCriteria {
  // Lead filters
  status?: string[];
  source?: string[];
  industry?: string[];
  companySize?: { min?: number; max?: number };
  
  // Score filters
  minLeadScore?: number;
  maxLeadScore?: number;
  
  // Custom fields
  customFields?: Record<string, unknown>;
}

export interface SequenceAnalytics {
  // Enrollment
  totalEnrolled: number;
  activeProspects: number;
  completedProspects: number;
  
  // Engagement
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  totalUnsubscribed: number;
  
  // Conversions
  meetingsBooked: number;
  dealsCreated: number;
  revenue: number;
  
  // Rates
  deliveryRate: number; // delivered / sent
  openRate: number; // opened / delivered
  clickRate: number; // clicked / delivered
  replyRate: number; // replied / delivered
  conversionRate: number; // meetings / enrolled
  
  // Performance
  lastRun?: string;
  avgResponseTime?: number; // Average time to get a reply (hours)
}

export interface ProspectEnrollment {
  id: string;
  sequenceId: string;
  prospectId: string; // CRM contact/lead ID
  organizationId: string;
  
  // Status
  status: 'active' | 'completed' | 'paused' | 'removed' | 'bounced' | 'unsubscribed';
  currentStep: number;
  
  // Timeline
  enrolledAt: string;
  completedAt?: string;
  pausedAt?: string;
  nextStepAt?: string; // When next step should send
  
  // Actions
  stepActions: StepAction[];
  
  // Outcome
  outcome?: 'replied' | 'meeting_booked' | 'converted' | 'unsubscribed' | 'bounced' | 'completed' | 'removed';
  outcomeDate?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StepAction {
  stepId: string;
  stepOrder: number;
  
  // Execution
  scheduledFor: string;
  sentAt?: string;
  
  // Status
  status: 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed' | 'skipped';
  
  // Engagement
  deliveredAt?: string;
  openedAt?: string;
  firstOpenedAt?: string;
  clickedAt?: string;
  repliedAt?: string;
  bouncedAt?: string;
  bounceReason?: string; // Reason for bounce (hard bounce, spam report, unsubscribed, etc.)
  
  // Content
  subject?: string;
  body?: string;
  variant?: string; // If A/B testing, which variant was sent
  
  // Error handling
  error?: string;
  retryCount?: number;
  
  createdAt: string;
  updatedAt?: string;
}

// Helper types
export type SequenceStatus = 'active' | 'paused' | 'draft' | 'archived';
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'removed' | 'bounced' | 'unsubscribed';
export type StepActionStatus = 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed' | 'skipped';




