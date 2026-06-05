import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface ProposalTemplateRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * GET /api/proposals/templates/[id] - Get a single proposal template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const template = await AdminFirestoreService.get<ProposalTemplateRecord>(
      getSubCollection('proposalTemplates'),
      id
    );

    if (!template) {
      return NextResponse.json({ error: 'Proposal template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch proposal template';
    logger.error('Failed to fetch proposal template', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/proposals/templates/[id] - Delete a proposal template
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

    const existing = await AdminFirestoreService.get<ProposalTemplateRecord>(
      getSubCollection('proposalTemplates'),
      id
    );

    if (!existing) {
      return NextResponse.json({ error: 'Proposal template not found' }, { status: 404 });
    }

    await AdminFirestoreService.delete(getSubCollection('proposalTemplates'), id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete proposal template';
    logger.error('Failed to delete proposal template', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
