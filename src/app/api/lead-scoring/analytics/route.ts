/**
 * API Route: Lead Scoring Analytics
 * 
 * GET /api/lead-scoring/analytics
 * 
 * Provides aggregated analytics on lead scores
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import type { Timestamp } from 'firebase-admin/firestore';
import adminApp from '@/lib/firebase/admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import type { LeadScoreAnalytics, StoredLeadScore, IntentSignalType } from '@/types/lead-scoring';

// Interface for Firestore timestamp conversion
interface FirestoreLeadScore extends Omit<StoredLeadScore, 'metadata'> {
  metadata: {
    scoredAt: Timestamp | string | Date;
    expiresAt: Timestamp | string | Date;
    version: string;
    algorithmVersion: string;
    dataQuality: number;
    sources: string[];
    cached?: boolean;
  };
}

// Helper to convert Firestore timestamp to Date
function toDate(value: Timestamp | string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  // Firestore Timestamp
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date();
}

/**
 * GET /api/lead-scoring/analytics
 * 
 * Get lead scoring analytics for organization
 */
export async function GET(req: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parse date range (default: last 30 days)
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    logger.info('Generating lead scoring analytics', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Get all lead scores in date range
    const scoresRef = adminDal.getNestedCollection(
      'organizations/rapid-compliance-root/leadScores'
    );
    const snapshot = await scoresRef.get();

    const scores = snapshot.docs
      .map((doc) => {
        const data = doc.data() as FirestoreLeadScore;
        return {
          ...data,
          metadata: {
            ...data.metadata,
            scoredAt: toDate(data.metadata.scoredAt),
            expiresAt: toDate(data.metadata.expiresAt),
          },
        };
      })
      .filter((score) => {
        const scoredAt = score.metadata.scoredAt;
        return scoredAt >= startDate && scoredAt <= endDate;
      });

    // Calculate distribution
    const distribution = {
      gradeA: scores.filter((s) => s.grade === 'A').length,
      gradeB: scores.filter((s) => s.grade === 'B').length,
      gradeC: scores.filter((s) => s.grade === 'C').length,
      gradeD: scores.filter((s) => s.grade === 'D').length,
      gradeF: scores.filter((s) => s.grade === 'F').length,
    };

    // Calculate priority distribution
    const priorities = {
      hot: scores.filter((s) => s.priority === 'hot').length,
      warm: scores.filter((s) => s.priority === 'warm').length,
      cold: scores.filter((s) => s.priority === 'cold').length,
    };

    // Calculate average scores
    const totalScores = scores.length;
    const averageScores = {
      total: totalScores > 0 ? scores.reduce((sum, s) => sum + s.totalScore, 0) / totalScores : 0,
      companyFit:
        totalScores > 0 ? scores.reduce((sum, s) => sum + s.breakdown.companyFit, 0) / totalScores : 0,
      personFit:
        totalScores > 0 ? scores.reduce((sum, s) => sum + s.breakdown.personFit, 0) / totalScores : 0,
      intentSignals:
        totalScores > 0 ? scores.reduce((sum, s) => sum + s.breakdown.intentSignals, 0) / totalScores : 0,
      engagement:
        totalScores > 0 ? scores.reduce((sum, s) => sum + s.breakdown.engagement, 0) / totalScores : 0,
    };

    // Calculate top signals
    const signalCounts = new Map<IntentSignalType, { count: number; totalPoints: number }>();
    scores.forEach((score) => {
      score.detectedSignals.forEach((signal) => {
        const current = signalCounts.get(signal.type) ?? { count: 0, totalPoints: 0 };
        signalCounts.set(signal.type, {
          count: current.count + 1,
          totalPoints: current.totalPoints + signal.points,
        });
      });
    });

    const topSignals = Array.from(signalCounts.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        avgPoints: data.totalPoints / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate trends (daily aggregates)
    const trendsMap = new Map<string, { sum: number; count: number }>();
    scores.forEach((score) => {
      const scoredAtDate = score.metadata.scoredAt;
      const dateKey = scoredAtDate.toISOString().split('T')[0] ?? '';
      const current = trendsMap.get(dateKey) ?? { sum: 0, count: 0 };
      trendsMap.set(dateKey, {
        sum: current.sum + score.totalScore,
        count: current.count + 1,
      });
    });

    const trends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        avgScore: data.sum / data.count,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const analytics: LeadScoreAnalytics = {
      period: {
        start: startDate,
        end: endDate,
      },
      distribution,
      priorities,
      averageScores: {
        total: Math.round(averageScores.total),
        companyFit: Math.round(averageScores.companyFit),
        personFit: Math.round(averageScores.personFit),
        intentSignals: Math.round(averageScores.intentSignals),
        engagement: Math.round(averageScores.engagement),
      },
      topSignals,
      trends,
    };

    return NextResponse.json({
      success: true,
      analytics,
      totalScores: scores.length,
    });
  } catch (error: unknown) {
    logger.error('Lead scoring analytics error', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
