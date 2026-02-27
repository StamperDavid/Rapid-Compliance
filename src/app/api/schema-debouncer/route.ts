/**
 * Schema Change Debouncer API
 * Control debouncer behavior
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { SchemaChangeDebouncer } from '@/lib/schema/schema-change-debouncer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/schema-debouncer
 * Get debouncer status
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const debouncer = SchemaChangeDebouncer.getInstance();
    
    return NextResponse.json({
      success: true,
      debounceMs: debouncer.getDebounceMs(),
      pendingCount: debouncer.getPendingCount(),
    });
    
  } catch (error: unknown) {
    logger.error('[Debouncer API] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to get debouncer status' },
      { status: 500 }
    );
  }
}

const PostDebouncerSchema = z.object({
  action: z.enum(['flush', 'clear', 'set_debounce']),
  debounceMs: z.number().int().positive().optional(),
});

/**
 * POST /api/schema-debouncer
 * Control debouncer
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsed = PostDebouncerSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { action, debounceMs } = parsed.data;
    
    const debouncer = SchemaChangeDebouncer.getInstance();
    
    switch (action) {
      case 'flush':
        await debouncer.flush();
        return NextResponse.json({
          success: true,
          message: 'All pending events flushed',
        });
      
      case 'clear':
        debouncer.clear();
        return NextResponse.json({
          success: true,
          message: 'All pending events cleared',
        });
      
      case 'set_debounce':
        if (debounceMs === undefined) {
          return NextResponse.json(
            { error: 'debounceMs is required for set_debounce action' },
            { status: 400 }
          );
        }
        debouncer.setDebounceMs(debounceMs);
        return NextResponse.json({
          success: true,
          message: `Debounce set to ${debounceMs}ms`,
        });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: flush, clear, or set_debounce' },
          { status: 400 }
        );
    }
    
  } catch (error: unknown) {
    logger.error('[Debouncer API] POST failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to control debouncer' },
      { status: 500 }
    );
  }
}



