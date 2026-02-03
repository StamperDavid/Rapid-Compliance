import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLeads, createLead, type Lead } from '@/lib/crm/lead-service';

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

export async function GET(
  request: NextRequest
) {
  try {
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
    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { workspaceId, leadData } = bodyResult.data;
    // Cast to the expected type - service layer handles full validation
    const leadInput = leadData as unknown as Omit<Lead, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>;
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
