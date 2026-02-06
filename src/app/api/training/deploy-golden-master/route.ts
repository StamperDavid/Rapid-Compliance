/**
 * API endpoint to deploy a Golden Master version to production
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { deployGoldenMaster } from '@/lib/training/golden-master-updater';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

const DeployGoldenMasterSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  goldenMasterId: z.string().min(1, 'Golden Master ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/deploy-golden-master');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    // Parse and validate request
    const body: unknown = await request.json();
    const parseResult = DeployGoldenMasterSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }
    const { organizationId, goldenMasterId } = parseResult.data;

    // Verify access
    if (DEFAULT_ORG_ID !== organizationId) {
      return errors.forbidden('Access denied');
    }

    // Deploy the Golden Master
    await deployGoldenMaster(organizationId, goldenMasterId);

    return NextResponse.json({
      success: true,
      message: 'Golden Master deployed to production',
    });
  } catch (error: unknown) {
    logger.error('Error deploying Golden Master', error instanceof Error ? error : new Error(String(error)), { route: '/api/training/deploy-golden-master' });
    return errors.database('Failed to deploy Golden Master', error instanceof Error ? error : undefined);
  }
}



















