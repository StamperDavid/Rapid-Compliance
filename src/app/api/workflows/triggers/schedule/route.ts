import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledWorkflows } from '@/lib/workflows/triggers/schedule-trigger';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

/**
 * Schedule trigger endpoint
 * Called by Cloud Scheduler or cron job to execute scheduled workflows
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called by Cloud Scheduler (check headers/auth)
    // In production, verify Cloud Scheduler authentication
    
    await executeScheduledWorkflows();
    
    return NextResponse.json({
      success: true,
      message: 'Scheduled workflows executed',
    });
  } catch (error: any) {
    logger.error('Error executing scheduled workflows', error, { route: '/api/workflows/triggers/schedule' });
    return errors.internal('Failed to execute scheduled workflows', error);
  }
}



















