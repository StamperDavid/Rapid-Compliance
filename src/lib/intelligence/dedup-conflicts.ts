/**
 * Duplicate Detection & Field Conflict Resolution
 *
 * - Content hashing: normalizes key seed data fields into a SHA-256 hash
 * - Duplicate check: queries Firestore for existing findings with same hash
 * - Field conflicts: extracts per-field disagreements across enrichment sources
 *
 * @module intelligence/dedup-conflicts
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { DiscoveryFinding, FieldConflict, EnrichmentSourceResult } from '@/types/intelligence-discovery';

// ============================================================================
// CONTENT HASHING — Duplicate Detection
// ============================================================================

/**
 * Generate a content hash from key seed data fields.
 * Normalizes company name + location to catch near-duplicates.
 */
export function generateContentHash(seedData: Record<string, string>): string {
  const companyName = (
    seedData.company_name ??
    seedData.business_name ??
    seedData.entity_name ??
    seedData.legal_name ??
    ''
  ).toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  const state = (seedData.state ?? seedData.principal_state ?? '').toLowerCase().trim();
  const city = (seedData.city ?? seedData.principal_city ?? '').toLowerCase().trim();
  const phone = (seedData.phone ?? '').replace(/\D/g, '');

  // Combine key identifying fields
  const raw = `${companyName}|${state}|${city}|${phone}`;

  return createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Check if a finding with the same content hash already exists.
 * Returns the existing finding ID if found, null otherwise.
 */
export async function checkDuplicate(contentHash: string, excludeFindingId?: string): Promise<string | null> {
  try {
    const db = adminDb;
    if (!db) {
      return null;
    }

    const findingsCol = getSubCollection('discovery_findings');
    const snapshot = await db.collection(findingsCol)
      .where('contentHash', '==', contentHash)
      .limit(2)
      .get();

    if (snapshot.empty) {
      return null;
    }

    for (const doc of snapshot.docs) {
      if (doc.id !== excludeFindingId) {
        return doc.id;
      }
    }

    return null;
  } catch (err) {
    logger.warn('[Dedup] Duplicate check failed, continuing without dedup', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================================
// FIELD CONFLICT EXTRACTION
// ============================================================================

/**
 * Extract per-field conflicts from enrichment sources.
 * When multiple sources provide different values for the same field,
 * capture all values with their source name and confidence for resolution.
 */
export function extractFieldConflicts(
  enrichmentSources: EnrichmentSourceResult[],
  finding: DiscoveryFinding,
): Record<string, FieldConflict[]> {
  const conflicts: Record<string, FieldConflict[]> = {};

  // Collect phone values across sources
  const phoneValues = new Map<string, FieldConflict>();
  const emailValues = new Map<string, FieldConflict>();
  const websiteValues = new Map<string, FieldConflict>();

  // Add seed data values
  const seedPhone = finding.seedData.phone;
  if (seedPhone) {
    phoneValues.set(seedPhone, { value: seedPhone, source: 'seed_data', confidence: 60 });
  }

  // Walk enrichment sources for contacts
  for (const src of enrichmentSources) {
    const confidence = src.confidence ?? 50;
    const sourceName = src.sourceName ?? 'unknown';

    // We don't have direct access to per-source contacts here,
    // but we can detect conflicts from the final merged data
    // by comparing source count vs unique values
    if (src.fieldsFound?.includes('phone') && finding.enrichedData.phones.length > 1) {
      for (const phone of finding.enrichedData.phones) {
        if (!phoneValues.has(phone)) {
          phoneValues.set(phone, { value: phone, source: sourceName, confidence });
        }
      }
    }

    if (src.fieldsFound?.includes('email') && finding.enrichedData.emails.length > 1) {
      for (const email of finding.enrichedData.emails) {
        if (!emailValues.has(email)) {
          emailValues.set(email, { value: email, source: sourceName, confidence });
        }
      }
    }

    if (src.fieldsFound?.includes('website') && finding.enrichedData.website) {
      websiteValues.set(finding.enrichedData.website, {
        value: finding.enrichedData.website,
        source: sourceName,
        confidence,
      });
    }
  }

  // Only mark as conflict if there are 2+ different values
  if (phoneValues.size >= 2) {
    conflicts.phone = Array.from(phoneValues.values());
  }
  if (emailValues.size >= 2) {
    conflicts.email = Array.from(emailValues.values());
  }
  if (websiteValues.size >= 2) {
    conflicts.website = Array.from(websiteValues.values());
  }

  return conflicts;
}
