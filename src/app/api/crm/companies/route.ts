/**
 * Companies API Routes
 * GET /api/crm/companies - List companies with filters
 * POST /api/crm/companies - Create company
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanies, createCompany } from '@/lib/crm/company-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import type { CompanyFilters, CompanySize, CompanyStatus } from '@/types/company';

export const dynamic = 'force-dynamic';

const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'enterprise', 'unknown']).optional(),
  employeeCount: z.number().min(0).optional(),
  annualRevenue: z.number().min(0).optional(),
  status: z.enum(['prospect', 'active', 'inactive', 'churned']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  linkedInUrl: z.string().optional(),
  twitterHandle: z.string().optional(),
  facebookUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const validStatuses = ['prospect', 'active', 'inactive', 'churned', 'all'];
    const status = statusParam && validStatuses.includes(statusParam)
      ? statusParam as CompanyStatus | 'all'
      : undefined;

    const sizeParam = searchParams.get('size');
    const validSizes = ['startup', 'small', 'medium', 'enterprise', 'unknown'];
    const size = sizeParam && validSizes.includes(sizeParam)
      ? sizeParam as CompanySize
      : undefined;

    const filters: CompanyFilters = {
      status,
      industry: searchParams.get('industry') ?? undefined,
      size,
      ownerId: searchParams.get('ownerId') ?? undefined,
    };

    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await getCompanies(filters, { pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('Companies GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsed = createCompanySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const company = await createCompany({
      ...parsed.data,
      status: parsed.data.status ?? 'prospect',
    });

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error) {
    logger.error('Company POST failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
