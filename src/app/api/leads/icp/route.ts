/**
 * ICP Profile API — List and Create
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { IcpProfileSchema } from '@/types/icp-profile';
import {
  createIcpProfile,
  listIcpProfiles,
} from '@/lib/services/icp-profile-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const profiles = await listIcpProfiles();
    return NextResponse.json({ profiles });
  } catch (error: unknown) {
    logger.error('Failed to list ICP profiles', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to list ICP profiles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = IcpProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ICP profile data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const profile = await createIcpProfile({
      ...parsed.data,
      feedbackStats: { positiveCount: 0, negativeCount: 0 },
      createdBy: authResult.user.uid,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create ICP profile', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to create ICP profile' }, { status: 500 });
  }
}
