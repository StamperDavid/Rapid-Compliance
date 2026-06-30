import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContacts, createContact, deleteContact } from '@/lib/crm/contact-service';
import { resolveRequestFilters } from '@/lib/crm/saved-views-service';
import { applyViewFilters, FILTER_FETCH_CAP } from '@/lib/crm/apply-view-filters';
import { logger } from '@/lib/logger/logger';
import { requireAuth, requireRole } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  company: z.string().optional(),
  pageSize: z.coerce.number().int().positive().optional().default(50),
  // Saved-view / inline filtering (Saved Views feature).
  viewId: z.string().optional(),
  filters: z.string().optional(),
  match: z.enum(['all', 'any']).optional(),
});

const createContactSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  linkedInUrl: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  website: z.string().url().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  isVIP: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
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
    const queryResult = querySchema.safeParse({
      company: searchParams.get('company') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      viewId: searchParams.get('viewId') ?? undefined,
      filters: searchParams.get('filters') ?? undefined,
      match: searchParams.get('match') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { company, pageSize, viewId, filters: filtersJson, match } = queryResult.data;
    const baseFilters = company ? { company } : undefined;

    // Saved-view / inline filtering: fetch a broad set and filter in-process so
    // the rows returned actually reflect the view, not just the first page.
    const resolved = (viewId || filtersJson)
      ? await resolveRequestFilters({ viewId, filtersJson, match })
      : null;

    if (resolved && resolved.filters.length > 0) {
      const broad = await getContacts(baseFilters, { pageSize: FILTER_FETCH_CAP });
      const filtered = applyViewFilters(broad.data, resolved.filters, resolved.match);
      return NextResponse.json({ data: filtered, total: filtered.length, hasMore: false, lastDoc: null });
    }

    const result = await getContacts(baseFilters, { pageSize });

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

export async function POST(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createContactSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const contactData = bodyResult.data;
    const contact = await createContact(contactData);

    return NextResponse.json({ success: true, contact }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create contact';
    logger.error('Failed to create contact', error instanceof Error ? error : new Error(String(error)));
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
    const authResult = await requireRole(request, ['owner', 'admin', 'manager']);
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

    const { ids } = bodyResult.data;
    const results = await Promise.allSettled(
      ids.map(id => deleteContact(id))
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
