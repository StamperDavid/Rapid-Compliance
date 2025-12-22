/**
 * Lead Feedback API
 * Stores user feedback to improve lead quality over time
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, leadDomain, isGoodLead, timestamp } = body;
    
    if (!organizationId || !leadDomain || typeof isGoodLead !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Store feedback in Firestore
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/lead-feedback`,
      feedbackId,
      {
        leadDomain,
        isGoodLead,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      false
    );
    
    console.log(`[Lead Feedback] Saved feedback for ${leadDomain}: ${isGoodLead ? 'Good' : 'Bad'}`);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Lead Feedback] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

