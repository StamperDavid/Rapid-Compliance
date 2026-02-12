import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLeads, createLead, deleteLead, type Lead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const getQuerySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  status: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(50),
});

const leadDataSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  companyName: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  score: z.number().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

const postBodySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  leadData: leadDataSchema,
});

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  workspaceId: z.string().optional().default('default'),
});

export async function GET(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const queryResult = getQuerySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { workspaceId, status, pageSize } = queryResult.data;
    const filters = status && status !== 'all' ? { status } : undefined;
    const pagination = { pageSize };

    const result = await getLeads(workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Failed to fetch leads:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch leads';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { workspaceId, leadData } = bodyResult.data;
    // Build type-safe lead input from validated Zod data
    const leadInput: Omit<Lead, 'id' | 'workspaceId' | 'createdAt'> = {
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      email: leadData.email,
      phone: leadData.phone,
      company: leadData.company,
      companyName: leadData.companyName,
      title: leadData.title,
      status: (leadData.status as Lead['status']) ?? 'new',
      score: leadData.score,
      source: leadData.source,
      ownerId: leadData.ownerId,
      tags: leadData.tags,
      customFields: leadData.customFields,
    };
    const result = await createLead(leadInput, workspaceId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Failed to create lead:', error);
    const message = error instanceof Error ? error.message : 'Failed to create lead';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = deleteBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { ids, workspaceId } = bodyResult.data;
    const results = await Promise.allSettled(
      ids.map(id => deleteLead(id, workspaceId))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error(`Failed to delete ${failed.length}/${ids.length} leads`);
    }

    return NextResponse.json({
      deleted: ids.length - failed.length,
      failed: failed.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete leads';
    logger.error('Failed to delete leads:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
