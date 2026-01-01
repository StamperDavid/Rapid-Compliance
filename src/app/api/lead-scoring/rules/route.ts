/**
 * API Route: Scoring Rules Management
 * 
 * GET    /api/lead-scoring/rules - List scoring rules
 * POST   /api/lead-scoring/rules - Create new scoring rules
 * PUT    /api/lead-scoring/rules - Update scoring rules
 * DELETE /api/lead-scoring/rules - Delete scoring rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase/admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import type { ScoringRules } from '@/types/lead-scoring';
import { DEFAULT_SCORING_RULES } from '@/types/lead-scoring';

/**
 * GET /api/lead-scoring/rules
 * 
 * List all scoring rules for organization
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

    const token = authHeader.substring(7);
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Get all scoring rules for organization
    const rulesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/scoringRules',
      { orgId: organizationId }
    );
    const snapshot = await rulesRef.orderBy('createdAt', 'desc').get();

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

    const token = authHeader.substring(7);
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);
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
    // Generate a new document ID
    const rulesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/scoringRules',
      { orgId: organizationId }
    );
    const rulesId = rulesRef.doc().id;

    // If this is set to active, deactivate all other rules
    if (rulesData.isActive) {
      const rulesRef = adminDal.getNestedCollection(
        'organizations/{orgId}/scoringRules',
        { orgId: organizationId }
      );
      const existingSnapshot = await rulesRef.where('isActive', '==', true).get();

      const batch = adminDal.batch();
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

    const rulesDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/scoringRules/{rulesId}',
      { orgId: organizationId, rulesId }
    );

    await rulesDocRef.set({
      ...rules,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);

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
      const rulesRef = adminDal.getNestedCollection(
        'organizations/{orgId}/scoringRules',
        { orgId: organizationId }
      );
      const existingSnapshot = await rulesRef.where('isActive', '==', true).get();

      const batch = adminDal.batch();
      existingSnapshot.docs.forEach((doc) => {
        if (doc.id !== rulesId) {
          batch.update(doc.ref, { isActive: false });
        }
      });
      await batch.commit();
    }

    const rulesDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/scoringRules/{rulesId}',
      { orgId: organizationId, rulesId }
    );

    await rulesDocRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
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

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const rulesId = searchParams.get('rulesId');

    if (!organizationId || !rulesId) {
      return NextResponse.json(
        { success: false, error: 'organizationId and rulesId are required' },
        { status: 400 }
      );
    }

    const rulesDocRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/scoringRules/{rulesId}',
      { orgId: organizationId, rulesId }
    );

    await rulesDocRef.delete();

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
