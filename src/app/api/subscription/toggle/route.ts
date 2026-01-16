/**
 * Toggle Feature API Route
 * POST /api/subscription/toggle
 * Enable/disable specific outbound features
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import type { OrganizationSubscription } from '@/types/subscription';

// Valid outbound feature keys
const OUTBOUND_FEATURES = [
  'aiEmailWriter',
  'emailSequences',
  'emailReplyHandler',
  'meetingScheduler',
  'prospectFinder',
  'multiChannel',
  'abTesting',
  'advanced'
] as const;

// Zod schema for feature toggle request
const ToggleFeatureSchema = z.object({
  orgId: z.string().min(1, 'Organization ID required'),
  feature: z.enum(OUTBOUND_FEATURES),
  enabled: z.boolean({ required_error: 'Enabled must be a boolean' }),
});

type OutboundFeatureKey = keyof OrganizationSubscription['outboundFeatures'];

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription/toggle');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = ToggleFeatureSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message ?? 'Invalid request';
      return errors.badRequest(firstError);
    }

    const { orgId, feature, enabled } = parseResult.data;

    // Toggle feature (cast validated feature to expected type)
    await FeatureGate.toggleFeature(orgId, feature as OutboundFeatureKey, enabled);

    // Get updated subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      message: `${feature} ${enabled ? 'enabled' : 'disabled'}`,
      subscription,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error toggling feature', { error: errorMessage, route: '/api/subscription/toggle' });
    return errors.database('Failed to toggle feature', error instanceof Error ? error : undefined);
  }
}



















