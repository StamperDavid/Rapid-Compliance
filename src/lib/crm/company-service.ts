/**
 * Company Service
 * Business logic layer for company management
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';

type QueryDocumentSnapshot = FirebaseFirestore.QueryDocumentSnapshot;
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { Company, CompanyFilters, CreateCompanyInput, UpdateCompanyInput } from '@/types/company';

interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Get companies with pagination and filtering
 */
export async function getCompanies(
  filters?: CompanyFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Company>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.industry) {
      constraints.push(where('industry', '==', filters.industry));
    }

    if (filters?.size) {
      constraints.push(where('size', '==', filters.size));
    }

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    // where-only constraints for the accurate total (orderBy is irrelevant to a count).
    const countConstraints = [...constraints];

    constraints.push(orderBy('createdAt', 'desc'));

    const [result, total] = await Promise.all([
      AdminFirestoreService.getAllPaginated<Company>(
        getSubCollection('companies'),
        constraints,
        options?.pageSize ?? 50,
        options?.lastDoc
      ),
      AdminFirestoreService.count(getSubCollection('companies'), countConstraints),
    ]);

    logger.info('Companies retrieved', {
      count: result.data.length,
      total,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return { ...result, total };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get companies', error instanceof Error ? error : undefined, {
      filters: filters ? JSON.stringify(filters) : undefined,
    });
    throw new Error(`Failed to retrieve companies: ${errorMessage}`);
  }
}

/**
 * Get a single company
 */
export async function getCompany(companyId: string): Promise<Company | null> {
  try {
    const company = await AdminFirestoreService.get<Company>(
      getSubCollection('companies'),
      companyId
    );

    if (!company) {
      logger.warn('Company not found', { companyId });
      return null;
    }

    logger.info('Company retrieved', { companyId });
    return company;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get company', error instanceof Error ? error : undefined, { companyId });
    throw new Error(`Failed to retrieve company: ${errorMessage}`);
  }
}

/**
 * Create a new company
 */
export async function createCompany(data: CreateCompanyInput): Promise<Company> {
  try {
    const companyId = `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const company: Company = {
      ...data,
      id: companyId,
      status: data.status ?? 'prospect',
      tags: data.tags ?? [],
      currency: data.currency ?? 'USD',
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(
      getSubCollection('companies'),
      companyId,
      company,
      false
    );

    logger.info('Company created', {
      companyId,
      name: company.name,
      industry: company.industry,
    });

    return company;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create company', error instanceof Error ? error : undefined, {
      name: data.name,
    });
    throw new Error(`Failed to create company: ${errorMessage}`);
  }
}

/**
 * Update a company
 */
export async function updateCompany(
  companyId: string,
  updates: UpdateCompanyInput
): Promise<Company> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await AdminFirestoreService.update(
      getSubCollection('companies'),
      companyId,
      updatedData
    );

    logger.info('Company updated', {
      companyId,
      updatedFields: Object.keys(updates),
    });

    const company = await getCompany(companyId);
    if (!company) {
      throw new Error('Company not found after update');
    }

    return company;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update company', error instanceof Error ? error : undefined, { companyId });
    throw new Error(`Failed to update company: ${errorMessage}`);
  }
}

/**
 * Delete a company
 */
export async function deleteCompany(companyId: string): Promise<void> {
  try {
    // Check for linked contacts
    const linkedContacts = await AdminFirestoreService.getAll(
      getSubCollection('contacts'),
      [where('company', '==', companyId)]
    );
    if (linkedContacts.length > 0) {
      throw new Error(
        `Cannot delete company: ${linkedContacts.length} contact(s) are linked. Remove or reassign them first.`
      );
    }

    // Check for linked deals
    const linkedDeals = await AdminFirestoreService.getAll(
      getSubCollection('deals'),
      [where('company', '==', companyId)]
    );
    if (linkedDeals.length > 0) {
      throw new Error(
        `Cannot delete company: ${linkedDeals.length} deal(s) are linked. Remove or reassign them first.`
      );
    }

    await AdminFirestoreService.delete(
      getSubCollection('companies'),
      companyId
    );

    logger.info('Company deleted', { companyId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete company', error instanceof Error ? error : undefined, { companyId });
    throw new Error(`Failed to delete company: ${errorMessage}`);
  }
}

/**
 * Search companies by name or website
 */
export async function searchCompanies(
  searchTerm: string,
  options?: PaginationOptions
): Promise<PaginatedResult<Company>> {
  try {
    const result = await getCompanies(undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(company =>
      company.name.toLowerCase().includes(searchLower) ||
      (company.website?.toLowerCase().includes(searchLower) ?? false) ||
      (company.industry?.toLowerCase().includes(searchLower) ?? false) ||
      (company.email?.toLowerCase().includes(searchLower) ?? false)
    );

    logger.info('Companies searched', {
      searchTerm,
      resultsCount: filtered.length,
    });

    return {
      data: filtered,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Company search failed', error instanceof Error ? error : undefined, { searchTerm });
    throw new Error(`Search failed: ${errorMessage}`);
  }
}

/**
 * Get company contact count and deal summary (roll-up)
 */
export async function getCompanyRollup(companyId: string): Promise<{
  contactCount: number;
  dealCount: number;
  totalDealValue: number;
  wonDealValue: number;
}> {
  try {
    // Prefer the association FK (companyId). Fall back to the legacy `company`
    // string match (by both the company's id and its display name) so records
    // that predate the FK still roll up.
    const company = await getCompany(companyId);
    const companyName = company?.name;

    const [contactsById, dealsById] = await Promise.all([
      AdminFirestoreService.getAll<{ id: string }>(
        getSubCollection('contacts'),
        [where('companyId', '==', companyId)]
      ),
      AdminFirestoreService.getAll<{ id: string; value?: number; stage?: string }>(
        getSubCollection('deals'),
        [where('companyId', '==', companyId)]
      ),
    ]);

    // Legacy fallback queries (match the `company` string against the id and the name).
    const legacyStrings = Array.from(new Set([companyId, companyName].filter((s): s is string => Boolean(s))));
    const legacyContactArrays: { id: string }[][] = [];
    const legacyDealArrays: { id: string; value?: number; stage?: string }[][] = [];
    for (const legacyValue of legacyStrings) {
      const [legacyContacts, legacyDeals] = await Promise.all([
        AdminFirestoreService.getAll<{ id: string }>(
          getSubCollection('contacts'),
          [where('company', '==', legacyValue)]
        ),
        AdminFirestoreService.getAll<{ id: string; value?: number; stage?: string }>(
          getSubCollection('deals'),
          [where('company', '==', legacyValue)]
        ),
      ]);
      legacyContactArrays.push(legacyContacts);
      legacyDealArrays.push(legacyDeals);
    }

    // De-dupe by id so a record matched by both FK and legacy string counts once.
    const contactMap = new Map<string, { id: string }>();
    for (const c of [contactsById, ...legacyContactArrays].flat()) { contactMap.set(c.id, c); }
    const dealMap = new Map<string, { id: string; value?: number; stage?: string }>();
    for (const d of [dealsById, ...legacyDealArrays].flat()) { dealMap.set(d.id, d); }

    const contacts = Array.from(contactMap.values());
    const deals = Array.from(dealMap.values());

    const totalDealValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const wonDealValue = deals
      .filter(d => d.stage === 'closed_won')
      .reduce((sum, d) => sum + (d.value ?? 0), 0);

    return {
      contactCount: contacts.length,
      dealCount: deals.length,
      totalDealValue,
      wonDealValue,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get company rollup', error instanceof Error ? error : undefined, { companyId });
    throw new Error(`Failed to get company rollup: ${errorMessage}`);
  }
}
