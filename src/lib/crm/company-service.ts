/**
 * Company Service
 * Business logic layer for company management
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
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

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Company>(
      getSubCollection('companies'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Companies retrieved', {
      count: result.data.length,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
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
    const company = await FirestoreService.get<Company>(
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

    await FirestoreService.set(
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

    await FirestoreService.update(
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
    const linkedContacts = await FirestoreService.getAll(
      getSubCollection('contacts'),
      [where('company', '==', companyId)]
    );
    if (linkedContacts.length > 0) {
      throw new Error(
        `Cannot delete company: ${linkedContacts.length} contact(s) are linked. Remove or reassign them first.`
      );
    }

    // Check for linked deals
    const linkedDeals = await FirestoreService.getAll(
      getSubCollection('deals'),
      [where('company', '==', companyId)]
    );
    if (linkedDeals.length > 0) {
      throw new Error(
        `Cannot delete company: ${linkedDeals.length} deal(s) are linked. Remove or reassign them first.`
      );
    }

    await FirestoreService.delete(
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
    const [contacts, deals] = await Promise.all([
      FirestoreService.getAll(
        getSubCollection('contacts'),
        [where('company', '==', companyId)]
      ),
      FirestoreService.getAll<{ value?: number; stage?: string }>(
        getSubCollection('deals'),
        [where('company', '==', companyId)]
      ),
    ]);

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
