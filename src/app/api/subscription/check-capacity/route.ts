import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { RecordCounter } from '@/lib/subscription/record-counter';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * POST: Check if adding records would exceed tier capacity
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { organizationId, additionalRecords } = body;

    if (!organizationId || typeof additionalRecords !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check capacity
    const result = await RecordCounter.canAddRecords(
      organizationId,
      additionalRecords
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('[API] Error checking capacity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check capacity' },
      { status: 500 }
    );
  }
}

