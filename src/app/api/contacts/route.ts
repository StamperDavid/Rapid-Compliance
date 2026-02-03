import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContacts } from '@/lib/crm/contact-service';
import { logger } from '@/lib/logger/logger';

const querySchema = z.object({
  workspaceId: z.string().optional().default('default'),
  company: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(50),
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
    logger.error('Failed to fetch contacts', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
