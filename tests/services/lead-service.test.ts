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
  searchLeads,
  bulkUpdateLeads,
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
        await deleteLead(testLeadId, testWorkspaceId);
      } catch {
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

      // Disable auto-enrichment to test default score behavior
      const lead = await createLead(leadData, testWorkspaceId, { autoEnrich: false });
      testLeadId = lead.id;

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.firstName).toBe('John');
      expect(lead.lastName).toBe('Doe');
      expect(lead.email).toBe('john.doe@example.com');
      expect(lead.organizationId).toBe(testOrgId);
      expect(lead.workspaceId).toBe(testWorkspaceId);
      expect(lead.score).toBe(50); // Default score (without enrichment)
      expect(lead.createdAt).toBeDefined();
    });

    it('should create lead with custom score', async () => {
      const lead = await createLead({
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
      const created = await createLead({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = created.id;

      // Retrieve it
      const lead = await getLead(testLeadId, testWorkspaceId);

      expect(lead).toBeDefined();
      expect(lead?.id).toBe(testLeadId);
      expect(lead?.firstName).toBe('Test');
    });

    it('should return null for non-existent lead', async () => {
      const lead = await getLead('non-existent-id', testWorkspaceId);
      expect(lead).toBeNull();
    });
  });

  describe('updateLead', () => {
    it('should update lead fields', async () => {
      // Create a lead
      const created = await createLead({
        firstName: 'Original',
        lastName: 'Name',
        email: 'original@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = created.id;

      // Update it
      const updated = await updateLead(testLeadId, {
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
        const lead = await createLead({
          firstName: `Lead`,
          lastName: `${i}`,
          email: `lead${i}@example.com`,
          status: 'new' as const,
        }, testWorkspaceId);
        leadIds.push(lead.id);
      }

      // Get first page
      const result = await getLeads(testWorkspaceId, undefined, { pageSize: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).toBeDefined();

      // Get second page
      const page2 = await getLeads(testWorkspaceId, undefined, {
        pageSize: 5,
        lastDoc: result.lastDoc!,
      });

      expect(page2.data).toHaveLength(5);
      expect(page2.data[0].id).not.toBe(result.data[0].id);

      // Cleanup
      for (const id of leadIds) {
        await deleteLead(id, testWorkspaceId);
      }
    });

    it('should filter leads by status', async () => {
      // Create leads with different statuses
      const newLead = await createLead({
        firstName: 'New',
        lastName: 'Lead',
        email: 'new@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const qualifiedLead = await createLead({
        firstName: 'Qualified',
        lastName: 'Lead',
        email: 'qualified@example.com',
        status: 'qualified' as const,
      }, testWorkspaceId);

      // Filter by status
      const result = await getLeads(testWorkspaceId, { status: 'qualified' });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.every(l => l.status === 'qualified')).toBe(true);

      // Cleanup
      await deleteLead(newLead.id, testWorkspaceId);
      await deleteLead(qualifiedLead.id, testWorkspaceId);
    });
  });

  describe('searchLeads', () => {
    it('should search leads by name', async () => {
      const lead = await createLead({
        firstName: 'Searchable',
        lastName: 'Lead',
        email: 'searchable@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = lead.id;

      const result = await searchLeads('Searchable', testWorkspaceId);

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some(l => l.id === testLeadId)).toBe(true);
    });

    it('should search leads by email', async () => {
      const lead = await createLead({
        firstName: 'Test',
        lastName: 'User',
        email: 'unique-email@example.com',
        status: 'new' as const,
      }, testWorkspaceId);
      testLeadId = lead.id;

      const result = await searchLeads('unique-email', testWorkspaceId);

      expect(result.data.some(l => l.id === testLeadId)).toBe(true);
    });
  });

  describe('bulkUpdateLeads', () => {
    it('should update multiple leads at once', async () => {
      // Create 3 leads
      const lead1 = await createLead({
        firstName: 'Bulk1',
        lastName: 'Test',
        email: 'bulk1@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const lead2 = await createLead({
        firstName: 'Bulk2',
        lastName: 'Test',
        email: 'bulk2@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      const lead3 = await createLead({
        firstName: 'Bulk3',
        lastName: 'Test',
        email: 'bulk3@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      // Bulk update
      const successCount = await bulkUpdateLeads(
        [lead1.id, lead2.id, lead3.id],
        { status: 'contacted' },
        testWorkspaceId
      );

      expect(successCount).toBe(3);

      // Verify updates
      const updated1 = await getLead(lead1.id, testWorkspaceId);
      expect(updated1?.status).toBe('contacted');

      // Cleanup
      await deleteLead(lead1.id, testWorkspaceId);
      await deleteLead(lead2.id, testWorkspaceId);
      await deleteLead(lead3.id, testWorkspaceId);
    });
  });

  describe('deleteLead', () => {
    it('should delete a lead', async () => {
      const lead = await createLead({
        firstName: 'Delete',
        lastName: 'Me',
        email: 'deleteme@example.com',
        status: 'new' as const,
      }, testWorkspaceId);

      await deleteLead(lead.id, testWorkspaceId);

      const deleted = await getLead(lead.id, testWorkspaceId);
      expect(deleted).toBeNull();
    });
  });
});




