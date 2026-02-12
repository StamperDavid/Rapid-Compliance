/**
 * Email Campaign Manager
 * Handles email marketing campaigns, A/B testing, and automation
 */

import { sendBulkEmails } from './email-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { ensureCompliance } from '@/lib/compliance/can-spam-service';

export interface EmailCampaign {
  id: string;
  name: string;
  workspaceId?: string;
  
  // Campaign type
  type: 'broadcast' | 'automated' | 'drip' | 'ab-test';
  
  // Content
  subject: string;
  subjectB?: string; // For A/B testing
  htmlContent: string;
  htmlContentB?: string; // For A/B testing
  textContent?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  
  // Recipients
  recipientList: string[]; // Email addresses or segment IDs
  segmentCriteria?: Record<string, unknown>; // For dynamic segments
  
  // Scheduling
  scheduledFor?: Date;
  sendImmediately: boolean;
  
  // A/B Testing
  abTest?: {
    enabled: boolean;
    testPercentage: number; // % of recipients to test (e.g., 20%)
    testDuration?: number; // Hours to wait before sending winner
    metric: 'opens' | 'clicks' | 'conversions';
  };
  
  // Tracking
  trackOpens: boolean;
  trackClicks: boolean;
  trackConversions: boolean;
  conversionGoal?: string; // URL or event to track
  
  // Status
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  sentAt?: Date;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  convertedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CampaignStats {
  campaignId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  unsubscribeRate: number;
}

/**
 * Create and send email campaign
 */
export async function createCampaign(campaign: Partial<EmailCampaign>): Promise<EmailCampaign> {
  const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Build campaign object, excluding undefined values (Firestore doesn't allow undefined)
  const fullCampaign: EmailCampaign = {
    id: campaignId,
    name:(campaign.name !== '' && campaign.name != null) ? campaign.name : 'Untitled Campaign',
    workspaceId:(campaign.workspaceId !== '' && campaign.workspaceId != null) ? campaign.workspaceId : 'default',
    type: campaign.type ?? 'broadcast',
    subject: campaign.subject ?? '',
    ...(campaign.subjectB !== undefined && { subjectB: campaign.subjectB }),
    htmlContent: campaign.htmlContent ?? '',
    ...(campaign.htmlContentB !== undefined && { htmlContentB: campaign.htmlContentB }),
    ...(campaign.textContent !== undefined && { textContent: campaign.textContent }),
    fromEmail: campaign.fromEmail ?? '',
    fromName: campaign.fromName ?? '',
    ...(campaign.replyTo !== undefined && { replyTo: campaign.replyTo }),
    recipientList:campaign.recipientList ?? [],
    ...(campaign.segmentCriteria !== undefined && { segmentCriteria: campaign.segmentCriteria }),
    ...(campaign.scheduledFor !== undefined && { scheduledFor: campaign.scheduledFor }),
    sendImmediately: campaign.sendImmediately ?? false,
    ...(campaign.abTest !== undefined && { abTest: campaign.abTest }),
    trackOpens: campaign.trackOpens ?? true,
    trackClicks: campaign.trackClicks ?? true,
    trackConversions: campaign.trackConversions ?? false,
    ...(campaign.conversionGoal !== undefined && { conversionGoal: campaign.conversionGoal }),
    status: 'draft',
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    convertedCount: 0,
    bouncedCount: 0,
    unsubscribedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy:(campaign.createdBy !== '' && campaign.createdBy != null) ? campaign.createdBy : 'system',
  } as EmailCampaign;

  // Store campaign in Firestore (remove undefined values)
  // In test mode, use AdminFirestoreService to bypass security rules
  const isTest = process.env.NODE_ENV === 'test';

  const campaignData: Record<string, unknown> = {
    ...fullCampaign,
    createdAt: fullCampaign.createdAt.toISOString(),
    updatedAt: fullCampaign.updatedAt.toISOString(),
  };

  // Only add optional date fields if they exist
  if (fullCampaign.scheduledFor) {
    campaignData.scheduledFor = fullCampaign.scheduledFor.toISOString();
  }
  if (fullCampaign.sentAt) {
    campaignData.sentAt = fullCampaign.sentAt.toISOString();
  }

  if (isTest) {
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { COLLECTIONS } = await import('@/lib/db/firestore-service');
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.EMAIL_CAMPAIGNS}`,
      campaignId,
      campaignData,
      false
    );
  } else {
    const { EmailCampaignService } = await import('@/lib/db/firestore-service');
    await EmailCampaignService.set(campaignId, campaignData);
  }

  return fullCampaign;
}

/**
 * Send email campaign
 */
export async function sendCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  // Load campaign from Firestore
  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const campaignData = await EmailCampaignService.get(campaignId);
  
  if (!campaignData) {
    return { success: false, error: 'Campaign not found' };
  }

  // Convert Firestore data back to EmailCampaign format
  const campaign: EmailCampaign = {
    ...campaignData,
    createdAt: new Date(String(campaignData.createdAt)),
    updatedAt: new Date(String(campaignData.updatedAt)),
    scheduledFor: campaignData.scheduledFor ? new Date(String(campaignData.scheduledFor)) : undefined,
    sentAt: campaignData.sentAt ? new Date(String(campaignData.sentAt)) : undefined,
  } as EmailCampaign;

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return { success: false, error: `Campaign cannot be sent. Current status: ${campaign.status}` };
  }

  // CAN-SPAM: Ensure all campaign HTML content has compliance footer
  campaign.htmlContent = ensureCompliance(campaign.htmlContent, campaignId);
  if (campaign.htmlContentB) {
    campaign.htmlContentB = ensureCompliance(campaign.htmlContentB, campaignId);
  }

  // Update status
  campaign.status = 'sending';
  campaign.updatedAt = new Date();

  try {
    // Handle A/B testing
    if (campaign.abTest?.enabled) {
      const testSize = Math.ceil(campaign.recipientList.length * (campaign.abTest.testPercentage / 100));
      const testRecipients = campaign.recipientList.slice(0, testSize);
      const remainingRecipients = campaign.recipientList.slice(testSize);

      // Send A variant to half of test group
      const aRecipients = testRecipients.slice(0, Math.ceil(testSize / 2));
      const bRecipients = testRecipients.slice(Math.ceil(testSize / 2));

      // Send A variant
      const aResults = await sendBulkEmails(aRecipients, {
        subject: campaign.subject,
        html: campaign.htmlContent,
        text: campaign.textContent,
        from: campaign.fromEmail,
        fromName: campaign.fromName,
        replyTo: campaign.replyTo,
        tracking: {
          trackOpens: campaign.trackOpens,
          trackClicks: campaign.trackClicks,
        },
        metadata: {
          campaignId: campaign.id,
          variant: 'A',
        },
      });

      // Send B variant
      const bResults = await sendBulkEmails(bRecipients, {
        subject:campaign.subjectB ?? campaign.subject,
        html:campaign.htmlContentB ?? campaign.htmlContent,
        text: campaign.textContent,
        from: campaign.fromEmail,
        fromName: campaign.fromName,
        replyTo: campaign.replyTo,
        tracking: {
          trackOpens: campaign.trackOpens,
          trackClicks: campaign.trackClicks,
        },
        metadata: {
          campaignId: campaign.id,
          variant: 'B',
        },
      });

      campaign.sentCount = aResults.length + bResults.length;
      campaign.deliveredCount = aResults.filter(r => r.success).length + bResults.filter(r => r.success).length;

      // Schedule winner to be sent to remaining recipients after test duration
      if (campaign.abTest.testDuration) {
        // In production, schedule this via a job queue
        // Capture local variables to prevent race conditions
        const localSubject = campaign.subject;
        const localSubjectB = campaign.subjectB;
        const localHtmlContent = campaign.htmlContent;
        const localHtmlContentB = campaign.htmlContentB;
        const localTextContent = campaign.textContent;
        const localFromEmail = campaign.fromEmail;
        const localFromName = campaign.fromName;
        const localReplyTo = campaign.replyTo;
        const localTrackOpens = campaign.trackOpens;
        const localTrackClicks = campaign.trackClicks;
        const localCampaignId = campaign.id;

        setTimeout(() => {
          void (async () => {
            const winner = await determineABTestWinner(campaignId, 'A', 'B');
            const winnerContent = winner === 'A'
              ? { subject: localSubject, html: localHtmlContent }
              : { subject: localSubjectB ?? localSubject, html: localHtmlContentB ?? localHtmlContent };

            await sendBulkEmails(remainingRecipients, {
              ...winnerContent,
              text: localTextContent,
              from: localFromEmail,
              fromName: localFromName,
              replyTo: localReplyTo,
              tracking: {
                trackOpens: localTrackOpens,
                trackClicks: localTrackClicks,
              },
              metadata: {
                campaignId: localCampaignId,
                variant: winner,
              },
            });
          })();
        }, campaign.abTest.testDuration * 60 * 60 * 1000);
      }
    } else {
      // Send to all recipients
      const results = await sendBulkEmails(campaign.recipientList, {
        subject: campaign.subject,
        html: campaign.htmlContent,
        text: campaign.textContent,
        from: campaign.fromEmail,
        fromName: campaign.fromName,
        replyTo: campaign.replyTo,
        tracking: {
          trackOpens: campaign.trackOpens,
          trackClicks: campaign.trackClicks,
        },
        metadata: {
          campaignId: campaign.id,
        },
      });

      campaign.sentCount = results.length;
      campaign.deliveredCount = results.filter(r => r.success).length;
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.updatedAt = new Date();

    // Save updated campaign to Firestore
    await EmailCampaignService.set(campaignId, {
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      scheduledFor: campaign.scheduledFor?.toISOString(),
      sentAt: campaign.sentAt.toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    campaign.status = 'draft';
    campaign.updatedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : 'Failed to send campaign';
    return { success: false, error: errorMessage };
  }
}

/**
 * Determine A/B test winner
 */
function determineABTestWinner(
  _campaignId: string,
  _variantA: string,
  _variantB: string
): Promise<'A' | 'B'> {
  // In production, query database for open/click stats
  // For now, return A as default
  return Promise.resolve('A');
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats | null> {
  // Load campaign from Firestore
  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const campaignData = await EmailCampaignService.get(campaignId);
  
  if (!campaignData) {
    return null;
  }

  const campaign = campaignData as EmailCampaign;

  const sent = campaign.sentCount;
  const delivered = campaign.deliveredCount;
  const opened = campaign.openedCount;
  const clicked = campaign.clickedCount;
  const converted = campaign.convertedCount;
  const bounced = campaign.bouncedCount;
  const unsubscribed = campaign.unsubscribedCount;

  return {
    campaignId,
    sent,
    delivered,
    opened,
    clicked,
    converted,
    bounced,
    unsubscribed,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
    conversionRate: sent > 0 ? (converted / sent) * 100 : 0,
    clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    unsubscribeRate: sent > 0 ? (unsubscribed / sent) * 100 : 0,
  };
}

/**
 * List all campaigns
 */
export async function listCampaigns(
  pageSize: number = 50,
  _lastDocId?: string
): Promise<{ campaigns: EmailCampaign[]; hasMore: boolean }> {
  // Load campaigns from Firestore with pagination
  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const { orderBy } = await import('firebase/firestore');
  const result = await EmailCampaignService.getAllPaginated(
    [orderBy('createdAt', 'desc')],
    Math.min(pageSize, 100) // Max 100 per page
  );

  // Convert Firestore data back to EmailCampaign format
  const campaigns = result.data.map((c) => {
    const createdAt = typeof c.createdAt === 'string' ? c.createdAt : String(c.createdAt);
    const updatedAt = typeof c.updatedAt === 'string' ? c.updatedAt : String(c.updatedAt);
    const scheduledFor = c.scheduledFor
      ? (typeof c.scheduledFor === 'string' ? c.scheduledFor : String(c.scheduledFor))
      : undefined;
    const sentAt = c.sentAt
      ? (typeof c.sentAt === 'string' ? c.sentAt : String(c.sentAt))
      : undefined;

    return {
      ...c,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      sentAt: sentAt ? new Date(sentAt) : undefined,
    };
  }) as EmailCampaign[];

  return {
    campaigns,
    hasMore: result.hasMore,
  };
}

