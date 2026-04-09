/**
 * Company Detail API Routes
 * GET /api/crm/companies/[companyId] - Get single company with rollup
 * PUT /api/crm/companies/[companyId] - Update company
 * DELETE /api/crm/companies/[companyId] - Delete company
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompany, updateCompany, deleteCompany, getCompanyRollup } from '@/lib/crm/company-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
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
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { companyId } = await params;
    const [company, rollup] = await Promise.all([
      getCompany(companyId),
      getCompanyRollup(companyId),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...company, ...rollup },
    });
  } catch (error) {
    logger.error('Company GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { companyId } = await params;
    const rawBody: unknown = await request.json();
    const parsed = updateCompanySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const company = await updateCompany(companyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error) {
    logger.error('Company PUT failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { companyId } = await params;
    await deleteCompany(companyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Company DELETE failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
