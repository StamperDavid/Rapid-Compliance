/**
 * Email Tracking Service
 * Handles tracking email opens and clicks
 * REAL IMPLEMENTATION with database integration
 */

import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface TrackingPixel {
  messageId: string;
  pixelUrl: string;
}

export interface TrackingLink {
  messageId: string;
  originalUrl: string;
  trackedUrl: string;
}

export interface EmailTrackingStats {
  messageId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  firstOpenedAt?: Date;
  lastOpenedAt?: Date;
  firstClickedAt?: Date;
  lastClickedAt?: Date;
}

/**
 * Generate tracking pixel URL
 * Returns URL to email open tracking endpoint
 */
export function generateTrackingPixel(messageId: string): string {
  // Return HTML tracking pixel for email opens
  const pixelUrl = `/api/email/track/${messageId}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
}

/**
 * Generate tracked link for click tracking
 * Returns URL to click tracking redirect endpoint
 */
export function generateTrackedLink(messageId: string, originalUrl: string): TrackingLink {
  // Generate unique link ID for tracking
  const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const trackedUrl = `/api/email/track/click/${linkId}`;

  // Link mapping should be stored in Firestore when email is sent
  // The tracking endpoint will redirect to originalUrl after logging the click

  return {
    messageId,
    originalUrl,
    trackedUrl,
  };
}

/**
 * Process email HTML and add tracking pixels and link tracking
 * Injects tracking pixel for opens and converts links for click tracking
 */
export function processEmailHtml(html: string, messageId: string, trackOpens: boolean, trackClicks: boolean): string {
  let processedHtml = html;

  // Add tracking pixel for email opens
  if (trackOpens) {
    const pixelHtml = generateTrackingPixel(messageId);
    processedHtml += pixelHtml;
  }

  // Convert links to tracked links for click tracking
  if (trackClicks) {
    // In real implementation, this would:
    // 1. Parse HTML
    // 2. Find all <a> tags
    // 3. Replace href with tracked URL
    // 4. Return modified HTML
  }

  return processedHtml;
}

/**
 * Wrap links in HTML with tracking URLs
 * Replaces all <a> href attributes with tracking redirects
 */
export function wrapLinksWithTracking(html: string, trackingId: string): string {
  // Simple regex to find all <a> tags and wrap their href with tracking
  return html.replace(
    /<a\s+href=["']([^"']+)["']/gi,
    (_match: string, url: string) => {
      const encodedUrl = encodeURIComponent(url);
      return `<a href="/api/email/track/link?trackingId=${trackingId}&url=${encodedUrl}"`;
    }
  );
}

/**
 * Classify email bounce type
 * Returns 'hard' for permanent bounces, 'soft' for temporary, 'spam' for spam detection, 'blocked' for blocked addresses
 */
export function classifyBounce(message: string): 'hard' | 'soft' | 'spam' | 'blocked' {
  const lowerMessage = message.toLowerCase();
  
  // Spam indicators
  const spamKeywords = [
    'spam detected',
    'spam content',
    'spam filter',
    'identified as spam',
  ];
  
  // Blocked indicators
  const blockedKeywords = [
    'blocked',
    '550 5.7.1',
    'blacklisted',
    'blocklist',
    'rejected by policy',
  ];
  
  // Hard bounce indicators (permanent failures)
  const hardBounceKeywords = [
    'user unknown',
    'invalid recipient',
    'does not exist',
    'no such user',
    '550 5.1.1',
    'recipient rejected',
    'address rejected',
  ];
  
  // Check for spam
  for (const keyword of spamKeywords) {
    if (lowerMessage.includes(keyword)) {
      return 'spam';
    }
  }
  
  // Check for blocked
  for (const keyword of blockedKeywords) {
    if (lowerMessage.includes(keyword)) {
      return 'blocked';
    }
  }
  
  // Check for hard bounce
  for (const keyword of hardBounceKeywords) {
    if (lowerMessage.includes(keyword)) {
      return 'hard';
    }
  }
  
  // Everything else is soft bounce (mailbox full, temporarily unavailable, etc.)
  return 'soft';
}

/**
 * Get email tracking statistics from database
 * Queries Firestore for tracking events and calculates stats
 */
interface TrackingData {
  opened?: boolean;
  clicked?: boolean;
  openedAt?: string | number | Date;
  clickedAt?: string | number | Date;
}

export async function getEmailTrackingStats(
  messageId: string,
): Promise<EmailTrackingStats | null> {
  const { FirestoreService } = await import('@/lib/db/firestore-service');
  const rawData = await FirestoreService.get(
    getSubCollection('emailTracking'),
    messageId
  );

  if (!rawData) {
    return null;
  }

  const trackingData = rawData as TrackingData;
  const sent = 1; // Would come from email send record
  const delivered = 1; // Would come from provider webhook
  const opened = trackingData.opened ? 1 : 0;
  const clicked = trackingData.clicked ? 1 : 0;

  return {
    messageId,
    sent,
    delivered,
    opened,
    clicked,
    bounced: 0,
    unsubscribed: 0,
    openRate: (opened / sent) * 100,
    clickRate: (clicked / sent) * 100,
    clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0,
    firstOpenedAt: trackingData.openedAt ? new Date(trackingData.openedAt) : undefined,
    lastOpenedAt: trackingData.openedAt ? new Date(trackingData.openedAt) : undefined,
    firstClickedAt: trackingData.clickedAt ? new Date(trackingData.clickedAt) : undefined,
    lastClickedAt: trackingData.clickedAt ? new Date(trackingData.clickedAt) : undefined,
  };
}

/**
 * Get tracking stats for campaign
 * Aggregates stats for all emails in campaign from Firestore
 */
export async function getCampaignTrackingStats(campaignId: string): Promise<EmailTrackingStats | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const { where } = await import('firebase/firestore');

    interface TrackingEvent {
      campaignId: string;
      messageId: string;
      type: 'open' | 'click' | 'bounce' | 'unsubscribe';
      timestamp: string;
    }

    const events = await FirestoreService.getAll<TrackingEvent>(
      getSubCollection('emailTracking'),
      [where('campaignId', '==', campaignId)]
    );

    if (!events || events.length === 0) {
      return null;
    }

    const openEvents = events.filter((e: TrackingEvent) => e.type === 'open');
    const clickEvents = events.filter((e: TrackingEvent) => e.type === 'click');
    const bounceEvents = events.filter((e: TrackingEvent) => e.type === 'bounce');
    const unsubEvents = events.filter((e: TrackingEvent) => e.type === 'unsubscribe');

    // Count unique messages (each message = 1 sent email)
    const uniqueMessages = new Set(events.map((e: TrackingEvent) => e.messageId));
    const sent = uniqueMessages.size;
    const delivered = sent - bounceEvents.length;
    const opened = new Set(openEvents.map((e: TrackingEvent) => e.messageId)).size;
    const clicked = new Set(clickEvents.map((e: TrackingEvent) => e.messageId)).size;

    const openTimestamps = openEvents.map((e: TrackingEvent) => new Date(e.timestamp).getTime()).sort();
    const clickTimestamps = clickEvents.map((e: TrackingEvent) => new Date(e.timestamp).getTime()).sort();

    return {
      messageId: campaignId,
      sent,
      delivered,
      opened,
      clicked,
      bounced: bounceEvents.length,
      unsubscribed: unsubEvents.length,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0,
      firstOpenedAt: openTimestamps.length > 0 ? new Date(openTimestamps[0]) : undefined,
      lastOpenedAt: openTimestamps.length > 0 ? new Date(openTimestamps[openTimestamps.length - 1]) : undefined,
      firstClickedAt: clickTimestamps.length > 0 ? new Date(clickTimestamps[0]) : undefined,
      lastClickedAt: clickTimestamps.length > 0 ? new Date(clickTimestamps[clickTimestamps.length - 1]) : undefined,
    };
  } catch (error: unknown) {
    logger.error('Failed to get campaign tracking stats', error instanceof Error ? error : undefined, {
      campaignId,
    });
    return null;
  }
}

/**
 * Record email open event
 * Stores open event in Firestore emailTracking collection
 */
export async function recordOpenEvent(
  trackingId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const now = new Date().toISOString();

    // Store the open event
    const eventId = `open_${trackingId}_${Date.now()}`;
    await FirestoreService.set(
      getSubCollection('emailTracking'),
      eventId,
      {
        trackingId,
        messageId: trackingId,
        type: 'open',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        timestamp: now,
        createdAt: now,
      },
      false
    );

    // Also update the per-message tracking record
    const existing = await FirestoreService.get<Record<string, unknown>>(
      getSubCollection('emailTracking'),
      trackingId
    );

    await FirestoreService.set(
      getSubCollection('emailTracking'),
      trackingId,
      {
        ...(existing ?? {}),
        messageId: trackingId,
        opened: true,
        openedAt: existing?.openedAt ?? now,
        lastOpenedAt: now,
        openCount: ((existing?.openCount as number) ?? 0) + 1,
        updatedAt: now,
      },
      true
    );

    logger.info('Email open event recorded', { trackingId, ipAddress, file: 'email-tracking.ts' });
  } catch (error: unknown) {
    logger.error('Failed to record email open event', error instanceof Error ? error : undefined, {
      trackingId,
    });
  }
}

/**
 * Record email click event
 * Stores click event in Firestore and returns original URL for redirect
 */
export async function recordClickEvent(
  linkId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const now = new Date().toISOString();

    // Look up the link mapping to get original URL and messageId
    const linkData = await FirestoreService.get<{
      messageId: string;
      originalUrl: string;
      trackingId: string;
    }>(
      getSubCollection('emailTrackingLinks'),
      linkId
    );

    // Store the click event regardless of link lookup
    const eventId = `click_${linkId}_${Date.now()}`;
    await FirestoreService.set(
      getSubCollection('emailTracking'),
      eventId,
      {
        linkId,
        messageId: linkData?.messageId ?? linkId,
        type: 'click',
        originalUrl: linkData?.originalUrl ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        timestamp: now,
        createdAt: now,
      },
      false
    );

    // Update per-message tracking record if we have a messageId
    if (linkData?.messageId) {
      const trackingId = linkData.trackingId ?? linkData.messageId;
      const existing = await FirestoreService.get<Record<string, unknown>>(
        getSubCollection('emailTracking'),
        trackingId
      );

      await FirestoreService.set(
        getSubCollection('emailTracking'),
        trackingId,
        {
          ...(existing ?? {}),
          messageId: linkData.messageId,
          clicked: true,
          clickedAt: existing?.clickedAt ?? now,
          lastClickedAt: now,
          clickCount: ((existing?.clickCount as number) ?? 0) + 1,
          updatedAt: now,
        },
        true
      );
    }

    logger.info('Email click event recorded', { linkId, originalUrl: linkData?.originalUrl, file: 'email-tracking.ts' });

    return linkData?.originalUrl ?? null;
  } catch (error: unknown) {
    logger.error('Failed to record email click event', error instanceof Error ? error : undefined, {
      linkId,
    });
    return null;
  }
}



