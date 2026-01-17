import { type NextRequest, NextResponse } from 'next/server';
import { RecordCounter } from '@/lib/subscription/record-counter';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

// Strict validation schema for capacity check (revenue critical)
const checkCapacitySchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  additionalRecords: z.number().int().min(0, 'Additional records must be a non-negative integer'),
});

/**
 * POST: Check if adding records would exceed tier capacity
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    // Validate request body with strict typing
    const validation = checkCapacitySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { organizationId, additionalRecords } = validation.data;

    // Check capacity
    const result = await RecordCounter.canAddRecords(
      organizationId,
      additionalRecords
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logger.error('[API] Error checking capacity:', error instanceof Error ? error : new Error(String(error)), { route: '/api/subscription/check-capacity' });
    return NextResponse.json(
      { success: false, error: 'Failed to check capacity' },
      { status: 500 }
    );
  }
}

