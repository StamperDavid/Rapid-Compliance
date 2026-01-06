/**
 * Duplicate Detection Engine
 * Finds and suggests merging duplicate CRM records
 * Uses fuzzy matching for name, email, phone, company
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import type { Lead } from './lead-service';
import type { RelatedEntityType } from '@/types/activity';

export interface DuplicateMatch {
  id: string;
  record: any;
  matchScore: number; // 0-100
  matchReasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface DuplicateDetectionResult {
  duplicates: DuplicateMatch[];
  hasDuplicates: boolean;
  highestMatch?: DuplicateMatch;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string | undefined | null): string {
  if (!str) {return '';}
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ''); // Remove special chars
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) {return '';}
  return phone.replace(/\D/g, ''); // Remove non-digits
}

/**
 * Calculate string similarity (Levenshtein distance)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {return 1.0;}
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Detect duplicates for a lead
 */
export async function detectLeadDuplicates(
  organizationId: string,
  workspaceId: string,
  lead: Partial<Lead>
): Promise<DuplicateDetectionResult> {
  try {
    // Get all leads in organization
    const existingLeads = await FirestoreService.getAll<Lead>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/leads/records`
    );
    const matches: DuplicateMatch[] = [];

    // Check each existing lead for similarity
    for (const existingLead of existingLeads) {
      // Skip self if checking existing record
      if (lead.id && existingLead.id === lead.id) {continue;}

      const matchReasons: string[] = [];
      let matchScore = 0;

      // Email match (exact) - Very strong signal
      if (lead.email && existingLead.email) {
        const leadEmail = normalizeString(lead.email);
        const existingEmail = normalizeString(existingLead.email);
        
        if (leadEmail === existingEmail) {
          matchScore += 90;
          matchReasons.push('Exact email match');
        }
      }

      // Phone match (exact) - Strong signal
      if (lead.phone && existingLead.phone) {
        const leadPhone = normalizePhone(lead.phone);
        const existingPhone = normalizePhone(existingLead.phone);
        
        if (leadPhone === existingPhone && leadPhone.length >= 10) {
          matchScore += 75;
          matchReasons.push('Exact phone match');
        }
      }

      // Name + Company match - Strong signal
      if (lead.firstName && lead.lastName && lead.company &&
          existingLead.firstName && existingLead.lastName && existingLead.company) {
        
        const fullName = normalizeString(`${lead.firstName}${lead.lastName}`);
        const existingFullName = normalizeString(`${existingLead.firstName}${existingLead.lastName}`);
        const company = normalizeString(lead.company);
        const existingCompany = normalizeString(existingLead.company);
        
        const nameSimilarity = stringSimilarity(fullName, existingFullName);
        const companySimilarity = stringSimilarity(company, existingCompany);
        
        if (nameSimilarity > 0.9 && companySimilarity > 0.9) {
          matchScore += 85;
          matchReasons.push('Name and company match');
        } else if (nameSimilarity > 0.8 && companySimilarity > 0.8) {
          matchScore += 60;
          matchReasons.push('Similar name and company');
        }
      }

      // Name match only (fuzzy) - Medium signal
      if (lead.firstName && lead.lastName && existingLead.firstName && existingLead.lastName) {
        const fullName = normalizeString(`${lead.firstName}${lead.lastName}`);
        const existingFullName = normalizeString(`${existingLead.firstName}${existingLead.lastName}`);
        const nameSimilarity = stringSimilarity(fullName, existingFullName);
        
        if (nameSimilarity > 0.95 && !matchReasons.some(r => r.includes('name'))) {
          matchScore += 40;
          matchReasons.push('Very similar name');
        } else if (nameSimilarity > 0.85 && !matchReasons.some(r => r.includes('name'))) {
          matchScore += 25;
          matchReasons.push('Similar name');
        }
      }

      // Company + Email domain match - Medium signal
      if (lead.email && lead.company && existingLead.email && existingLead.company) {
        const leadDomain = lead.email.split('@')[1]?.toLowerCase();
        const existingDomain = existingLead.email.split('@')[1]?.toLowerCase();
        const company = normalizeString(lead.company);
        const existingCompany = normalizeString(existingLead.company);
        const companySimilarity = stringSimilarity(company, existingCompany);
        
        if (leadDomain === existingDomain && companySimilarity > 0.8 && !matchReasons.some(r => r.includes('email'))) {
          matchScore += 50;
          matchReasons.push('Same email domain and similar company');
        }
      }

      // Only consider if there's some match
      if (matchScore > 0 && matchReasons.length > 0) {
        // Cap at 100
        matchScore = Math.min(matchScore, 100);
        
        // Determine confidence level
        let confidence: 'high' | 'medium' | 'low';
        if (matchScore >= 85) {confidence = 'high';}
        else if (matchScore >= 60) {confidence = 'medium';}
        else {confidence = 'low';}

        matches.push({
          id: existingLead.id,
          record: existingLead,
          matchScore,
          matchReasons,
          confidence,
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const result: DuplicateDetectionResult = {
      duplicates: matches,
      hasDuplicates: matches.length > 0 && matches[0].matchScore >= 60,
      highestMatch: matches[0],
    };

    logger.info('Duplicate detection completed', {
      organizationId,
      duplicatesFound: matches.length,
      highestScore: matches[0]?.matchScore,
    });

    return result;

  } catch (error: any) {
    logger.error('Duplicate detection failed', error, { organizationId });
    throw new Error(`Duplicate detection failed: ${error.message}`);
  }
}

/**
 * Detect duplicates for a contact
 */
export async function detectContactDuplicates(
  organizationId: string,
  workspaceId: string,
  contact: Partial<any>
): Promise<DuplicateDetectionResult> {
  try {
    const existingContacts = await FirestoreService.getAll<any>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`
    );
    const matches: DuplicateMatch[] = [];

    for (const existingContact of existingContacts) {
      if (contact.id && existingContact.id === contact.id) {continue;}

      const matchReasons: string[] = [];
      let matchScore = 0;

      // Email match (exact)
      if (contact.email && existingContact.email &&
          normalizeString(contact.email) === normalizeString(existingContact.email)) {
        matchScore += 90;
        matchReasons.push('Exact email match');
      }

      // Phone match (exact)
      if (contact.phone && existingContact.phone) {
        const contactPhone = normalizePhone(contact.phone);
        const existingPhone = normalizePhone(existingContact.phone);
        
        if (contactPhone === existingPhone && contactPhone.length >= 10) {
          matchScore += 75;
          matchReasons.push('Exact phone match');
        }
      }

      // Name match (fuzzy)
      if (contact.firstName && contact.lastName && existingContact.firstName && existingContact.lastName) {
        const fullName = normalizeString(`${contact.firstName}${contact.lastName}`);
        const existingFullName = normalizeString(`${existingContact.firstName}${existingContact.lastName}`);
        const nameSimilarity = stringSimilarity(fullName, existingFullName);
        
        if (nameSimilarity > 0.95) {
          matchScore += 40;
          matchReasons.push('Very similar name');
        } else if (nameSimilarity > 0.85) {
          matchScore += 25;
          matchReasons.push('Similar name');
        }
      }

      if (matchScore > 0 && matchReasons.length > 0) {
        matchScore = Math.min(matchScore, 100);
        
        let confidence: 'high' | 'medium' | 'low';
        if (matchScore >= 85) {confidence = 'high';}
        else if (matchScore >= 60) {confidence = 'medium';}
        else {confidence = 'low';}

        matches.push({
          id: existingContact.id,
          record: existingContact,
          matchScore,
          matchReasons,
          confidence,
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return {
      duplicates: matches,
      hasDuplicates: matches.length > 0 && matches[0].matchScore >= 60,
      highestMatch: matches[0],
    };

  } catch (error: any) {
    logger.error('Contact duplicate detection failed', error);
    throw new Error(`Duplicate detection failed: ${error.message}`);
  }
}

/**
 * Detect duplicates for a company
 */
export async function detectCompanyDuplicates(
  organizationId: string,
  workspaceId: string,
  company: Partial<any>
): Promise<DuplicateDetectionResult> {
  try {
    const existingCompanies = await FirestoreService.getAll<any>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/companies/records`
    );
    const matches: DuplicateMatch[] = [];

    for (const existingCompany of existingCompanies) {
      if (company.id && existingCompany.id === company.id) {continue;}

      const matchReasons: string[] = [];
      let matchScore = 0;

      // Company name match (fuzzy)
      if (company.name && existingCompany.name) {
        const companyName = normalizeString(company.name);
        const existingName = normalizeString(existingCompany.name);
        const nameSimilarity = stringSimilarity(companyName, existingName);
        
        if (nameSimilarity > 0.95) {
          matchScore += 85;
          matchReasons.push('Very similar company name');
        } else if (nameSimilarity > 0.85) {
          matchScore += 60;
          matchReasons.push('Similar company name');
        }
      }

      // Website match (exact)
      if (company.website && existingCompany.website) {
        const companyWebsite = normalizeString(company.website);
        const existingWebsite = normalizeString(existingCompany.website);
        
        if (companyWebsite === existingWebsite) {
          matchScore += 95;
          matchReasons.push('Exact website match');
        }
      }

      // Phone match
      if (company.phone && existingCompany.phone) {
        const companyPhone = normalizePhone(company.phone);
        const existingPhone = normalizePhone(existingCompany.phone);
        
        if (companyPhone === existingPhone && companyPhone.length >= 10) {
          matchScore += 70;
          matchReasons.push('Exact phone match');
        }
      }

      if (matchScore > 0 && matchReasons.length > 0) {
        matchScore = Math.min(matchScore, 100);
        
        let confidence: 'high' | 'medium' | 'low';
        if (matchScore >= 85) {confidence = 'high';}
        else if (matchScore >= 60) {confidence = 'medium';}
        else {confidence = 'low';}

        matches.push({
          id: existingCompany.id,
          record: existingCompany,
          matchScore,
          matchReasons,
          confidence,
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return {
      duplicates: matches,
      hasDuplicates: matches.length > 0 && matches[0].matchScore >= 60,
      highestMatch: matches[0],
    };

  } catch (error: any) {
    logger.error('Company duplicate detection failed', error);
    throw new Error(`Duplicate detection failed: ${error.message}`);
  }
}

/**
 * Merge two records (keeps newer data, combines arrays)
 */
export async function mergeRecords(
  organizationId: string,
  workspaceId: string,
  entityType: RelatedEntityType,
  keepId: string,
  mergeId: string
): Promise<any> {
  try {
    const collectionPath = `organizations/${organizationId}/workspaces/${workspaceId}/entities/${entityType}s/records`;
    
    // Get both records
    const keepRecord = await FirestoreService.get<any>(collectionPath, keepId);
    const mergeRecord = await FirestoreService.get<any>(collectionPath, mergeId);
    
    if (!keepRecord || !mergeRecord) {
      throw new Error('One or both records not found');
    }

    // Merge logic: keep newer/non-empty values
    const merged = { ...keepRecord };
    
    for (const key in mergeRecord) {
      // Skip metadata fields
      if (['id', 'createdAt', 'updatedAt', 'organizationId', 'workspaceId'].includes(key)) {
        continue;
      }
      
      // If keepRecord doesn't have value but mergeRecord does, use merge value
      if (!merged[key] && mergeRecord[key]) {
        merged[key] = mergeRecord[key];
      }
      
      // For arrays, combine unique values
      if (Array.isArray(merged[key]) && Array.isArray(mergeRecord[key])) {
        merged[key] = [...new Set([...merged[key], ...mergeRecord[key]])];
      }
    }

    merged.updatedAt = new Date();

    // Update the keep record with merged data
    await FirestoreService.update(collectionPath, keepId, merged);

    // Delete the merged record
    await FirestoreService.delete(collectionPath, mergeId);

    logger.info('Records merged successfully', {
      organizationId,
      entityType,
      keepId,
      mergeId,
    });

    return merged;

  } catch (error: any) {
    logger.error('Record merge failed', error);
    throw new Error(`Merge failed: ${error.message}`);
  }
}

