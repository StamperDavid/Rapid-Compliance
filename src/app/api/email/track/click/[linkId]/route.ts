export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

interface TrackedLink {
  messageId: string;
  originalUrl: string;
  createdAt: string;
}

/**
 * Email Click Tracking Redirect
 * This endpoint is called when a user clicks a tracked link in an email
 * No authentication required (public endpoint for email tracking)
 * Records the click event and redirects to the original URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  // Rate limiting (high limit for tracking redirects)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/track/click');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { linkId } = await params;

    // Basic validation - linkId should be alphanumeric with underscores
    if (!linkId || !/^link_[a-zA-Z0-9_]+$/.test(linkId)) {
      return new NextResponse('Invalid link', { status: 400 });
    }

    // Look up the original URL from Firestore
    const linkData = await AdminFirestoreService.get(
      getSubCollection('trackedLinks'),
      linkId
    );

    if (!linkData) {
      logger.warn('Tracked link not found', { linkId, route: '/api/email/track/click' });
      return new NextResponse('Link not found', { status: 404 });
    }

    const trackedLink = linkData as unknown as TrackedLink;
    const { originalUrl, messageId } = trackedLink;

    // Extract IP address and user agent for tracking
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded ?? realIp ?? 'unknown';
    const userAgent = request.headers.get('user-agent') ?? 'unknown';

    // Fire and forget - record click event in Firestore
    AdminFirestoreService.set(
      'emailTrackingEvents',
      `${linkId}_${Date.now()}`,
      {
        linkId,
        messageId,
        clicked: true,
        clickedAt: new Date().toISOString(),
        ipAddress,
        userAgent,
        originalUrl,
      },
      false
    ).catch((error: unknown) => {
      logger.error('Error recording email click', error instanceof Error ? error : new Error(String(error)), {
        route: '/api/email/track/click',
        linkId,
        messageId
      });
      // Silently fail - don't break the redirect
    });

    // Update the emailTracking document to mark as clicked
    AdminFirestoreService.set(
      getSubCollection('emailTracking'),
      messageId,
      {
        clicked: true,
        clickedAt: new Date().toISOString(),
        lastClickedLinkId: linkId,
      },
      true // Merge to preserve existing fields
    ).catch((error: unknown) => {
      logger.error('Error updating email tracking', error instanceof Error ? error : new Error(String(error)), {
        route: '/api/email/track/click',
        messageId
      });
      // Silently fail - don't break the redirect
    });

    // Validate the original URL before redirecting
    let redirectUrl: string;
    try {
      const parsedUrl = new URL(originalUrl);
      // Only allow http and https protocols
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
      redirectUrl = originalUrl;
    } catch {
      logger.warn('Invalid original URL in tracked link', {
        linkId,
        originalUrl,
        route: '/api/email/track/click'
      });
      return new NextResponse('Invalid destination URL', { status: 400 });
    }

    // Redirect to the original URL (302 temporary redirect)
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error: unknown) {
    logger.error('Error processing click tracking', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/email/track/click'
    });
    return new NextResponse('Internal server error', { status: 500 });
  }
}
