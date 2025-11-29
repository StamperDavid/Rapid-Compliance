/**
 * Lead Nurturing Service
 * Handles automated lead nurturing sequences, segmentation, and lifecycle management
 */

import { sendEmail } from '@/lib/email/email-service';
import { calculateLeadScore, LeadScoringFactors } from './lead-scoring';

export interface LeadNurtureSequence {
  id: string;
  name: string;
  organizationId: string;
  workspaceId?: string;
  
  // Sequence configuration
  trigger: 'new_lead' | 'cold_lead' | 'nurture_score' | 'manual' | 'workflow';
  triggerConditions?: {
    minScore?: number;
    maxScore?: number;
    leadSource?: string[];
    status?: string[];
    daysSinceCreated?: number;
  };
  
  // Email sequence
  emails: NurtureEmail[];
  
  // Behavior
  sendFrequency: 'daily' | 'every_other_day' | 'weekly' | 'custom';
  customSchedule?: number[]; // Days: [1, 3, 7, 14, 30]
  maxEmails?: number; // Stop after X emails
  stopOnResponse: boolean; // Pause if lead responds
  stopOnConversion: boolean; // Stop if lead converts
  
  // Segmentation
  segmentCriteria?: {
    industry?: string[];
    companySize?: { min?: number; max?: number };
    location?: string[];
    customFields?: Record<string, any>;
  };
  
  // Status
  status: 'active' | 'paused' | 'draft';
  enrolledLeads: number;
  completedLeads: number;
  convertedLeads: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface NurtureEmail {
  id: string;
  sequenceId: string;
  order: number; // Position in sequence (1, 2, 3...)
  delay: number; // Days to wait before sending (from previous email or sequence start)
  
  // Content
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromEmail?: string;
  fromName?: string;
  
  // Personalization
  personalizationFields?: string[]; // Fields to personalize: {{firstName}}, {{company}}, etc.
  
  // Conditions
  sendConditions?: {
    minScore?: number;
    maxScore?: number;
    requiredFields?: string[]; // Only send if these fields are populated
  };
  
  // Tracking
  trackOpens: boolean;
  trackClicks: boolean;
  
  // Status
  sentCount: number;
  openedCount: number;
  clickedCount: number;
}

export interface LeadEnrichment {
  leadId: string;
  organizationId: string;
  
  // Enrichment sources
  sources: {
    clearbit?: boolean;
    apollo?: boolean;
    zoomInfo?: boolean;
    linkedIn?: boolean;
    custom?: string[];
  };
  
  // Enriched data
  enrichedData: {
    companyInfo?: {
      industry?: string;
      companySize?: number;
      revenue?: number;
      headquarters?: string;
      website?: string;
      description?: string;
      technologies?: string[];
    };
    contactInfo?: {
      email?: string;
      phone?: string;
      linkedIn?: string;
      twitter?: string;
      jobTitle?: string;
      department?: string;
    };
    intentSignals?: {
      jobChanges?: number;
      fundingRounds?: number;
      technologyAdoptions?: string[];
      hiring?: boolean;
    };
    socialSignals?: {
      linkedInConnections?: number;
      twitterFollowers?: number;
      githubActivity?: number;
    };
  };
  
  // Metadata
  enrichedAt: Date;
  enrichmentSource: string;
  confidence: number; // 0-100
}

export interface LeadLifecycleStage {
  stage: 'new' | 'nurturing' | 'qualified' | 'meeting' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  enteredAt: Date;
  exitedAt?: Date;
  duration?: number; // Days in stage
  conversionProbability?: number;
}

export interface LeadActivity {
  leadId: string;
  activityType: 'email_sent' | 'email_opened' | 'email_clicked' | 'form_submitted' | 
                'page_viewed' | 'download' | 'meeting_booked' | 'call' | 'note_added';
  timestamp: Date;
  details?: Record<string, any>;
  source?: string;
  attributedTo?: string; // Campaign, sequence, or manual
}

/**
 * Create lead nurture sequence
 */
export async function createNurtureSequence(sequence: Partial<LeadNurtureSequence>): Promise<LeadNurtureSequence> {
  const sequenceId = `nurture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const fullSequence: LeadNurtureSequence = {
    id: sequenceId,
    name: sequence.name || 'Untitled Sequence',
    organizationId: sequence.organizationId!,
    workspaceId: sequence.workspaceId,
    trigger: sequence.trigger || 'new_lead',
    triggerConditions: sequence.triggerConditions,
    emails: sequence.emails || [],
    sendFrequency: sequence.sendFrequency || 'weekly',
    customSchedule: sequence.customSchedule,
    maxEmails: sequence.maxEmails,
    stopOnResponse: sequence.stopOnResponse ?? true,
    stopOnConversion: sequence.stopOnConversion ?? true,
    segmentCriteria: sequence.segmentCriteria,
    status: 'draft',
    enrolledLeads: 0,
    completedLeads: 0,
    convertedLeads: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: sequence.createdBy || 'system',
  };

  // Store sequence in Firestore
  try {
    const { LeadNurturingService } = await import('@/lib/db/firestore-service');
    await LeadNurturingService.setSequence(fullSequence.organizationId, sequenceId, {
      ...fullSequence,
      createdAt: fullSequence.createdAt.toISOString(),
      updatedAt: fullSequence.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to save nurture sequence to Firestore:', error);
  }

  return fullSequence;
}

/**
 * Enroll lead in nurture sequence
 */
export async function enrollLeadInSequence(
  leadId: string,
  sequenceId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  // Load sequence from Firestore
  const { LeadNurturingService } = await import('@/lib/db/firestore-service');
  const sequenceData = await LeadNurturingService.getSequence(organizationId, sequenceId);
  
  if (!sequenceData) {
    return { success: false, error: 'Sequence not found' };
  }

  const sequence: LeadNurtureSequence = {
    ...sequenceData,
    createdAt: new Date(sequenceData.createdAt),
    updatedAt: new Date(sequenceData.updatedAt),
  } as LeadNurtureSequence;

  if (sequence.status !== 'active') {
    return { success: false, error: 'Sequence is not active' };
  }

  // Check if lead matches segment criteria
  if (sequence.segmentCriteria) {
    // In production, would check lead data against criteria
    // For now, assume it matches
  }

  // Schedule first email
  const firstEmail = sequence.emails[0];
  if (firstEmail) {
    // In production, would schedule email via job queue
    // For now, just mark as enrolled
    console.log(`Lead ${leadId} enrolled in sequence ${sequenceId}, first email scheduled`);
  }

  // Update sequence stats
  sequence.enrolledLeads += 1;
  sequence.updatedAt = new Date();

  return { success: true };
}

/**
 * Enrich lead data from external sources
 */
export async function enrichLead(
  leadId: string,
  organizationId: string,
  sources: LeadEnrichment['sources']
): Promise<LeadEnrichment> {
  // In production, this would:
  // 1. Call Clearbit/Apollo/ZoomInfo APIs
  // 2. Fetch LinkedIn data
  // 3. Aggregate data from multiple sources
  // 4. Store enriched data in database

  const enrichment: LeadEnrichment = {
    leadId,
    organizationId,
    sources,
    enrichedData: {
      // Mock enriched data - would come from APIs
      companyInfo: {
        industry: 'Technology',
        companySize: 50,
        revenue: 5000000,
        website: 'https://example.com',
      },
      contactInfo: {
        email: 'lead@example.com',
        jobTitle: 'VP of Sales',
      },
      intentSignals: {
        jobChanges: 0,
        fundingRounds: 1,
        hiring: true,
      },
    },
    enrichedAt: new Date(),
    enrichmentSource: 'clearbit',
    confidence: 85,
  };

  // Store enrichment in Firestore
  try {
    const { LeadNurturingService } = await import('@/lib/db/firestore-service');
    await LeadNurturingService.setEnrichment(enrichment.organizationId, leadId, {
      ...enrichment,
      enrichedAt: enrichment.enrichedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to save lead enrichment to Firestore:', error);
  }

  return enrichment;
}

/**
 * Track lead activity
 */
export async function trackLeadActivity(activity: LeadActivity): Promise<void> {
  // In production, would:
  // 1. Store activity in database
  // 2. Update lead score based on activity
  // 3. Trigger workflows if configured
  // 4. Update analytics

  // Store activity in Firestore
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${activity.leadId.split('_')[0]}/${COLLECTIONS.LEAD_ACTIVITIES}`,
      `${activity.leadId}_${Date.now()}`,
      {
        ...activity,
        timestamp: activity.timestamp.toISOString(),
      },
      false
    );
  } catch (error) {
    console.error('Failed to save lead activity to Firestore:', error);
  }
}

/**
 * Get lead lifecycle analysis
 */
export interface LeadLifecycleAnalysis {
  leadId: string;
  currentStage: LeadLifecycleStage['stage'];
  stages: LeadLifecycleStage[];
  averageTimeInStage: Record<string, number>; // Days
  conversionProbability: number;
  nextBestAction: string;
  riskFactors: string[];
}

export async function analyzeLeadLifecycle(leadId: string): Promise<LeadLifecycleAnalysis | null> {
  // In production, would:
  // 1. Load all lifecycle stages for lead
  // 2. Calculate time in each stage
  // 3. Compare to benchmarks
  // 4. Identify bottlenecks
  // 5. Recommend actions

  // Mock analysis
  return {
    leadId,
    currentStage: 'nurturing',
    stages: [
      { stage: 'new', enteredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), duration: 5 },
      { stage: 'nurturing', enteredAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
    ],
    averageTimeInStage: {
      new: 5,
      nurturing: 25,
    },
    conversionProbability: 0.65,
    nextBestAction: 'Schedule discovery call',
    riskFactors: ['No response to last 3 emails', 'Score decreasing'],
  };
}

/**
 * Get lead source attribution
 */
export interface LeadAttribution {
  leadId: string;
  primarySource: string;
  sources: Array<{
    source: string;
    touchpoint: string;
    timestamp: Date;
    weight: number; // Attribution weight (0-1)
  }>;
  attributionModel: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped';
}

export async function getLeadAttribution(
  leadId: string,
  model: LeadAttribution['attributionModel'] = 'linear'
): Promise<LeadAttribution | null> {
  // In production, would:
  // 1. Load all touchpoints for lead
  // 2. Apply attribution model
  // 3. Calculate source weights
  // 4. Return attribution data

  return {
    leadId,
    primarySource: 'Website',
    sources: [
      { source: 'Website', touchpoint: 'Form Submission', timestamp: new Date(), weight: 0.4 },
      { source: 'Email Campaign', touchpoint: 'Email Click', timestamp: new Date(), weight: 0.3 },
      { source: 'Social Media', touchpoint: 'LinkedIn Click', timestamp: new Date(), weight: 0.3 },
    ],
    attributionModel: model,
  };
}

/**
 * Segment leads based on criteria
 */
export interface LeadSegment {
  id: string;
  name: string;
  organizationId: string;
  criteria: {
    scoreRange?: { min: number; max: number };
    status?: string[];
    source?: string[];
    industry?: string[];
    companySize?: { min?: number; max?: number };
    lastActivityDays?: number;
    customFields?: Record<string, any>;
  };
  leadCount: number;
  createdAt: Date;
}

export async function createLeadSegment(segment: Partial<LeadSegment>): Promise<LeadSegment> {
  const segmentId = `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const fullSegment: LeadSegment = {
    id: segmentId,
    name: segment.name || 'Untitled Segment',
    organizationId: segment.organizationId!,
    criteria: segment.criteria || {},
    leadCount: 0,
    createdAt: new Date(),
  };

  // Store segment in Firestore
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${fullSegment.organizationId}/${COLLECTIONS.LEAD_SEGMENTS}`,
      segmentId,
      {
        ...fullSegment,
        createdAt: fullSegment.createdAt.toISOString(),
      },
      false
    );
  } catch (error) {
    console.error('Failed to save lead segment to Firestore:', error);
    // Fallback to localStorage if Firestore fails (development only)
    if (typeof window !== 'undefined') {
      const segments = JSON.parse(localStorage.getItem('leadSegments') || '[]');
      segments.push(fullSegment);
      localStorage.setItem('leadSegments', JSON.stringify(segments));
    }
  }

  return fullSegment;
}

/**
 * Get leads matching segment criteria
 */
export async function getLeadsInSegment(segmentId: string): Promise<string[]> {
  // In production, would:
  // 1. Load segment criteria
  // 2. Query database for matching leads
  // 3. Return lead IDs

  // Mock implementation
  return ['lead1', 'lead2', 'lead3'];
}
