/**
 * Email Campaign Manager
 * Handles email marketing campaigns, A/B testing, and automation
 */

import { sendEmail, sendBulkEmails, EmailOptions } from './email-service';

export interface EmailCampaign {
  id: string;
  name: string;
  organizationId: string;
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
  segmentCriteria?: Record<string, any>; // For dynamic segments
  
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
  
  const fullCampaign: EmailCampaign = {
    id: campaignId,
    name: campaign.name || 'Untitled Campaign',
    organizationId: campaign.organizationId!,
    workspaceId: campaign.workspaceId,
    type: campaign.type || 'broadcast',
    subject: campaign.subject!,
    subjectB: campaign.subjectB,
    htmlContent: campaign.htmlContent!,
    htmlContentB: campaign.htmlContentB,
    textContent: campaign.textContent,
    fromEmail: campaign.fromEmail!,
    fromName: campaign.fromName!,
    replyTo: campaign.replyTo,
    recipientList: campaign.recipientList || [],
    segmentCriteria: campaign.segmentCriteria,
    scheduledFor: campaign.scheduledFor,
    sendImmediately: campaign.sendImmediately ?? false,
    abTest: campaign.abTest,
    trackOpens: campaign.trackOpens ?? true,
    trackClicks: campaign.trackClicks ?? true,
    trackConversions: campaign.trackConversions ?? false,
    conversionGoal: campaign.conversionGoal,
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
    createdBy: campaign.createdBy || 'system',
  };

  // Store campaign in Firestore
  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  await EmailCampaignService.set(fullCampaign.organizationId, campaignId, {
    ...fullCampaign,
    createdAt: fullCampaign.createdAt.toISOString(),
    updatedAt: fullCampaign.updatedAt.toISOString(),
    scheduledFor: fullCampaign.scheduledFor?.toISOString(),
    sentAt: fullCampaign.sentAt?.toISOString(),
  });

  return fullCampaign;
}

/**
 * Send email campaign
 */
export async function sendCampaign(campaignId: string, organizationId?: string): Promise<{ success: boolean; error?: string }> {
  // Load campaign from Firestore
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' };
  }

  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const campaignData = await EmailCampaignService.get(organizationId, campaignId);
  
  if (!campaignData) {
    return { success: false, error: 'Campaign not found' };
  }

  // Convert Firestore data back to EmailCampaign format
  const campaign: EmailCampaign = {
    ...campaignData,
    createdAt: new Date(campaignData.createdAt),
    updatedAt: new Date(campaignData.updatedAt),
    scheduledFor: campaignData.scheduledFor ? new Date(campaignData.scheduledFor) : undefined,
    sentAt: campaignData.sentAt ? new Date(campaignData.sentAt) : undefined,
  } as EmailCampaign;

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return { success: false, error: `Campaign cannot be sent. Current status: ${campaign.status}` };
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
          organizationId: campaign.organizationId,
        },
      });

      // Send B variant
      const bResults = await sendBulkEmails(bRecipients, {
        subject: campaign.subjectB || campaign.subject,
        html: campaign.htmlContentB || campaign.htmlContent,
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
          organizationId: campaign.organizationId,
        },
      });

      campaign.sentCount = aResults.length + bResults.length;
      campaign.deliveredCount = aResults.filter(r => r.success).length + bResults.filter(r => r.success).length;

      // Schedule winner to be sent to remaining recipients after test duration
      if (campaign.abTest.testDuration) {
        // In production, schedule this via a job queue
        setTimeout(async () => {
          const winner = await determineABTestWinner(campaignId, 'A', 'B');
          const winnerContent = winner === 'A' 
            ? { subject: campaign.subject, html: campaign.htmlContent }
            : { subject: campaign.subjectB || campaign.subject, html: campaign.htmlContentB || campaign.htmlContent };
          
          await sendBulkEmails(remainingRecipients, {
            ...winnerContent,
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
              variant: winner,
              organizationId: campaign.organizationId,
            },
          });
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
          organizationId: campaign.organizationId,
        },
      });

      campaign.sentCount = results.length;
      campaign.deliveredCount = results.filter(r => r.success).length;
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.updatedAt = new Date();

    // Save updated campaign to Firestore
    await EmailCampaignService.set(campaign.organizationId, campaignId, {
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      scheduledFor: campaign.scheduledFor?.toISOString(),
      sentAt: campaign.sentAt.toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    campaign.status = 'draft';
    campaign.updatedAt = new Date();
    return { success: false, error: error.message };
  }
}

/**
 * Determine A/B test winner
 */
async function determineABTestWinner(
  campaignId: string,
  variantA: string,
  variantB: string
): Promise<'A' | 'B'> {
  // In production, query database for open/click stats
  // For now, return A as default
  return 'A';
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(campaignId: string, organizationId?: string): Promise<CampaignStats | null> {
  // Load campaign from Firestore
  if (!organizationId) {
    return null;
  }

  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const campaignData = await EmailCampaignService.get(organizationId, campaignId);
  
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
  organizationId: string, 
  pageSize: number = 50,
  lastDocId?: string
): Promise<{ campaigns: EmailCampaign[]; hasMore: boolean }> {
  // Load campaigns from Firestore with pagination
  const { EmailCampaignService } = await import('@/lib/db/firestore-service');
  const { orderBy } = await import('firebase/firestore');
  const result = await EmailCampaignService.getAllPaginated(
    organizationId,
    [orderBy('createdAt', 'desc')],
    Math.min(pageSize, 100) // Max 100 per page
  );
  
  // Convert Firestore data back to EmailCampaign format
  const campaigns = result.data.map((c: any) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    scheduledFor: c.scheduledFor ? new Date(c.scheduledFor) : undefined,
    sentAt: c.sentAt ? new Date(c.sentAt) : undefined,
  })) as EmailCampaign[];
  
  return {
    campaigns,
    hasMore: result.hasMore,
  };
}

