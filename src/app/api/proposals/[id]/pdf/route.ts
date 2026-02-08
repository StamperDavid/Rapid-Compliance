/**
 * Proposal PDF Download Endpoint
 * GET /api/proposals/[id]/pdf - Download or redirect to proposal PDF
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
    }

    if (!adminDb) {
      logger.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Database connection unavailable' },
        { status: 500 }
      );
    }

    // Look up proposal in Firestore
    const proposalDoc = await adminDb
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('proposals')
      .doc(id)
      .get();

    if (!proposalDoc.exists) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = proposalDoc.data();
    const pdfUrl = proposal?.pdfUrl as string | undefined;
    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'PDF not yet generated for this proposal' },
        { status: 404 }
      );
    }

    // Redirect to the Firebase Storage URL
    return NextResponse.redirect(pdfUrl);
  } catch (error) {
    logger.error('Proposal PDF download failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to retrieve proposal PDF' },
      { status: 500 }
    );
  }
}
