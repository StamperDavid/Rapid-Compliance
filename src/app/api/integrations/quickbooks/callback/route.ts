import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/quickbooks-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId');

  if (!code || !realmId) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    const { userId, orgId } = state ? JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) : { userId: 'default', orgId: 'default' };
    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `quickbooks_${realmId}`,
      {
        id: `quickbooks_${realmId}`,
        userId,
        organizationId: orgId,
        provider: 'quickbooks',
        type: 'accounting',
        status: 'active',
        credentials: {
          ...tokens,
          realmId,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.redirect(`/workspace/${orgId}/integrations?success=quickbooks`);
  } catch (error) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}













