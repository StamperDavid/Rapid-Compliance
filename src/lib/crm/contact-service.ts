/**
 * Contact Service
 * Business logic layer for contact management
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface Contact {
  id: string;
  organizationId: string;
  workspaceId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  department?: string;
  linkedInUrl?: string;
  twitterHandle?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  isVIP?: boolean;
  tags?: string[];
  notes?: string;
  ownerId?: string;
  customFields?: Record<string, unknown>;
  lastContactedAt?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface ContactFilters {
  isVIP?: boolean;
  company?: string;
  ownerId?: string;
  tags?: string[];
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Get contacts with pagination and filtering
 */
export async function getContacts(
  organizationId: string,
  workspaceId: string = 'default',
  filters?: ContactFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Contact>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.isVIP !== undefined) {
      constraints.push(where('isVIP', '==', filters.isVIP));
    }

    if (filters?.company) {
      constraints.push(where('company', '==', filters.company));
    }

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    // Default ordering
    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Contact>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Contacts retrieved', {
      organizationId,
      count: result.data.length,
      filters: filters ? JSON.stringify(filters) : undefined,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get contacts', error instanceof Error ? error : undefined, { organizationId, filters: filters ? JSON.stringify(filters) : undefined });
    throw new Error(`Failed to retrieve contacts: ${errorMessage}`);
  }
}

/**
 * Get a single contact
 */
export async function getContact(
  organizationId: string,
  contactId: string,
  workspaceId: string = 'default'
): Promise<Contact | null> {
  try {
    const contact = await FirestoreService.get<Contact>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`,
      contactId
    );

    if (!contact) {
      logger.warn('Contact not found', { organizationId, contactId });
      return null;
    }

    logger.info('Contact retrieved', { organizationId, contactId });
    return contact;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get contact', error instanceof Error ? error : undefined, { organizationId, contactId });
    throw new Error(`Failed to retrieve contact: ${errorMessage}`);
  }
}

/**
 * Create a new contact
 */
export async function createContact(
  organizationId: string,
  data: Omit<Contact, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default'
): Promise<Contact> {
  try {
    const contactId = `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const contact: Contact = {
      ...data,
      id: contactId,
      organizationId,
      workspaceId,
      isVIP: data.isVIP ?? false,
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`,
      contactId,
      contact,
      false
    );

    logger.info('Contact created', {
      organizationId,
      contactId,
      email: contact.email,
      company: contact.company,
    });

    return contact;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create contact', error instanceof Error ? error : undefined, { organizationId, email: data.email, company: data.company });
    throw new Error(`Failed to create contact: ${errorMessage}`);
  }
}

/**
 * Update contact
 */
export async function updateContact(
  organizationId: string,
  contactId: string,
  updates: Partial<Omit<Contact, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Contact> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`,
      contactId,
      updatedData
    );

    logger.info('Contact updated', {
      organizationId,
      contactId,
      updatedFields: Object.keys(updates),
    });

    const contact = await getContact(organizationId, contactId, workspaceId);
    if (!contact) {
      throw new Error('Contact not found after update');
    }

    return contact;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update contact', error instanceof Error ? error : undefined, { organizationId, contactId });
    throw new Error(`Failed to update contact: ${errorMessage}`);
  }
}

/**
 * Delete contact
 */
export async function deleteContact(
  organizationId: string,
  contactId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`,
      contactId
    );

    logger.info('Contact deleted', { organizationId, contactId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete contact', error instanceof Error ? error : undefined, { organizationId, contactId });
    throw new Error(`Failed to delete contact: ${errorMessage}`);
  }
}

/**
 * Mark contact as VIP
 */
export async function markAsVIP(
  organizationId: string,
  contactId: string,
  workspaceId: string = 'default'
): Promise<Contact> {
  try {
    const contact = await updateContact(organizationId, contactId, { isVIP: true }, workspaceId);

    logger.info('Contact marked as VIP', { organizationId, contactId });

    return contact;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to mark contact as VIP', error instanceof Error ? error : undefined, { organizationId, contactId });
    throw new Error(`Failed to mark as VIP: ${errorMessage}`);
  }
}

/**
 * Add tags to contact
 */
export async function addTags(
  organizationId: string,
  contactId: string,
  newTags: string[],
  workspaceId: string = 'default'
): Promise<Contact> {
  try {
    const contact = await getContact(organizationId, contactId, workspaceId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const existingTags = contact.tags ?? [];
    const mergedTags = [...new Set([...existingTags, ...newTags])];

    const updated = await updateContact(organizationId, contactId, { tags: mergedTags }, workspaceId);

    logger.info('Tags added to contact', {
      organizationId,
      contactId,
      newTags,
      totalTags: mergedTags.length,
    });

    return updated;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to add tags', error instanceof Error ? error : undefined, { organizationId, contactId, newTags });
    throw new Error(`Failed to add tags: ${errorMessage}`);
  }
}

/**
 * Search contacts
 */
export async function searchContacts(
  organizationId: string,
  searchTerm: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<Contact>> {
  try {
    // Get all contacts (filtered by search term client-side)
    const result = await getContacts(organizationId, workspaceId, undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(contact =>
      (contact.firstName?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.lastName?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.name?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.email?.toLowerCase().includes(searchLower) ?? false) ||
      (contact.company?.toLowerCase().includes(searchLower) ?? false)
    );

    logger.info('Contacts searched', {
      organizationId,
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
    logger.error('Contact search failed', error instanceof Error ? error : undefined, { organizationId, searchTerm });
    throw new Error(`Search failed: ${errorMessage}`);
  }
}

/**
 * Record contact interaction
 */
export async function recordInteraction(
  organizationId: string,
  contactId: string,
  type: 'email' | 'call' | 'meeting' | 'note',
  details: Record<string, unknown>,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    // Update last contacted timestamp
    await updateContact(organizationId, contactId, {
      lastContactedAt: new Date(),
    }, workspaceId);

    // Save interaction record
    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records/${contactId}/interactions`,
      `interaction-${Date.now()}`,
      {
        type,
        details,
        createdAt: new Date(),
      },
      false
    );

    logger.info('Contact interaction recorded', {
      organizationId,
      contactId,
      interactionType: type,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to record interaction', error instanceof Error ? error : undefined, { organizationId, contactId, type });
    throw new Error(`Failed to record interaction: ${errorMessage}`);
  }
}




