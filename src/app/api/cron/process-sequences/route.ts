/**
 * Cron Job: Process Email Sequences
 * Runs every hour to process scheduled sequence steps
 * 
 * Setup in Vercel:
 * - Add vercel.json with cron configuration
 * - Protect this endpoint with CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { processSequences } from '@/lib/outbound/sequence-scheduler';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Processing sequences...');

    // Process all due sequences
    const result = await processSequences();

    console.log(`[Cron] Completed: ${result.processed} processed, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Fatal error processing sequences:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Allow both GET and POST (Vercel crons use GET, some systems use POST)
export const POST = GET;













