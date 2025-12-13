import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * Store tracked link mapping
 * Called client-side to store link mappings in Firestore
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkId, messageId, originalUrl, organizationId } = body;

    if (!linkId || !messageId || !originalUrl || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store link mapping in Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trackedLinks`,
      linkId,
      {
        messageId,
        originalUrl,
        createdAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error storing tracked link:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}















