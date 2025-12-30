/**
 * API Route: Scoring Rules Management
 * 
 * GET    /api/lead-scoring/rules - List scoring rules
 * POST   /api/lead-scoring/rules - Create new scoring rules
 * PUT    /api/lead-scoring/rules - Update scoring rules
 * DELETE /api/lead-scoring/rules - Delete scoring rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';
import type { ScoringRules } from '@/types/lead-scoring';
import { DEFAULT_SCORING_RULES } from '@/types/lead-scoring';

/**
 * GET /api/lead-scoring/rules
 * 
 * List all scoring rules for organization
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Get all scoring rules for organization
    const snapshot = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('scoringRules')
      .orderBy('createdAt', 'desc')
      .get();

    const rules = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ScoringRules;
    });

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error) {
    logger.error('Failed to list scoring rules', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lead-scoring/rules
 * 
 * Create new scoring rules
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { organizationId, name, description, ...rulesData } = body;

    if (!organizationId || !name) {
      return NextResponse.json(
        { success: false, error: 'organizationId and name are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const rulesId = db.collection('organizations').doc().id;

    // If this is set to active, deactivate all other rules
    if (rulesData.isActive) {
      const existingSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('scoringRules')
        .where('isActive', '==', true)
        .get();

      const batch = db.batch();
      existingSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isActive: false });
      });
      await batch.commit();
    }

    const rules: ScoringRules = {
      id: rulesId,
      organizationId,
      name,
      description,
      ...DEFAULT_SCORING_RULES,
      ...rulesData,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('scoringRules')
      .doc(rulesId)
      .set({
        ...rules,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

    logger.info('Created scoring rules', {
      rulesId,
      organizationId,
      userId,
    });

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error) {
    logger.error('Failed to create scoring rules', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/lead-scoring/rules
 * 
 * Update existing scoring rules
 */
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    await auth.verifyIdToken(token);

    const body = await req.json();
    const { organizationId, rulesId, ...updates } = body;

    if (!organizationId || !rulesId) {
      return NextResponse.json(
        { success: false, error: 'organizationId and rulesId are required' },
        { status: 400 }
      );
    }

    // If setting to active, deactivate others
    if (updates.isActive) {
      const existingSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('scoringRules')
        .where('isActive', '==', true)
        .get();

      const batch = db.batch();
      existingSnapshot.docs.forEach((doc) => {
        if (doc.id !== rulesId) {
          batch.update(doc.ref, { isActive: false });
        }
      });
      await batch.commit();
    }

    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('scoringRules')
      .doc(rulesId)
      .update({
        ...updates,
        updatedAt: Timestamp.now(),
      });

    logger.info('Updated scoring rules', { rulesId, organizationId });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to update scoring rules', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lead-scoring/rules
 * 
 * Delete scoring rules
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    await auth.verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const rulesId = searchParams.get('rulesId');

    if (!organizationId || !rulesId) {
      return NextResponse.json(
        { success: false, error: 'organizationId and rulesId are required' },
        { status: 400 }
      );
    }

    await db
      .collection('organizations')
      .doc(organizationId)
      .collection('scoringRules')
      .doc(rulesId)
      .delete();

    logger.info('Deleted scoring rules', { rulesId, organizationId });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to delete scoring rules', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
