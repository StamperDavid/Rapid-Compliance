/**
 * Public Unsubscribe API
 * POST /api/public/unsubscribe - Process email unsubscribe requests
 *
 * This is a public endpoint (no auth required) because recipients
 * clicking unsubscribe links are not logged-in users.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const unsubscribeSchema = z.object({
  contactId: z.string().min(1, 'contactId is required'),
  emailId: z.string().optional(),
  org: z.string().min(1, 'org is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Strict rate limiting for public endpoint
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/public/unsubscribe');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const rawBody: unknown = await request.json();
    const parsed = unsubscribeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { contactId, emailId, org } = parsed.data;

    // Verify org matches our platform
    if (org !== PLATFORM_ID) {
      return NextResponse.json({ error: 'Invalid organization' }, { status: 400 });
    }

    // Record the unsubscribe in the suppression list
    const suppressionId = `unsub_${contactId}_${Date.now()}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/suppressions`,
      suppressionId,
      {
        id: suppressionId,
        contactId,
        emailId: emailId ?? null,
        reason: 'unsubscribe',
        channel: 'email',
        unsubscribedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      false,
    );

    // Update contact preferences if the contact exists
    try {
      const contactPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`;
      const existingContact: unknown = await FirestoreService.get(contactPath, contactId);
      if (existingContact && typeof existingContact === 'object') {
        await FirestoreService.set(
          contactPath,
          contactId,
          {
            ...(existingContact as Record<string, unknown>),
            emailOptOut: true,
            emailOptOutDate: new Date().toISOString(),
          },
          false,
        );
      }
    } catch {
      // Contact may not exist in CRM - suppression record is the primary source of truth
      logger.debug('Contact not found for unsubscribe, suppression recorded', { contactId });
    }

    // Unenroll from active sequences
    try {
      const { where } = await import('firebase/firestore');

      // Find prospects matching this contact
      const prospects = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/prospects`,
        [where('contactId', '==', contactId)],
      );

      for (const prospect of prospects) {
        if (typeof prospect === 'object' && prospect !== null && 'id' in prospect) {
          const prospectId = String((prospect as { id: string }).id);

          const enrollments = await FirestoreService.getAll(
            `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/enrollments`,
            [
              where('prospectId', '==', prospectId),
              where('status', '==', 'active'),
            ],
          );

          for (const enrollment of enrollments) {
            if (typeof enrollment === 'object' && enrollment !== null && 'id' in enrollment) {
              const enrollmentId = String((enrollment as { id: string }).id);
              await FirestoreService.set(
                `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/enrollments`,
                enrollmentId,
                {
                  ...(enrollment as Record<string, unknown>),
                  status: 'unsubscribed',
                  unsubscribedAt: new Date().toISOString(),
                },
                false,
              );
            }
          }
        }
      }
    } catch (error) {
      // Don't fail the unsubscribe if sequence unenrollment fails
      logger.error('Error unenrolling from sequences during unsubscribe',
        error instanceof Error ? error : new Error(String(error)));
    }

    logger.info('Contact unsubscribed', { contactId, emailId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Unsubscribe API error',
      error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 },
    );
  }
}
