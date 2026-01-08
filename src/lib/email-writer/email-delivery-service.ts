/**
 * Email Delivery Service - SendGrid Integration
 * 
 * SOVEREIGN CORPORATE BRAIN - EMAIL DELIVERY MODULE
 * 
 * This service handles actual email delivery via SendGrid with:
 * - HTML and plain text email sending
 * - Open and click tracking
 * - Retry logic with exponential backoff
 * - Delivery status tracking
 * - Signal Bus integration
 * 
 * CAPABILITIES:
 * - Send transactional sales emails
 * - Track email opens and clicks
 * - Handle bounce and spam reports
 * - Retry failed deliveries
 * - Log all delivery attempts
 * - Signal Bus integration for delivery events
 */

import sgMail from '@sendgrid/mail';
import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { adminDb } from '@/lib/firebase/admin';
import { getOrgSubCollection } from '@/lib/firebase/collections';
import { retryWithBackoff } from '@/lib/utils/retry';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Ensure adminDb is initialized, throw if not
 */
function ensureAdminDb() {
  if (!adminDb) {
    throw new Error('Admin Firestore DB not initialized. Check Firebase Admin SDK configuration.');
  }
  return adminDb;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Email delivery options
 */
export interface EmailDeliveryOptions {
  organizationId: string;
  workspaceId: string;
  userId: string;
  
  // Email content
  to: string; // Recipient email
  toName?: string; // Recipient name
  subject: string;
  html: string; // HTML body
  text: string; // Plain text body
  
  // Tracking
  trackOpens?: boolean; // Default: true
  trackClicks?: boolean; // Default: true
  
  // Context
  dealId?: string;
  emailId?: string; // Generated email ID if from email writer
  campaignId?: string; // Optional campaign ID
  
  // Custom headers
  customArgs?: Record<string, string>; // Custom data for tracking
  
  // Reply-to
  replyTo?: string;
  replyToName?: string;
}

/**
 * Email delivery result
 */
export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string; // SendGrid message ID
  error?: string;
  deliveryId: string; // Our internal delivery tracking ID
  sentAt?: Date;
  retryCount?: number;
}

/**
 * Email delivery status
 */
export type EmailDeliveryStatus = 
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'spam'
  | 'failed';

/**
 * Email delivery record
 */
export interface EmailDeliveryRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  
  // Recipients
  to: string;
  toName?: string;
  
  // Content
  subject: string;
  html: string;
  text: string;
  
  // Delivery
  status: EmailDeliveryStatus;
  messageId?: string; // SendGrid message ID
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  openedAt?: Timestamp;
  clickedAt?: Timestamp;
  bouncedAt?: Timestamp;
  failedAt?: Timestamp;
  
  // Tracking
  opens: number; // Number of opens
  clicks: number; // Number of clicks
  uniqueOpens: number;
  uniqueClicks: number;
  
  // Context
  dealId?: string;
  emailId?: string;
  campaignId?: string;
  
  // Error handling
  error?: string;
  retryCount: number;
  lastRetryAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  customArgs?: Record<string, string>;
}

// ============================================================================
// EMAIL DELIVERY SERVICE
// ============================================================================

/**
 * Initialize SendGrid with API key
 */
function initializeSendGrid(): void {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is required');
  }
  sgMail.setApiKey(apiKey);
}

/**
 * Get from email and name from environment
 */
function getFromAddress(): { email: string; name: string } {
  const fromEmail = process.env.FROM_EMAIL;
  const fromName =(process.env.FROM_NAME !== '' && process.env.FROM_NAME != null) ? process.env.FROM_NAME : 'AI Sales Platform';
  
  if (!fromEmail) {
    throw new Error('FROM_EMAIL environment variable is required');
  }
  
  return { email: fromEmail, name: fromName };
}

/**
 * Send email via SendGrid
 */
export async function sendEmail(
  options: EmailDeliveryOptions
): Promise<EmailDeliveryResult> {
  const startTime = Date.now();
  
  try {
    // Initialize SendGrid
    initializeSendGrid();
    
    // Get from address
    const from = getFromAddress();
    
    // Create delivery record
    const deliveryId = `delivery_${options.organizationId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Prepare custom args for tracking
    const customArgs = {
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      userId: options.userId,
      deliveryId,
      ...(options.dealId && { dealId: options.dealId }),
      ...(options.emailId && { emailId: options.emailId }),
      ...(options.campaignId && { campaignId: options.campaignId }),
      ...options.customArgs,
    };
    
    // Prepare SendGrid message
    const msg = {
      to: {
        email: options.to,
        name: options.toName,
      },
      from: {
        email: from.email,
        name: from.name,
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
      trackingSettings: {
        clickTracking: {
          enable: options.trackClicks !== false,
          enableText: options.trackClicks !== false,
        },
        openTracking: {
          enable: options.trackOpens !== false,
        },
      },
      customArgs,
      ...(options.replyTo && {
        replyTo: {
          email: options.replyTo,
          name: options.replyToName,
        },
      }),
    };
    
    // Send email with retry logic
    const [response] = await retryWithBackoff(
      async () => sgMail.send(msg),
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        operationName: 'sendEmail',
      }
    );
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const messageId = String(response.headers['x-message-id'] ?? '');
    const sentAt = new Date();
    
    // Save delivery record
    await saveDeliveryRecord({
      id: deliveryId,
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      userId: options.userId,
      to: options.to,
      toName: options.toName,
      subject: options.subject,
      html: options.html,
      text: options.text,
      status: 'sent',
      messageId,
      sentAt: Timestamp.fromDate(sentAt),
      opens: 0,
      clicks: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      dealId: options.dealId,
      emailId: options.emailId,
      campaignId: options.campaignId,
      retryCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      customArgs,
    });
    
    // Emit signal
    await emitEmailSentSignal(options.organizationId, deliveryId, {
      to: options.to,
      subject: options.subject,
      dealId: options.dealId,
      emailId: options.emailId,
    });
    
    const duration = Date.now() - startTime;
    logger.info('Email sent successfully', {
      deliveryId,
      messageId,
      to: options.to,
      duration,
    });
    
    return {
      success: true,
      messageId,
      deliveryId,
      sentAt,
      retryCount: 0,
    };
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Failed to send email', error as Error, {
      to: options.to,
      duration,
    });
    
    // Create failed delivery record
    const deliveryId = `delivery_${options.organizationId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await saveDeliveryRecord({
      id: deliveryId,
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      userId: options.userId,
      to: options.to,
      toName: options.toName,
      subject: options.subject,
      html: options.html,
      text: options.text,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: Timestamp.now(),
      opens: 0,
      clicks: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      dealId: options.dealId,
      emailId: options.emailId,
      campaignId: options.campaignId,
      retryCount: 3, // Max retries exhausted
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    await emitEmailFailedSignal(options.organizationId, deliveryId, {
      to: options.to,
      error: error instanceof Error ? error.message : 'Unknown error',
      dealId: options.dealId,
    });
    
    return {
      success: false,
      deliveryId,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryCount: 3,
    };
  }
}

/**
 * Save delivery record to Firestore
 */
async function saveDeliveryRecord(record: EmailDeliveryRecord): Promise<void> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(record.organizationId, 'email_deliveries'))
    .doc(record.id);
  
  await deliveriesRef.set(record);
}

/**
 * Update delivery status
 */
export async function updateDeliveryStatus(
  organizationId: string,
  deliveryId: string,
  status: EmailDeliveryStatus,
  metadata?: {
    openedAt?: Date;
    clickedAt?: Date;
    bouncedAt?: Date;
    deliveredAt?: Date;
  }
): Promise<void> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .doc(deliveryId);
  
  const updates: Partial<EmailDeliveryRecord> = {
    status,
    updatedAt: Timestamp.now(),
  };
  
  if (metadata?.openedAt) {
    updates.openedAt = Timestamp.fromDate(metadata.openedAt);
    updates.uniqueOpens = 1; // Will be incremented on subsequent opens
  }
  
  if (metadata?.clickedAt) {
    updates.clickedAt = Timestamp.fromDate(metadata.clickedAt);
    updates.uniqueClicks = 1;
  }
  
  if (metadata?.bouncedAt) {
    updates.bouncedAt = Timestamp.fromDate(metadata.bouncedAt);
  }
  
  if (metadata?.deliveredAt) {
    updates.deliveredAt = Timestamp.fromDate(metadata.deliveredAt);
  }
  
  await deliveriesRef.update(updates);
}

/**
 * Increment open count
 */
export async function incrementOpenCount(
  organizationId: string,
  deliveryId: string
): Promise<void> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .doc(deliveryId);
  
  await deliveriesRef.update({
    opens: FieldValue.increment(1),
    status: 'opened',
    updatedAt: Timestamp.now(),
  });
  
  // Emit signal
  await emitEmailOpenedSignal(organizationId, deliveryId);
}

/**
 * Increment click count
 */
export async function incrementClickCount(
  organizationId: string,
  deliveryId: string
): Promise<void> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .doc(deliveryId);
  
  await deliveriesRef.update({
    clicks: FieldValue.increment(1),
    status: 'clicked',
    updatedAt: Timestamp.now(),
  });
  
  // Emit signal
  await emitEmailClickedSignal(organizationId, deliveryId);
}

/**
 * Get delivery record
 */
export async function getDeliveryRecord(
  organizationId: string,
  deliveryId: string
): Promise<EmailDeliveryRecord | null> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .doc(deliveryId);
  
  const doc = await deliveriesRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as EmailDeliveryRecord;
}

/**
 * Get delivery records for a deal
 */
export async function getDeliveryRecordsForDeal(
  organizationId: string,
  dealId: string
): Promise<EmailDeliveryRecord[]> {
  const deliveriesRef = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .where('dealId', '==', dealId)
    .orderBy('createdAt', 'desc')
    .limit(100);
  
  const snapshot = await deliveriesRef.get();
  
  return snapshot.docs.map(doc => doc.data() as EmailDeliveryRecord);
}

/**
 * Get delivery stats for a user
 */
export async function getDeliveryStatsForUser(
  organizationId: string,
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalFailed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}> {
  let query = ensureAdminDb()
    .collection(getOrgSubCollection(organizationId, 'email_deliveries'))
    .where('userId', '==', userId);
  
  if (startDate) {
    query = query.where('createdAt', '>=', Timestamp.fromDate(startDate));
  }
  
  if (endDate) {
    query = query.where('createdAt', '<=', Timestamp.fromDate(endDate));
  }
  
  const snapshot = await query.get();
  const records = snapshot.docs.map(doc => doc.data() as EmailDeliveryRecord);
  
  const stats = {
    totalSent: records.filter(r => r.status !== 'failed').length,
    totalDelivered: records.filter(r => r.status === 'delivered' || r.status === 'opened' || r.status === 'clicked').length,
    totalOpened: records.filter(r => r.uniqueOpens > 0).length,
    totalClicked: records.filter(r => r.uniqueClicks > 0).length,
    totalBounced: records.filter(r => r.status === 'bounced').length,
    totalFailed: records.filter(r => r.status === 'failed').length,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
  };
  
  if (stats.totalSent > 0) {
    stats.openRate = (stats.totalOpened / stats.totalSent) * 100;
    stats.clickRate = (stats.totalClicked / stats.totalSent) * 100;
    stats.bounceRate = (stats.totalBounced / stats.totalSent) * 100;
  }
  
  return stats;
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit email sent signal
 */
async function emitEmailSentSignal(
  organizationId: string,
  deliveryId: string,
  metadata: {
    to: string;
    subject: string;
    dealId?: string;
    emailId?: string;
  }
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'email.sent',
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Medium',
      metadata: {
        deliveryId,
        ...metadata,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to emit email.sent signal', error as Error, { deliveryId });
  }
}

/**
 * Emit email opened signal
 */
async function emitEmailOpenedSignal(
  organizationId: string,
  deliveryId: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'email.opened',
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Low',
      metadata: {
        deliveryId,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to emit email.opened signal', error as Error, { deliveryId });
  }
}

/**
 * Emit email clicked signal
 */
async function emitEmailClickedSignal(
  organizationId: string,
  deliveryId: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'email.clicked',
      orgId: organizationId,
      confidence: 1.0,
      priority: 'Medium',
      metadata: {
        deliveryId,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to emit email.clicked signal', error as Error, { deliveryId });
  }
}

/**
 * Emit email failed signal
 */
async function emitEmailFailedSignal(
  organizationId: string,
  deliveryId: string,
  metadata: {
    to: string;
    error: string;
    dealId?: string;
  }
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'email.delivery.failed',
      orgId: organizationId,
      confidence: 1.0,
      priority: 'High',
      metadata: {
        deliveryId,
        ...metadata,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to emit email.delivery.failed signal', error as Error, { deliveryId });
  }
}
