/**
 * Lead Converter — Convert approved Discovery findings into CRM Lead entities
 *
 * Maps DiscoveryFinding data to Lead fields and creates leads via the CRM
 * lead service. Marks findings as 'converted' with the resulting leadId.
 *
 * @module lib/intelligence/lead-converter
 */

import { createLead } from '@/lib/crm/lead-service';
import { setFindingLeadId, getFinding } from './discovery-service';
import { logger } from '@/lib/logger/logger';
import type { DiscoveryFinding } from '@/types/intelligence-discovery';
import type { Lead, EnrichmentData } from '@/types/crm-entities';

const LOG_PREFIX = '[LeadConverter]';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversionResult {
  findingId: string;
  leadId: string | null;
  success: boolean;
  error?: string;
}

export interface BulkConversionResult {
  converted: number;
  failed: number;
  results: ConversionResult[];
}

// ============================================================================
// FIELD MAPPING
// ============================================================================

/**
 * Extract a person's name from seed data fields.
 * Tries multiple common field names from different source templates.
 */
function extractPersonName(seedData: Record<string, string>): { firstName: string; lastName: string } {
  const fullName =
    seedData.owner_name ??
    seedData.officer_name ??
    seedData.contact_name ??
    seedData.registrant_name ??
    seedData.principal_name ??
    seedData.agent_name ??
    '';

  if (!fullName) {
    const companyName =
      seedData.company_name ??
      seedData.business_name ??
      seedData.entity_name ??
      seedData.legal_name ??
      'Unknown';
    return { firstName: companyName, lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Extract email from enriched contact info.
 * Falls back to seed data if no enriched email.
 */
function extractEmail(finding: DiscoveryFinding): string {
  if (finding.enrichedData.emails.length > 0) {
    return finding.enrichedData.emails[0];
  }
  return finding.seedData.email ?? finding.seedData.contact_email ?? '';
}

/**
 * Extract phone from enriched contact info.
 */
function extractPhone(finding: DiscoveryFinding): string | undefined {
  if (finding.enrichedData.phones.length > 0) {
    return finding.enrichedData.phones[0];
  }
  return finding.seedData.phone ?? finding.seedData.contact_phone ?? undefined;
}

/**
 * Extract company name from seed data.
 */
function extractCompany(seedData: Record<string, string>): string {
  return (
    seedData.company_name ??
    seedData.business_name ??
    seedData.entity_name ??
    seedData.legal_name ??
    seedData.dba_name ??
    ''
  );
}

/**
 * Build EnrichmentData from discovery finding enrichment sources.
 */
function buildEnrichmentData(finding: DiscoveryFinding): EnrichmentData {
  const enrichment: EnrichmentData = {
    dataSource: 'web-scrape',
    confidence: finding.overallConfidence,
    lastEnriched: new Date(),
  };

  if (finding.enrichedData.website) {
    enrichment.website = finding.enrichedData.website;
    enrichment.domain = finding.enrichedData.website.replace(/^https?:\/\//, '').split('/')[0];
  }

  const socialMedia = finding.enrichedData.socialMedia;
  if (socialMedia.linkedin) {
    enrichment.linkedInUrl = socialMedia.linkedin;
  }
  if (socialMedia.twitter) {
    enrichment.twitterHandle = socialMedia.twitter;
  }

  // Pull city/state from seed data if available
  const address = finding.seedData.physical_address ?? finding.seedData.principal_address ?? '';
  if (address) {
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      enrichment.city = parts[parts.length - 2];
      const stateZip = parts[parts.length - 1];
      enrichment.state = stateZip.split(/\s+/)[0];
    }
  }

  // Industry from seed data
  if (finding.seedData.industry ?? finding.seedData.business_type) {
    enrichment.industry = finding.seedData.industry ?? finding.seedData.business_type;
  }

  return enrichment;
}

// ============================================================================
// SINGLE CONVERSION
// ============================================================================

/**
 * Convert a single approved DiscoveryFinding into a CRM Lead.
 * Sets acquisitionMethod to 'intelligence_discovery' and links the finding.
 */
export async function convertFindingToLead(
  finding: DiscoveryFinding,
  userId: string
): Promise<ConversionResult> {
  try {
    // Validate finding is in convertible state
    if (finding.approvalStatus !== 'approved') {
      return {
        findingId: finding.id,
        leadId: null,
        success: false,
        error: `Finding is not approved (status: ${finding.approvalStatus})`,
      };
    }

    if (finding.leadId) {
      return {
        findingId: finding.id,
        leadId: finding.leadId,
        success: false,
        error: 'Finding already converted to a lead',
      };
    }

    const { firstName, lastName } = extractPersonName(finding.seedData);
    const email = extractEmail(finding);
    const phone = extractPhone(finding);
    const company = extractCompany(finding.seedData);

    const leadData: Omit<Lead, 'id' | 'createdAt'> = {
      firstName,
      lastName,
      email: email || `noemail-${finding.id}@placeholder.local`,
      phone,
      company,
      title: finding.seedData.title ?? finding.seedData.job_title ?? undefined,
      status: 'new',
      source: 'intelligence-discovery',
      acquisitionMethod: 'intelligence_discovery',
      score: Math.round(finding.overallConfidence * 0.7), // Confidence → initial lead score
      enrichmentData: buildEnrichmentData(finding),
      approvedAt: new Date(),
      approvedBy: userId,
      tags: ['intelligence-discovery'],
    };

    const lead = await createLead(leadData, {
      autoEnrich: false, // Already enriched via discovery pipeline
      skipDuplicateCheck: false,
    });

    // Link finding → lead
    await setFindingLeadId(finding.id, lead.id);

    logger.info(`${LOG_PREFIX} Finding converted to lead`, {
      findingId: finding.id,
      leadId: lead.id,
      company,
    });

    return {
      findingId: finding.id,
      leadId: lead.id,
      success: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_PREFIX} Conversion failed`, error instanceof Error ? error : new Error(message), {
      findingId: finding.id,
    });
    return {
      findingId: finding.id,
      leadId: null,
      success: false,
      error: message,
    };
  }
}

// ============================================================================
// BULK CONVERSION
// ============================================================================

/**
 * Convert multiple approved findings to CRM Leads.
 * Processes sequentially to avoid overwhelming Firestore write limits.
 */
export async function bulkConvertFindings(
  findingIds: string[],
  userId: string
): Promise<BulkConversionResult> {
  const results: ConversionResult[] = [];
  let converted = 0;
  let failed = 0;

  for (const findingId of findingIds) {
    const finding = await getFinding(findingId);

    if (!finding) {
      results.push({
        findingId,
        leadId: null,
        success: false,
        error: 'Finding not found',
      });
      failed++;
      continue;
    }

    const result = await convertFindingToLead(finding, userId);
    results.push(result);

    if (result.success) {
      converted++;
    } else {
      failed++;
    }
  }

  logger.info(`${LOG_PREFIX} Bulk conversion complete`, {
    total: findingIds.length,
    converted,
    failed,
  });

  return { converted, failed, results };
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Generate CSV content from an array of findings.
 */
export function findingsToCSV(findings: DiscoveryFinding[]): string {
  const headers = [
    'Entity Name',
    'Owner/Contact',
    'Address',
    'Phone',
    'Email',
    'Website',
    'LinkedIn',
    'Facebook',
    'Confidence',
    'Enrichment Status',
    'Approval Status',
    'Source',
    'Created At',
  ];

  const rows = findings.map((f) => {
    const entityName =
      f.seedData.company_name ??
      f.seedData.business_name ??
      f.seedData.entity_name ??
      'Unknown';
    const owner =
      f.seedData.owner_name ??
      f.seedData.officer_name ??
      f.seedData.contact_name ??
      '';
    const address =
      f.seedData.physical_address ??
      f.seedData.principal_address ??
      '';
    const phone = f.enrichedData.phones.join('; ');
    const email = f.enrichedData.emails.join('; ');
    const website = f.enrichedData.website ?? '';
    const linkedin = f.enrichedData.socialMedia.linkedin ?? '';
    const facebook = f.enrichedData.socialMedia.facebook ?? '';

    return [
      entityName,
      owner,
      address,
      phone,
      email,
      website,
      linkedin,
      facebook,
      String(f.overallConfidence),
      f.enrichmentStatus,
      f.approvalStatus,
      f.sourceId,
      f.createdAt,
    ].map(escapeCSVField);
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Escape a CSV field value — quotes fields containing commas, quotes, or newlines.
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
