/**
 * Lead Service Tests
 * Integration tests for lead service layer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  enrichLead,
  searchLeads,
  bulkUpdateLeads,
  type Lead,
} from '@/lib/crm/lead-service';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('LeadService', () => {
  const testOrgId = `test-org-${Date.now()}`;
  const testWorkspaceId = 'default';
  let testLeadId: string;

  beforeEach(async () => {
    // Create test organization
    await FirestoreService.set('organizations', testOrgId, {
      id: testOrgId,
      name: 'Test Organization',
    }, false);
  });

  afterEach(async () => {
    // Cleanup: Delete test lead if exists
    if (testLeadId) {
      try {
        await deleteLead(testOrgId, testLeadId, testWorkspaceId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('createLead', () => {
    it('should create a new lead with all required fields', async () => {
      const leadData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123',
        company: 'Acme Inc',
        status: 'new' as const,
      };

      const lead = await createLead(testOrgId, leadData, testWorkspaceId);
      testLeadId = lead.id;

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.firstName).toBe('John');
      expect(lead.lastName).toBe('Doe');
      expect(lead.email).toBe('john.doe@example.com');
      expect(lead.organizationId).toBe(testOrgId);
      expect(lead.workspaceId).toBe(testWorkspaceId);
      expect(lead.score).toBe(50); // Default score
      expect(lead.createdAt).toBeDefined();
    });

    it('should create lead with custom score', async () => {
      const lead = await createLead(testOrgId, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        status: 'new' as const,
        score: 85,
      }, testWorkspaceId);
      testLeadId = lead.id;

      expect(lead.score).toBe(85);
    });
  });

  describe('getLead', () => {
    it('should retrieve an existing lead', async () => {
      // Create a lead
      const created = await createLead(testOrgId, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = created.id;

      // Retrieve it
      const lead = await getLead(testOrgId, testLeadId, testWorkspaceId);

      expect(lead).toBeDefined();
      expect(lead?.id).toBe(testLeadId);
      expect(lead?.firstName).toBe('Test');
    });

    it('should return null for non-existent lead', async () => {
      const lead = await getLead(testOrgId, 'non-existent-id', testWorkspaceId);
      expect(lead).toBeNull();
    });
  });

  describe('updateLead', () => {
    it('should update lead fields', async () => {
      // Create a lead
      const created = await createLead(testOrgId, {
        firstName: 'Original',
        lastName: 'Name',
        email: 'original@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = created.id;

      // Update it
      const updated = await updateLead(testOrgId, testLeadId, {
        firstName: 'Updated',
        status: 'qualified',
        score: 90,
      }, testWorkspaceId);

      expect(updated.firstName).toBe('Updated');
      expect(updated.lastName).toBe('Name'); // Unchanged
      expect(updated.status).toBe('qualified');
      expect(updated.score).toBe(90);
      expect(updated.updatedAt).toBeDefined();
    });
  });

  describe('getLeads with pagination', () => {
    it('should retrieve leads with pagination', async () => {
      // Create multiple leads
      const leadIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const lead = await createLead(testOrgId, {
          firstName: `Lead`,
          lastName: `${i}`,
          email: `lead${i}@example.com`,
          status: 'new' as const,
        }, testWorkspaceId);
        leadIds.push(lead.id);
      }

      // Get first page
      const result = await getLeads(testOrgId, testWorkspaceId, undefined, { pageSize: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).toBeDefined();

      // Get second page
      const page2 = await getLeads(testOrgId, testWorkspaceId, undefined, {
        pageSize: 5,
        lastDoc: result.lastDoc!,
      });

      expect(page2.data).toHaveLength(5);
      expect(page2.data[0].id).not.toBe(result.data[0].id);

      // Cleanup
      for (const id of leadIds) {
        await deleteLead(testOrgId, id, testWorkspaceId);
      }
    });

    it('should filter leads by status', async () => {
      // Create leads with different statuses
      const newLead = await createLead(testOrgId, {
        firstName: 'New',
        lastName: 'Lead',
        email: 'new@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const qualifiedLead = await createLead(testOrgId, {
        firstName: 'Qualified',
        lastName: 'Lead',
        email: 'qualified@example.com',
        status: 'qualified' as const,
      }, testWorkspaceId);

      // Filter by status
      const result = await getLeads(testOrgId, testWorkspaceId, { status: 'qualified' });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.every(l => l.status === 'qualified')).toBe(true);

      // Cleanup
      await deleteLead(testOrgId, newLead.id, testWorkspaceId);
      await deleteLead(testOrgId, qualifiedLead.id, testWorkspaceId);
    });
  });

  describe('searchLeads', () => {
    it('should search leads by name', async () => {
      const lead = await createLead(testOrgId, {
        firstName: 'Searchable',
        lastName: 'Lead',
        email: 'searchable@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = lead.id;

      const result = await searchLeads(testOrgId, 'Searchable', testWorkspaceId);

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some(l => l.id === testLeadId)).toBe(true);
    });

    it('should search leads by email', async () => {
      const lead = await createLead(testOrgId, {
        firstName: 'Test',
        lastName: 'User',
        email: 'unique-email@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = lead.id;

      const result = await searchLeads(testOrgId, 'unique-email', testWorkspaceId);

      expect(result.data.some(l => l.id === testLeadId)).toBe(true);
    });
  });

  describe('bulkUpdateLeads', () => {
    it('should update multiple leads at once', async () => {
      // Create 3 leads
      const lead1 = await createLead(testOrgId, {
        firstName: 'Bulk1',
        lastName: 'Test',
        email: 'bulk1@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const lead2 = await createLead(testOrgId, {
        firstName: 'Bulk2',
        lastName: 'Test',
        email: 'bulk2@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const lead3 = await createLead(testOrgId, {
        firstName: 'Bulk3',
        lastName: 'Test',
        email: 'bulk3@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      // Bulk update
      const successCount = await bulkUpdateLeads(
        testOrgId,
        [lead1.id, lead2.id, lead3.id],
        { status: 'contacted' },
        testWorkspaceId
      );

      expect(successCount).toBe(3);

      // Verify updates
      const updated1 = await getLead(testOrgId, lead1.id, testWorkspaceId);
      expect(updated1?.status).toBe('contacted');

      // Cleanup
      await deleteLead(testOrgId, lead1.id, testWorkspaceId);
      await deleteLead(testOrgId, lead2.id, testWorkspaceId);
      await deleteLead(testOrgId, lead3.id, testWorkspaceId);
    });
  });

  describe('deleteLead', () => {
    it('should delete a lead', async () => {
      const lead = await createLead(testOrgId, {
        firstName: 'Delete',
        lastName: 'Me',
        email: 'deleteme@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      await deleteLead(testOrgId, lead.id, testWorkspaceId);

      const deleted = await getLead(testOrgId, lead.id, testWorkspaceId);
      expect(deleted).toBeNull();
    });
  });
});

