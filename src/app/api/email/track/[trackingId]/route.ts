import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * Email Tracking Pixel
 * This endpoint is called by email clients to load the tracking pixel
 * No authentication required (public endpoint for email tracking)
 * But we validate the trackingId format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  // Rate limiting (very high limit for tracking pixels)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/track');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const trackingId = params.trackingId;

    // Basic validation - trackingId should be alphanumeric with dashes
    if (!trackingId || !/^[a-zA-Z0-9\-_]+$/.test(trackingId)) {
      // Still return pixel to avoid breaking email clients
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      return new NextResponse(pixel, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
        },
      });
    }

    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded ?? realIp ?? 'unknown';
    const userAgent = request.headers.get('user-agent') ?? 'unknown';

    // Fire and forget - try to record tracking event
    FirestoreService.set(
      'emailTrackingEvents',
      `${trackingId}_${Date.now()}`,
      {
        trackingId,
        opened: true,
        openedAt: new Date().toISOString(),
        ipAddress,
        userAgent,
      },
      false
    ).catch((error) => {
      logger.error('Error recording email open', error, { route: '/api/email/track' });
      // Silently fail - don't break email tracking
    });

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (_error) {
    // Still return pixel even on error to avoid breaking email clients
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
      },
    });
  }
}
