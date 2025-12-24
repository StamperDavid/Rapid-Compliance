import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { recordEmailOpen } from '@/lib/email/email-service';
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

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Look up tracking mapping to get organizationId and messageId
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    // Try to find the mapping - we need to search across organizations
    // In production, we should have a global mapping collection or encode orgId in trackingId
    // For now, we'll search the most common organization paths
    // Note: This is not efficient - in production, use a global mapping collection
    
    // Try to find mapping (this is a simplified approach - production should use a global mapping)
    // We'll store open events and process them later with proper org lookup
    // Or we can encode organizationId in the trackingId format
    
    // For now, record the open event - we'll need to update the tracking system
    // to store mappings when emails are sent
    const { recordEmailOpen } = await import('@/lib/email/email-service');
    
    // Try to extract organizationId from trackingId or search
    // If trackingId is a messageId, we can try to find it in organizations
    // For now, we'll record it generically and process later
    // In production, trackingId should map directly to organizationId
    
    // Fire and forget - try to record with org lookup
    // We'll need to update the email sending to store proper mappings
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
  } catch (error: any) {
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
