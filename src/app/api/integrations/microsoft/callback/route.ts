import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/outlook-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    const { userId, orgId } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `microsoft_${userId}`,
      {
        id: `microsoft_${userId}`,
        userId,
        organizationId: orgId,
        provider: 'microsoft',
        type: 'outlook',
        status: 'active',
        credentials: tokens,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.redirect(`/workspace/${orgId}/integrations?success=microsoft`);
  } catch (error) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}











