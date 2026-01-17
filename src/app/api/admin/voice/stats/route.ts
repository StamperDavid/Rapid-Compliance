/**
 * Admin Voice Stats API
 * GET platform-wide voice call statistics
 * POST to update default AI agent settings
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import type { DocumentData, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// Default agent settings schema
const defaultSettingsSchema = z.object({
  greeting: z.string().min(1, 'Greeting is required').max(500),
  voiceId: z.string().min(1, 'Voice ID is required'),
  language: z.string().min(2, 'Language is required'),
  maxCallDuration: z.number().min(60).max(1800),
  qualificationThreshold: z.number().min(0).max(100),
  autoTransferEnabled: z.boolean(),
  recordingEnabled: z.boolean(),
});

interface VoiceStats {
  totalCalls: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  avgCallDuration: number;
  avgQualificationScore: number;
  transferRate: number;
  completionRate: number;
  totalMinutes: number;
  estimatedCost: number;
  byStatus: {
    completed: number;
    inProgress: number;
    failed: number;
    noAnswer: number;
  };
  byOutcome: {
    qualified: number;
    notQualified: number;
    callback: number;
    transferred: number;
  };
}

/**
 * Firestore document structure for voice metrics
 */
interface VoiceMetricsDocument extends DocumentData {
  totalCalls?: number;
  callsToday?: number;
  callsThisWeek?: number;
  callsThisMonth?: number;
  avgCallDuration?: number;
  avgQualificationScore?: number;
  transferRate?: number;
  completionRate?: number;
  totalMinutes?: number;
  estimatedCost?: number;
  byStatus?: {
    completed?: number;
    inProgress?: number;
    failed?: number;
    noAnswer?: number;
  };
  byOutcome?: {
    qualified?: number;
    notQualified?: number;
    callback?: number;
    transferred?: number;
  };
  updatedAt?: Timestamp;
}

/**
 * Request body for POST endpoint
 */
interface UpdateSettingsRequestBody {
  defaultSettings: unknown;
}

/**
 * Type guard to check if data matches VoiceMetricsDocument structure
 */
function isVoiceMetricsDocument(data: DocumentData | undefined): data is VoiceMetricsDocument {
  return data !== undefined && typeof data === 'object';
}

/**
 * GET /api/admin/voice/stats
 * Get platform-wide voice call statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    logger.info('[AdminVoiceStats] Fetching platform voice stats', {
      adminId: authResult.user.uid,
      file: 'admin/voice/stats/route.ts',
    });

    let stats: VoiceStats;

    // Try to fetch real stats from Firestore
    if (adminDb) {
      try {
        // Get aggregate stats from platform metrics collection
        const metricsDoc = await adminDb
          .collection('platform_metrics')
          .doc('voice_stats')
          .get();

        if (metricsDoc.exists) {
          const rawData = metricsDoc.data();

          // Type guard to ensure data is valid
          if (isVoiceMetricsDocument(rawData)) {
            const data: VoiceMetricsDocument = rawData;

            stats = {
              totalCalls: data.totalCalls ?? 0,
              callsToday: data.callsToday ?? 0,
              callsThisWeek: data.callsThisWeek ?? 0,
              callsThisMonth: data.callsThisMonth ?? 0,
              avgCallDuration: data.avgCallDuration ?? 0,
              avgQualificationScore: data.avgQualificationScore ?? 0,
              transferRate: data.transferRate ?? 0,
              completionRate: data.completionRate ?? 0,
              totalMinutes: data.totalMinutes ?? 0,
              estimatedCost: data.estimatedCost ?? 0,
              byStatus: {
                completed: data.byStatus?.completed ?? 0,
                inProgress: data.byStatus?.inProgress ?? 0,
                failed: data.byStatus?.failed ?? 0,
                noAnswer: data.byStatus?.noAnswer ?? 0,
              },
              byOutcome: {
                qualified: data.byOutcome?.qualified ?? 0,
                notQualified: data.byOutcome?.notQualified ?? 0,
                callback: data.byOutcome?.callback ?? 0,
                transferred: data.byOutcome?.transferred ?? 0,
              },
            };

            // Safely convert Firestore Timestamp to ISO string
            let lastUpdated: string;
            if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
              lastUpdated = data.updatedAt.toDate().toISOString();
            } else {
              lastUpdated = new Date().toISOString();
            }

            return NextResponse.json({
              success: true,
              stats,
              lastUpdated,
            });
          }
        }
      } catch (dbError) {
        logger.warn('[AdminVoiceStats] Failed to fetch from Firestore, using mock data', {
          file: 'admin/voice/stats/route.ts',
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
      }
    }

    // Return mock/demo stats if no real data available
    const now = new Date();
    const totalCalls = 15847;

    stats = {
      totalCalls,
      callsToday: 234,
      callsThisWeek: 1456,
      callsThisMonth: 5823,
      avgCallDuration: 187, // seconds
      avgQualificationScore: 72,
      transferRate: 23.4,
      completionRate: 89.2,
      totalMinutes: 49387,
      estimatedCost: 4938.70, // Based on $0.10/min average
      byStatus: {
        completed: 14128,
        inProgress: 12,
        failed: 423,
        noAnswer: 1284,
      },
      byOutcome: {
        qualified: 3842,
        notQualified: 8534,
        callback: 1245,
        transferred: 2226,
      },
    };

    return NextResponse.json({
      success: true,
      stats,
      lastUpdated: now.toISOString(),
      isDemo: true,
    });
  } catch (error) {
    logger.error('[AdminVoiceStats] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'admin/voice/stats/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/voice/stats
 * Update default AI agent settings (template for new orgs)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Parse and validate request body
    const rawBody: unknown = await request.json();

    // Type guard for request body structure
    if (
      typeof rawBody !== 'object' ||
      rawBody === null ||
      !('defaultSettings' in rawBody)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'defaultSettings is required',
        },
        { status: 400 }
      );
    }

    const body = rawBody as UpdateSettingsRequestBody;
    const validation = defaultSettingsSchema.safeParse(body.defaultSettings);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const defaultSettings = validation.data;

    logger.info('[AdminVoiceStats] Updating default agent settings', {
      adminId: authResult.user.uid,
      settings: JSON.stringify(defaultSettings),
      file: 'admin/voice/stats/route.ts',
    });

    // Save to Firestore if available
    if (adminDb) {
      try {
        await adminDb
          .collection('platform_settings')
          .doc('voice_agent_defaults')
          .set(
            {
              ...defaultSettings,
              updatedAt: new Date(),
              updatedBy: authResult.user.uid,
            },
            { merge: true }
          );

        logger.info('[AdminVoiceStats] Default settings saved to Firestore', {
          file: 'admin/voice/stats/route.ts',
        });

        return NextResponse.json({
          success: true,
          message: 'Default agent settings saved successfully',
          settings: defaultSettings,
        });
      } catch (dbError) {
        logger.error('[AdminVoiceStats] Failed to save to Firestore', dbError instanceof Error ? dbError : new Error(String(dbError)), {
          file: 'admin/voice/stats/route.ts',
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to save settings to database',
          },
          { status: 500 }
        );
      }
    }

    // If no database, return success for demo purposes
    return NextResponse.json({
      success: true,
      message: 'Default agent settings updated (demo mode - not persisted)',
      settings: defaultSettings,
      isDemo: true,
    });
  } catch (error) {
    logger.error('[AdminVoiceStats] POST failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'admin/voice/stats/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
