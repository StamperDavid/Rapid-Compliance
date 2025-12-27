/**
 * Schema Change Debouncer API
 * Control debouncer behavior
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { SchemaChangeDebouncer } from '@/lib/schema/schema-change-debouncer';

/**
 * GET /api/schema-debouncer
 * Get debouncer status
 */
export async function GET(request: NextRequest) {
  try {
    const debouncer = SchemaChangeDebouncer.getInstance();
    
    return NextResponse.json({
      success: true,
      debounceMs: debouncer.getDebounceMs(),
      pendingCount: debouncer.getPendingCount(),
    });
    
  } catch (error) {
    logger.error('[Debouncer API] GET failed', error, {
      file: 'route.ts',
    });
    
    return NextResponse.json(
      { error: 'Failed to get debouncer status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema-debouncer
 * Control debouncer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, debounceMs } = body;
    
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
    
  } catch (error) {
    logger.error('[Debouncer API] POST failed', error, {
      file: 'route.ts',
    });
    
    return NextResponse.json(
      { error: 'Failed to control debouncer' },
      { status: 500 }
    );
  }
}


