/**
 * Custom HTML Email Template (single) API Route
 * DELETE: Remove a custom HTML template by ID from the `emailTemplates`
 * sub-collection via the Admin SDK.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getEmailTemplatesCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/email/html-templates/[id] - Delete a custom HTML template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await AdminFirestoreService.delete(getEmailTemplatesCollection(), id);

    logger.info('HTML template deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    logger.error('Failed to delete HTML template', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
