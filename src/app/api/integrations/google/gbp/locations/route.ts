/**
 * Google Business Profile — list available locations on the connected
 * Google account.
 *
 * GET /api/integrations/google/gbp/locations
 *
 * Calls Google's Business Profile APIs in two passes:
 *   1. `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
 *      — list all GBP accounts the operator has access to.
 *   2. For each account, `GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations`
 *      with `readMask=name,title,storefrontAddress` — list locations.
 *
 * Returns a flat list keyed for the location-picker UI.
 *
 * Auth: requireRole(['owner','admin']).
 *
 * Token source: the central connected-Google doc (set up at unified
 * onboarding OAuth, scope bundle includes `business.manage`). On 401
 * we try refreshConnectedGoogleTokens() once and retry. If no central
 * tokens exist, returns 503 with `code: 'no_google_connection'`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import {
  getConnectedGoogleTokens,
  refreshConnectedGoogleTokens,
} from '@/lib/integrations/google-tokens';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/integrations/google/gbp/locations';

const ACCOUNT_MGMT_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const LOCATIONS_READ_MASK = 'name,title,storefrontAddress';

interface GbpAccount {
  /** Full resource name (e.g., "accounts/12345"). */
  name?: string;
  accountName?: string;
  type?: string;
}

interface GbpStorefrontAddress {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  regionCode?: string;
}

interface GbpLocation {
  /** Full resource name (e.g., "accounts/12345/locations/67890"). */
  name?: string;
  title?: string;
  storefrontAddress?: GbpStorefrontAddress;
}

interface FlattenedLocation {
  /** Just the trailing id (e.g., "12345") for use in the GBP service config. */
  accountId: string;
  /** Full resource name (e.g., "accounts/12345"). */
  accountName: string;
  /** Just the trailing id (e.g., "67890"). */
  locationId: string;
  /** Display name of the location. */
  locationName: string;
  /** Single-line address for UI display. Empty string if Google didn't return one. */
  address: string;
}

function extractTrailingId(resourceName: string, prefix: string): string {
  // e.g., "accounts/12345" → "12345"; "accounts/12345/locations/67890" → "67890"
  const idx = resourceName.lastIndexOf(`${prefix}/`);
  if (idx < 0) {
    return resourceName;
  }
  return resourceName.substring(idx + prefix.length + 1);
}

function formatAddress(addr: GbpStorefrontAddress | undefined): string {
  if (!addr) {
    return '';
  }
  const parts: string[] = [];
  if (Array.isArray(addr.addressLines)) {
    parts.push(...addr.addressLines.filter((line) => typeof line === 'string' && line.length > 0));
  }
  if (typeof addr.locality === 'string' && addr.locality.length > 0) {
    parts.push(addr.locality);
  }
  if (typeof addr.administrativeArea === 'string' && addr.administrativeArea.length > 0) {
    parts.push(addr.administrativeArea);
  }
  if (typeof addr.postalCode === 'string' && addr.postalCode.length > 0) {
    parts.push(addr.postalCode);
  }
  return parts.join(', ');
}

async function fetchGbpAccounts(accessToken: string): Promise<{ status: number; accounts: GbpAccount[] }> {
  const res = await fetch(ACCOUNT_MGMT_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { status: res.status, accounts: [] };
  }
  const body = (await res.json()) as { accounts?: GbpAccount[] };
  return { status: 200, accounts: Array.isArray(body.accounts) ? body.accounts : [] };
}

async function fetchLocationsForAccount(
  accessToken: string,
  accountName: string,
): Promise<{ status: number; locations: GbpLocation[] }> {
  const url = `${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=${encodeURIComponent(LOCATIONS_READ_MASK)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { status: res.status, locations: [] };
  }
  const body = (await res.json()) as { locations?: GbpLocation[] };
  return { status: 200, locations: Array.isArray(body.locations) ? body.locations : [] };
}

async function listAllLocations(accessToken: string): Promise<{ status: number; locations: FlattenedLocation[] }> {
  const accountsResult = await fetchGbpAccounts(accessToken);
  if (accountsResult.status !== 200) {
    return { status: accountsResult.status, locations: [] };
  }

  const flattened: FlattenedLocation[] = [];
  for (const account of accountsResult.accounts) {
    const accountResourceName = typeof account.name === 'string' ? account.name : '';
    if (accountResourceName.length === 0) {
      continue;
    }
    const accountId = extractTrailingId(accountResourceName, 'accounts');

    const locResult = await fetchLocationsForAccount(accessToken, accountResourceName);
    if (locResult.status !== 200) {
      // One account failing shouldn't fail the whole list — log and skip.
      logger.warn('[gbp-locations] account locations fetch non-OK', {
        route: ROUTE,
        accountResourceName,
        status: locResult.status,
      });
      continue;
    }

    for (const loc of locResult.locations) {
      const locResourceName = typeof loc.name === 'string' ? loc.name : '';
      if (locResourceName.length === 0) {
        continue;
      }
      const locationId = extractTrailingId(locResourceName, 'locations');
      flattened.push({
        accountId,
        accountName: accountResourceName,
        locationId,
        locationName: typeof loc.title === 'string' ? loc.title : locationId,
        address: formatAddress(loc.storefrontAddress),
      });
    }
  }

  return { status: 200, locations: flattened };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tokens = await getConnectedGoogleTokens();
    if (!tokens?.accessToken) {
      return NextResponse.json(
        {
          success: false,
          code: 'no_google_connection',
          error: 'No connected Google account — connect Google before listing GBP locations.',
        },
        { status: 503 },
      );
    }

    // First attempt with current token.
    let attempt = await listAllLocations(tokens.accessToken);

    // 401 → refresh once and retry.
    if (attempt.status === 401) {
      logger.info('[gbp-locations] access token rejected (401), attempting refresh', {
        route: ROUTE,
      });
      const fresh = await refreshConnectedGoogleTokens();
      if (!fresh?.accessToken) {
        return NextResponse.json(
          {
            success: false,
            code: 'reauth_required',
            error: 'Google access token expired and refresh failed. Reconnect Google.',
          },
          { status: 503 },
        );
      }
      attempt = await listAllLocations(fresh.accessToken);
    }

    if (attempt.status === 403) {
      return NextResponse.json(
        {
          success: false,
          code: 'scope_missing',
          error: 'Google rejected the GBP request (403). The connected Google account may not have business.manage scope. Reconnect Google.',
        },
        { status: 503 },
      );
    }

    if (attempt.status !== 200) {
      logger.error(
        '[gbp-locations] upstream returned non-OK',
        new Error(`status ${attempt.status}`),
        { route: ROUTE },
      );
      return NextResponse.json(
        {
          success: false,
          code: 'upstream_error',
          error: `Google Business Profile API returned status ${attempt.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      locations: attempt.locations,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[gbp-locations] handler threw',
      error instanceof Error ? error : new Error(msg),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, code: 'internal_error', error: msg },
      { status: 500 },
    );
  }
}
