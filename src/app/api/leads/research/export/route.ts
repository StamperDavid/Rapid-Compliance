/**
 * CSV Export — GET /api/leads/research/export
 *
 * Exports discovery results as CSV with configurable fields.
 * Query params: batchId (required), status (optional), fields (comma-separated).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getDiscoveryResults } from '@/lib/services/discovery-service';
import { escapeCsvCell } from '@/lib/utils/csv-export';
import { logger } from '@/lib/logger/logger';
import type { DiscoveryResultStatus } from '@/types/discovery-batch';

export const dynamic = 'force-dynamic';

const ALL_FIELDS = [
  'companyName', 'website', 'domain', 'industry', 'companySize',
  'employeeCount', 'location', 'techStack', 'fundingStage',
  'revenue', 'description', 'icpScore',
] as const;

type FieldKey = typeof ALL_FIELDS[number];

const FIELD_HEADERS: Record<FieldKey, string> = {
  companyName: 'Company Name',
  website: 'Website',
  domain: 'Domain',
  industry: 'Industry',
  companySize: 'Company Size',
  employeeCount: 'Employee Count',
  location: 'Location',
  techStack: 'Tech Stack',
  fundingStage: 'Funding Stage',
  revenue: 'Revenue',
  description: 'Description',
  icpScore: 'ICP Score',
};

function getFieldValue(result: Record<string, unknown>, companyData: Record<string, unknown>, field: FieldKey): string {
  switch (field) {
    case 'companyName':
      return String(companyData.companyName ?? '');
    case 'website':
      return String(companyData.website ?? '');
    case 'domain':
      return String(companyData.domain ?? '');
    case 'industry':
      return String(companyData.industry ?? '');
    case 'companySize':
      return String(companyData.companySize ?? '');
    case 'employeeCount':
      return companyData.employeeCount != null ? String(companyData.employeeCount) : '';
    case 'location': {
      const parts = [companyData.city, companyData.state, companyData.country].filter(Boolean);
      return parts.join(', ');
    }
    case 'techStack':
      return Array.isArray(companyData.techStack)
        ? (companyData.techStack as string[]).join('; ')
        : '';
    case 'fundingStage':
      return String(companyData.fundingStage ?? '');
    case 'revenue':
      return String(companyData.revenue ?? '');
    case 'description':
      return String(companyData.description ?? '');
    case 'icpScore':
      return result.icpScore != null ? String(result.icpScore) : '';
    default:
      return '';
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const statusParam = searchParams.get('status') as DiscoveryResultStatus | null;
    const fieldsParam = searchParams.get('fields');

    // Determine which fields to export
    let selectedFields: FieldKey[];
    if (fieldsParam) {
      selectedFields = fieldsParam.split(',').filter(
        (f): f is FieldKey => ALL_FIELDS.includes(f as FieldKey)
      );
    } else {
      selectedFields = [...ALL_FIELDS];
    }

    if (selectedFields.length === 0) {
      selectedFields = [...ALL_FIELDS];
    }

    // Fetch results
    const filters = statusParam ? { status: statusParam } : undefined;
    const results = await getDiscoveryResults(batchId, filters);

    // Build CSV
    const headers = selectedFields.map(f => FIELD_HEADERS[f]);
    const headerRow = headers.map(h => escapeCsvCell(h)).join(',');

    const dataRows = results.map(result => {
      const r = result as unknown as Record<string, unknown>;
      const companyData = (r.companyData ?? {}) as Record<string, unknown>;
      return selectedFields
        .map(field => escapeCsvCell(getFieldValue(r, companyData, field)))
        .join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lead-research-${batchId}.csv"`,
      },
    });
  } catch (error: unknown) {
    logger.error('[CSV Export] GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to export CSV' }, { status: 500 });
  }
}
