import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledWorkflows } from '@/lib/workflows/triggers/schedule-trigger';

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
    console.error('Error executing scheduled workflows:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute scheduled workflows' },
      { status: 500 }
    );
  }
}











