/**
 * Feature Toggle API Endpoint
 *
 * Allows the AI orchestrator to toggle feature visibility.
 * This endpoint is called when the AI decides to hide/show features
 * based on client preferences.
 *
 * POST /api/orchestrator/feature-toggle
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { FeatureToggleService } from '@/lib/orchestrator/feature-toggle-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FEATURE_CATEGORIES = [
  'command_center',
  'crm',
  'lead_gen',
  'outbound',
  'automation',
  'content_factory',
  'ai_workforce',
  'ecommerce',
  'analytics',
  'website',
  'settings',
] as const;

const toggleFeatureSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  action: z.enum(['hide_feature', 'show_feature', 'hide_category', 'show_category', 'reset']),
  featureId: z.string().optional(),
  category: z.enum(FEATURE_CATEGORIES).optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const rawBody: unknown = await request.json();
    const parsed = toggleFeatureSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { userId, action, featureId, category, reason } = parsed.data;

    switch (action) {
      case 'hide_feature': {
        if (!featureId) {
          return NextResponse.json(
            { error: 'featureId is required for hide_feature action' },
            { status: 400 }
          );
        }
        await FeatureToggleService.toggleFeature(
          featureId,
          'hidden',
          userId,
          reason
        );
        return NextResponse.json({
          success: true,
          message: `Hidden feature: ${featureId}`,
        });
      }

      case 'show_feature': {
        if (!featureId) {
          return NextResponse.json(
            { error: 'featureId is required for show_feature action' },
            { status: 400 }
          );
        }
        await FeatureToggleService.toggleFeature(
          featureId,
          'unconfigured',
          userId
        );
        return NextResponse.json({
          success: true,
          message: `Restored feature: ${featureId}`,
        });
      }

      case 'hide_category': {
        if (!category) {
          return NextResponse.json(
            { error: 'category is required for hide_category action' },
            { status: 400 }
          );
        }
        await FeatureToggleService.toggleCategory(category, true, userId);
        return NextResponse.json({
          success: true,
          message: `Hidden category: ${category}`,
        });
      }

      case 'show_category': {
        if (!category) {
          return NextResponse.json(
            { error: 'category is required for show_category action' },
            { status: 400 }
          );
        }
        await FeatureToggleService.toggleCategory(category, false, userId);
        return NextResponse.json({
          success: true,
          message: `Restored category: ${category}`,
        });
      }

      case 'reset': {
        await FeatureToggleService.resetToDefault(userId);
        return NextResponse.json({
          success: true,
          message: 'Reset all feature visibility to default',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Feature toggle error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to toggle feature', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // MAJ-42: Feature toggle GET requires authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const settings = await FeatureToggleService.getVisibilitySettings();
    const navigation = await FeatureToggleService.getFilteredNavigation();
    const hiddenCount = await FeatureToggleService.getHiddenCount();

    return NextResponse.json({
      settings,
      navigation,
      hiddenCount,
    });
  } catch (error) {
    logger.error('Feature toggle fetch error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch feature settings' },
      { status: 500 }
    );
  }
}
