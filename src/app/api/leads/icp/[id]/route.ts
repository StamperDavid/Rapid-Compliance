/**
 * ICP Profile API — Get, Update, Delete by ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { IcpProfileSchema } from '@/types/icp-profile';
import {
  getIcpProfile,
  updateIcpProfile,
  deleteIcpProfile,
} from '@/lib/services/icp-profile-service';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { id } = await context.params;
    const profile = await getIcpProfile(id);

    if (!profile) {
      return NextResponse.json({ error: 'ICP profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    logger.error('Failed to get ICP profile', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to get ICP profile' }, { status: 500 });
  }
}

const patchSchema = IcpProfileSchema.partial();

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const profile = await updateIcpProfile(id, parsed.data);
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update ICP profile';
    logger.error('Failed to update ICP profile', error instanceof Error ? error : new Error(String(error)));
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

const deleteSchema = z.object({
  confirm: z.literal(true),
}).optional();

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { id } = await context.params;

    // Optional confirmation body
    try {
      const body: unknown = await request.json();
      deleteSchema.parse(body);
    } catch {
      // No body is fine for DELETE
    }

    await deleteIcpProfile(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete ICP profile', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to delete ICP profile' }, { status: 500 });
  }
}
