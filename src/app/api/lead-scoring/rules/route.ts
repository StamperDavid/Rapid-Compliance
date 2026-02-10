/**
 * API Route: Scoring Rules Management
 * 
 * GET    /api/lead-scoring/rules - List scoring rules
 * POST   /api/lead-scoring/rules - Create new scoring rules
 * PUT    /api/lead-scoring/rules - Update scoring rules
 * DELETE /api/lead-scoring/rules - Delete scoring rules
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { type Timestamp, FieldValue } from 'firebase-admin/firestore';
import adminApp from '@/lib/firebase/admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import { type ScoringRules, DEFAULT_SCORING_RULES } from '@/types/lead-scoring';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// Interface for Firestore scoring rules data
interface FirestoreScoringRulesData {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  [key: string]: unknown;
}

// Zod schemas for request validation
const createRulesSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateRulesSchema = z.object({
  rulesId: z.string().min(1),
  isActive: z.boolean().optional(),
});

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

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);


    // Get all scoring rules for organization
    const rulesRef = adminDal.getNestedCollection(
      getSubCollection('scoringRules')
    );
    const snapshot = await rulesRef.orderBy('createdAt', 'desc').get();

    const rules = snapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreScoringRulesData;
      const createdAt = data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
        ? data.createdAt.toDate()
        : new Date();
      const updatedAt = data.updatedAt && typeof data.updatedAt === 'object' && 'toDate' in data.updatedAt
        ? data.updatedAt.toDate()
        : new Date();
      const scoringRules: ScoringRules = {
        ...DEFAULT_SCORING_RULES,
        id: data.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? false,
        createdAt,
        updatedAt,
        createdBy: data.createdBy ?? '',
      };
      return scoringRules;
    });

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: unknown) {
    logger.error('Failed to list scoring rules', error instanceof Error ? error : new Error(String(error)));

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

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);
    const userId = decodedToken.uid;

    const body: unknown = await req.json();
    const validation = createRulesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Name is required', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, isActive } = validation.data;

    const now = new Date();
    // Generate a new document ID
    const rulesRef = adminDal.getNestedCollection(
      getSubCollection('scoringRules')
    );
    const rulesId = rulesRef.doc().id;

    // If this is set to active, deactivate all other rules
    if (isActive) {
      const existingRulesRef = adminDal.getNestedCollection(
        getSubCollection('scoringRules')
      );
      const existingSnapshot = await existingRulesRef.where('isActive', '==', true).get();

      const batch = adminDal.batch();
      existingSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isActive: false });
      });
      await batch.commit();
    }

    const rules: ScoringRules = {
      ...DEFAULT_SCORING_RULES,
      id: rulesId,
      name,
      description,
      isActive: isActive ?? false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    const rulesDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('scoringRules')}/{rulesId}`,
      { rulesId }
    );

    await rulesDocRef.set({
      ...rules,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Created scoring rules', {
      rulesId,
      userId,
    });

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: unknown) {
    logger.error('Failed to create scoring rules', error instanceof Error ? error : new Error(String(error)));

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

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);

    const body: unknown = await req.json();
    const validation = updateRulesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Rules ID is required', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { rulesId, isActive } = validation.data;

    // If setting to active, deactivate others
    if (isActive) {
      const existingRulesRef = adminDal.getNestedCollection(
        getSubCollection('scoringRules')
      );
      const existingSnapshot = await existingRulesRef.where('isActive', '==', true).get();

      const batch = adminDal.batch();
      existingSnapshot.docs.forEach((doc) => {
        if (doc.id !== rulesId) {
          batch.update(doc.ref, { isActive: false });
        }
      });
      await batch.commit();
    }

    const rulesDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('scoringRules')}/{rulesId}`,
      { rulesId }
    );

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    await rulesDocRef.update(updateData);

    logger.info('Updated scoring rules', { rulesId });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    logger.error('Failed to update scoring rules', error instanceof Error ? error : new Error(String(error)));

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

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    await getAuth(adminApp).verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const rulesId = searchParams.get('rulesId');

    if (!rulesId) {
      return NextResponse.json(
        { success: false, error: 'rulesId is required' },
        { status: 400 }
      );
    }

    const rulesDocRef = adminDal.getNestedDocRef(
      `${getSubCollection('scoringRules')}/{rulesId}`,
      { rulesId }
    );

    await rulesDocRef.delete();

    logger.info('Deleted scoring rules', { rulesId });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    logger.error('Failed to delete scoring rules', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
