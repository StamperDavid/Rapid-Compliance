/**
 * Lead Nurturing Service
 * Handles automated lead nurturing sequences, segmentation, and lifecycle management
 */

// Reserved for future use: sendEmail for nurture email delivery
// import { sendEmail } from '@/lib/email/email-service';
// Reserved for future use: lead scoring integration
// import { calculateLeadScore, LeadScoringFactors } from './lead-scoring'
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface LeadNurtureSequence {
  id: string;
  name: string;
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
    customFields?: Record<string, unknown>;
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
  details?: Record<string, unknown>;
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
    name: (sequence.name !== '' && sequence.name != null) ? sequence.name : 'Untitled Sequence',
    trigger: sequence.trigger ?? 'new_lead',
    triggerConditions: sequence.triggerConditions,
    emails: sequence.emails ?? [],
    sendFrequency: sequence.sendFrequency ?? 'weekly',
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
    createdBy:(sequence.createdBy !== '' && sequence.createdBy != null) ? sequence.createdBy : 'system',
  };

  // Store sequence in Firestore
  try {
    const { LeadNurturingService } = await import('@/lib/db/firestore-service');
    await LeadNurturingService.setSequence(sequenceId, {
      ...fullSequence,
      createdAt: fullSequence.createdAt.toISOString(),
      updatedAt: fullSequence.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to save nurture sequence to Firestore:', error instanceof Error ? error : new Error(String(error)), { file: 'lead-nurturing.ts' });
  }

  return fullSequence;
}

/**
 * Enroll lead in nurture sequence
 */
export async function enrollLeadInSequence(
  leadId: string,
  sequenceId: string
): Promise<{ success: boolean; error?: string }> {
  // Load sequence from Firestore
  const { LeadNurturingService } = await import('@/lib/db/firestore-service');
  const sequenceData = await LeadNurturingService.getSequence(sequenceId);
  
  if (!sequenceData) {
    return { success: false, error: 'Sequence not found' };
  }

  const sequence: LeadNurtureSequence = {
    ...sequenceData,
    createdAt: new Date(sequenceData.createdAt as string | number | Date),
    updatedAt: new Date(sequenceData.updatedAt as string | number | Date),
  } as LeadNurtureSequence;

  if (sequence.status !== 'active') {
    return { success: false, error: 'Sequence is not active' };
  }

  // Check if lead matches segment criteria
  if (sequence.segmentCriteria) {
    // In production, would check lead data against criteria
    // For now, assume it matches
  }

  // Enroll via SequenceEngine which writes the enrollment document and
  // schedules the first step via adminDb so the processSequences cron can
  // find it. The engine handles duplicate-enrollment guard internally.
  try {
    const { SequenceEngine } = await import('@/lib/outbound/sequence-engine');
    await SequenceEngine.enrollProspect(leadId, sequenceId);
    logger.info(`Lead ${leadId} enrolled in sequence ${sequenceId} — first step scheduled`, { file: 'lead-nurturing.ts' });
  } catch (enrollError) {
    const msg = enrollError instanceof Error ? enrollError.message : String(enrollError);
    // "already enrolled" is not a fatal error — treat it as a no-op
    if (msg.includes('already enrolled')) {
      logger.info(`Lead ${leadId} is already enrolled in sequence ${sequenceId}`, { file: 'lead-nurturing.ts' });
    } else {
      logger.error('Failed to enroll lead in sequence via SequenceEngine', enrollError instanceof Error ? enrollError : new Error(msg), { file: 'lead-nurturing.ts' });
      return { success: false, error: msg };
    }
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
  sources: LeadEnrichment['sources']
): Promise<LeadEnrichment> {
  const enrichment: LeadEnrichment = {
    leadId,
    sources,
    enrichedData: {},
    enrichedAt: new Date(),
    enrichmentSource: 'none',
    confidence: 0,
  };

  // Try Apollo enrichment if configured and requested
  if (sources.apollo !== false) {
    try {
      const { apolloService, toEnrichmentData } = await import('@/lib/integrations/apollo/apollo-service');
      const configured = await apolloService.isConfigured();

      if (configured) {
        // Load the lead to get domain/email for enrichment
        const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
        const lead = await AdminFirestoreService.get<Record<string, unknown>>(getSubCollection('leads'), leadId);

        const domain = (lead?.company as string)?.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
          ?? (lead?.email as string)?.split('@')[1]
          ?? null;
        const email = (lead?.email as string) ?? null;

        // Org enrichment (free)
        if (domain) {
          const orgResult = await apolloService.enrichOrganization({ domain });
          if (orgResult.success && orgResult.data) {
            const orgData = toEnrichmentData(orgResult.data);
            enrichment.enrichedData.companyInfo = {
              industry: orgData.industry,
              companySize: orgData.employeeCount,
              revenue: orgData.revenue ? parseFloat(orgData.revenue.replace(/[^0-9.]/g, '')) || undefined : undefined,
              headquarters: [orgData.city, orgData.state, orgData.country].filter(Boolean).join(', ') || undefined,
              website: orgData.website,
              description: orgData.description,
              technologies: orgData.techStack,
            };
          }
        }

        // Person enrichment (1 credit)
        if (email ?? domain) {
          const personResult = await apolloService.enrichPerson({
            email: email ?? undefined,
            domain: domain ?? undefined,
            first_name: (lead?.firstName as string) ?? undefined,
            last_name: (lead?.lastName as string) ?? undefined,
          });
          if (personResult.success && personResult.data) {
            const person = personResult.data;
            enrichment.enrichedData.contactInfo = {
              email: person.email ?? undefined,
              phone: person.phone_numbers?.[0]?.sanitized_number ?? undefined,
              linkedIn: person.linkedin_url ?? undefined,
              jobTitle: person.title ?? undefined,
            };
          }
        }

        enrichment.enrichmentSource = 'apollo';
        enrichment.confidence = 85;
      }
    } catch (error) {
      logger.warn('Apollo enrichment failed, returning partial data', {
        leadId,
        error: error instanceof Error ? error.message : String(error),
        file: 'lead-nurturing.ts',
      });
    }
  }

  // Store enrichment in Firestore
  try {
    const { LeadNurturingService } = await import('@/lib/db/firestore-service');
    await LeadNurturingService.setEnrichment(leadId, {
      ...enrichment,
      enrichedAt: enrichment.enrichedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to save lead enrichment to Firestore:', error instanceof Error ? error : new Error(String(error)), { file: 'lead-nurturing.ts' });
  }

  return enrichment;
}

// trackLeadActivity removed Apr 29 2026 — wrote to `leadActivities` collection
// that no module reads. analyzeLeadLifecycle below already handles the
// pre-load case by returning null until real data exists.

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

export function analyzeLeadLifecycle(_leadId: string): LeadLifecycleAnalysis | null {
  // Lifecycle analysis requires loading activity data from Firestore.
  // Returns null until real data is available for this lead.
  // Real implementation: query organizations/{PLATFORM_ID}/lead_activities for this leadId.
  return null;
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

export function getLeadAttribution(
  leadId: string,
  _model: LeadAttribution['attributionModel'] = 'linear'
): LeadAttribution | null {
  // Attribution requires loading touchpoint data from Firestore.
  // Returns null until real tracking data is available for this lead.
  return null;
}

// LeadSegment / createLeadSegment / getLeadsInSegment removed Apr 29 2026 —
// wrote to `leadSegments` collection that no module reads, and
// getLeadsInSegment was a mock returning fake lead IDs ['lead1', 'lead2',
// 'lead3'] regardless of segment criteria. The whole segmentation feature
// was paid for at write time and produced fake reads. When real
// segmentation is needed, build it on top of a real query against the
// leads collection (filter by score range, status, source, etc.) — do not
// re-introduce the writer-without-reader pattern.
