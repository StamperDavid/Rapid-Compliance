/**
 * Admin Provisioner API Endpoint
 *
 * Runs the database provisioner to create system documents.
 * Uses Firebase Admin SDK to bypass security rules.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { runProvisioner, getLastProvisionReport } from '@/lib/db/provisioner';
import { logger } from '@/lib/logger/logger';

/**
 * POST - Run the provisioner
 */
export async function POST(request: NextRequest) {
  try {
    // Require super_admin role
    const authResult = await requireRole(request, ['super_admin']);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    logger.info('[Provisioner API] Starting provisioning', {
      triggeredBy: user.email,
      uid: user.uid,
      file: 'provision/route.ts',
    });

    const report = await runProvisioner();

    logger.info('[Provisioner API] Provisioning complete', {
      ...report.summary,
      triggeredBy: user.email,
      file: 'provision/route.ts',
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Provisioner API] Error', error instanceof Error ? error : new Error(String(error)), { file: 'provision/route.ts' });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get last provision report
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    const authResult = await requireRole(request, ['super_admin', 'admin']);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const report = getLastProvisionReport();

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Provisioner API] Error', error instanceof Error ? error : new Error(String(error)), { file: 'provision/route.ts' });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
