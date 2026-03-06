/**
 * POST /api/leads/apollo
 * Direct Apollo operations — search people/orgs, enrich person/org.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ApolloRequestSchema = z.object({
  action: z.enum(['search_people', 'search_organizations', 'enrich_person', 'enrich_organization']),
  params: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const parsed = ApolloRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(`Invalid request: ${parsed.error.issues.map(i => i.message).join(', ')}`);
    }

    const { action, params } = parsed.data;

    const { apolloService } = await import('@/lib/integrations/apollo/apollo-service');

    const configured = await apolloService.isConfigured();
    if (!configured) {
      return NextResponse.json(
        { success: false, error: 'Apollo API key not configured. Add it in Settings > API Keys.' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'search_people': {
        const result = await apolloService.searchPeople(params as unknown as Parameters<typeof apolloService.searchPeople>[0]);
        return NextResponse.json({ success: result.success, data: result.data, creditsUsed: result.creditsUsed, error: result.error });
      }
      case 'search_organizations': {
        const result = await apolloService.searchOrganizations(params as unknown as Parameters<typeof apolloService.searchOrganizations>[0]);
        return NextResponse.json({ success: result.success, data: result.data, creditsUsed: result.creditsUsed, error: result.error });
      }
      case 'enrich_person': {
        const result = await apolloService.enrichPerson(params as unknown as Parameters<typeof apolloService.enrichPerson>[0]);
        return NextResponse.json({ success: result.success, data: result.data, creditsUsed: result.creditsUsed, error: result.error });
      }
      case 'enrich_organization': {
        const result = await apolloService.enrichOrganization(params as unknown as Parameters<typeof apolloService.enrichOrganization>[0]);
        return NextResponse.json({ success: result.success, data: result.data, creditsUsed: result.creditsUsed, error: result.error });
      }
      default:
        return errors.badRequest(`Unknown action: ${String(action)}`);
    }
  } catch (error) {
    logger.error('[Apollo API] Error', error instanceof Error ? error : new Error(String(error)), { route: '/api/leads/apollo' });
    return errors.externalService('Apollo', error instanceof Error ? error : undefined);
  }
}
