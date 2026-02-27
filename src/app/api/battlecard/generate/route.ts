/**
 * API Route: Generate Battlecard
 * 
 * POST /api/battlecard/generate
 * 
 * Generate a competitive battlecard comparing our product vs. competitor
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { discoverCompetitor, generateBattlecard } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSeoResearchCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const BattlecardOptionsSchema = z.object({
  ourProduct: z.string(),
  ourCompanyInfo: z.object({
    strengths: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    pricing: z.string().optional(),
    targetMarket: z.array(z.string()).optional(),
  }).optional(),
  focusAreas: z.array(z.enum(['features', 'pricing', 'positioning', 'objections'])).optional(),
  includeAdvanced: z.boolean().optional(),
});

const GenerateBattlecardSchema = z.object({
  competitorDomain: z.string().min(1),
  options: BattlecardOptionsSchema,
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = GenerateBattlecardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { competitorDomain, options } = parsed.data;

    logger.info('API: Generate battlecard request', {
      competitorDomain,
      ourProduct: options.ourProduct,
    });

    // Step 1: Discover competitor (uses cache if available)
    const competitorProfile = await discoverCompetitor(competitorDomain);

    // Step 2: Generate battlecard
    const battlecard = await generateBattlecard(competitorProfile, options);

    // Fire-and-forget: persist battlecard to Firestore
    if (adminDb) {
      const cleanDomain = competitorDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
      adminDb.collection(getSeoResearchCollection()).add({
        type: 'battlecard',
        domain: cleanDomain,
        data: JSON.parse(JSON.stringify(battlecard)) as Record<string, unknown>,
        tags: [battlecard.competitorName, options.ourProduct].filter(Boolean),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: authResult.user.uid,
      }).catch((persistErr: unknown) => {
        logger.warn('Failed to persist battlecard', {
          domain: cleanDomain,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      });
    }

    return NextResponse.json({
      success: true,
      battlecard,
      competitorProfile,
    });
  } catch (error) {
    logger.error('API: Failed to generate battlecard', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
