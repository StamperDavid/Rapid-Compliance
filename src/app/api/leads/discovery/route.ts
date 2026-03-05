/**
 * Discovery API — Start batch, List batches
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  startDiscoveryBatch,
  listDiscoveryBatches,
} from '@/lib/services/discovery-service';

export const dynamic = 'force-dynamic';

const startBatchSchema = z.object({
  icpProfileId: z.string().min(1),
  searchCriteria: z.object({
    keywords: z.array(z.string().min(1)).min(1, 'At least one keyword required'),
    companyNames: z.array(z.string()).optional(),
    domains: z.array(z.string()).optional(),
    maxResults: z.number().int().min(1).max(100).default(20),
  }),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const batches = await listDiscoveryBatches();
    return NextResponse.json({ batches });
  } catch (error: unknown) {
    logger.error('Failed to list discovery batches', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list discovery batches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = startBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const batch = await startDiscoveryBatch(
      parsed.data.icpProfileId,
      parsed.data.searchCriteria,
      authResult.user.uid
    );

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start discovery';
    logger.error('Failed to start discovery batch', error instanceof Error ? error : new Error(String(error)));
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
