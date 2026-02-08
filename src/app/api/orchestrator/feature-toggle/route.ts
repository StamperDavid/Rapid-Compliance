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
import { FeatureToggleService, type FeatureCategory } from '@/lib/orchestrator/feature-toggle-service';

interface ToggleFeatureRequest {
  userId?: string;
  action?: string;
  featureId?: string;
  category?: FeatureCategory;
  reason?: string;
}

function isToggleFeatureRequest(value: unknown): value is ToggleFeatureRequest {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isToggleFeatureRequest(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userId, action, featureId, category, reason } = body;

    // Validate required fields
    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, action' },
        { status: 400 }
      );
    }

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
    console.error('Feature toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle feature', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const settings = await FeatureToggleService.getVisibilitySettings();
    const navigation = await FeatureToggleService.getFilteredNavigation();
    const hiddenCount = await FeatureToggleService.getHiddenCount();

    return NextResponse.json({
      settings,
      navigation,
      hiddenCount,
    });
  } catch (error) {
    console.error('Feature toggle fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature settings' },
      { status: 500 }
    );
  }
}
