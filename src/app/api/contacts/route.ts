import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContacts, deleteContact } from '@/lib/crm/contact-service';
import { logger } from '@/lib/logger/logger';

const querySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  company: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(50),
});

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  workspaceId: z.string().optional().default('default'),
});

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      workspaceId: searchParams.get('workspaceId') ?? undefined,
      company: searchParams.get('company') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { workspaceId, company, pageSize } = queryResult.data;
    const filters = company ? { company } : undefined;
    const pagination = { pageSize };

    const result = await getContacts(workspaceId, filters, pagination);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch contacts';
    logger.error('Failed to fetch contacts', error instanceof Error ? error : new Error(String(error)));
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
      ids.map(id => deleteContact(id, workspaceId))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error(`Failed to delete ${failed.length}/${ids.length} contacts`);
    }

    return NextResponse.json({
      deleted: ids.length - failed.length,
      failed: failed.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete contacts';
    logger.error('Failed to delete contacts:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
