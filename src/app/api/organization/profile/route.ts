/**
 * Organization Profile API
 *
 * GET  /api/organization/profile — Read org profile
 * PATCH /api/organization/profile — Update org profile fields
 *
 * Reads/writes to the main organization document at organizations/{PLATFORM_ID}.
 * Fields stored under a `companyProfile` nested object to avoid collisions
 * with existing top-level fields (brandDNA, industry, etc.).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMA
// ============================================================================

const CompanyProfileSchema = z.object({
  companyName: z.string().optional(),
  legalName: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  taxId: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  socialMedia: z.object({
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
  }).optional(),
}).strict();

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// ============================================================================
// GET — Read organization profile
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'canManageOrganization');
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminDb) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
  }

  try {
    const doc = await adminDb.collection('organizations').doc(PLATFORM_ID).get();
    const raw = doc.exists ? (doc.data() as Record<string, unknown>) : null;
    const cp = (raw?.companyProfile ?? {}) as Record<string, unknown>;
    const addr = (cp.address ?? {}) as Record<string, unknown>;
    const social = (cp.socialMedia ?? {}) as Record<string, unknown>;

    const str = (v: unknown, fallback = ''): string =>
      typeof v === 'string' ? v : fallback;

    const profile: CompanyProfile = {
      companyName: str(cp.companyName, str(raw?.name)),
      legalName: str(cp.legalName),
      industry: str(cp.industry, str(raw?.industryName, str(raw?.industry))),
      companySize: str(cp.companySize),
      website: str(cp.website),
      phone: str(cp.phone),
      email: str(cp.email),
      taxId: str(cp.taxId),
      address: {
        street: str(addr.street),
        street2: str(addr.street2),
        city: str(addr.city),
        state: str(addr.state),
        zip: str(addr.zip),
        country: str(addr.country),
      },
      socialMedia: {
        linkedin: str(social.linkedin),
        twitter: str(social.twitter),
        facebook: str(social.facebook),
        instagram: str(social.instagram),
      },
    };

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    logger.error('[OrgProfile] Failed to read', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

// ============================================================================
// PATCH — Update organization profile
// ============================================================================

export async function PATCH(request: NextRequest) {
  const authResult = await requirePermission(request, 'canManageOrganization');
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminDb) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = CompanyProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid data' },
        { status: 400 }
      );
    }

    // Build flat update map for Firestore dot-notation updates
    const updates: Record<string, unknown> = {
      'companyProfile.updatedAt': new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) { continue; }
      if (typeof value === 'object' && value !== null) {
        // Nested objects (address, socialMedia)
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subValue !== undefined) {
            updates[`companyProfile.${key}.${subKey}`] = subValue;
          }
        }
      } else {
        updates[`companyProfile.${key}`] = value;
      }
    }

    // Also update top-level name and industry for backward compatibility
    if (parsed.data.companyName !== undefined) {
      updates.name = parsed.data.companyName;
    }
    if (parsed.data.industry !== undefined) {
      updates.industryName = parsed.data.industry;
    }

    await adminDb.collection('organizations').doc(PLATFORM_ID).update(updates);

    logger.info('[OrgProfile] Updated', {
      fields: Object.keys(updates).length,
      user: authResult.user.email,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[OrgProfile] Failed to update', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
