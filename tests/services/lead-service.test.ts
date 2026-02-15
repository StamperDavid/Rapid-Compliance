/**
 * Lead Service Tests
 * Integration tests for lead service layer
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  searchLeads,
  bulkUpdateLeads,
} from '@/lib/crm/lead-service';

describe('LeadService', () => {
  let testLeadId: string;

  beforeEach(async () => {
    // PENTHOUSE: Uses PLATFORM_ID — no test org creation needed
  });

  afterEach(async () => {
    // Cleanup: Delete test lead if exists
    if (testLeadId) {
      try {
        await deleteLead(testLeadId);
      } catch {
        // Ignore - lead may already be deleted by test
      }
    }
  });

  afterAll(async () => {
    // PENTHOUSE: No test org cleanup needed — using PLATFORM_ID
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
      const lead = await createLead(leadData, { autoEnrich: false });
      testLeadId = lead.id;

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.firstName).toBe('John');
      expect(lead.lastName).toBe('Doe');
      expect(lead.email).toBe('john.doe@example.com');
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
      });
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
      });
      testLeadId = created.id;

      // Retrieve it
      const lead = await getLead(testLeadId);

      expect(lead).toBeDefined();
      expect(lead?.id).toBe(testLeadId);
      expect(lead?.firstName).toBe('Test');
    });

    it('should return null for non-existent lead', async () => {
      const lead = await getLead('non-existent-id');
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
      });
      testLeadId = created.id;

      // Update it
      const updated = await updateLead(testLeadId, {
        firstName: 'Updated',
        status: 'qualified',
        score: 90,
      });

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
        });
        leadIds.push(lead.id);
      }

      // Get first page
      const result = await getLeads(undefined, { pageSize: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
      expect(result.lastDoc).toBeDefined();

      // Get second page
      const page2 = await getLeads(undefined, {
        pageSize: 5,
        lastDoc: result.lastDoc!,
      });

      expect(page2.data).toHaveLength(5);
      expect(page2.data[0].id).not.toBe(result.data[0].id);

      // Cleanup
      for (const id of leadIds) {
        await deleteLead(id);
      }
    });

    it('should filter leads by status', async () => {
      // Create leads with different statuses
      const newLead = await createLead({
        firstName: 'New',
        lastName: 'Lead',
        email: 'new@example.com',
        status: 'new' as const,
      });

      const qualifiedLead = await createLead({
        firstName: 'Qualified',
        lastName: 'Lead',
        email: 'qualified@example.com',
        status: 'qualified' as const,
      });

      // Filter by status
      const result = await getLeads({ status: 'qualified' });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.every(l => l.status === 'qualified')).toBe(true);

      // Cleanup
      await deleteLead(newLead.id);
      await deleteLead(qualifiedLead.id);
    });
  });

  describe('searchLeads', () => {
    it('should search leads by name', async () => {
      const lead = await createLead({
        firstName: 'Searchable',
        lastName: 'Lead',
        email: 'searchable@example.com',
        status: 'new' as const,
      });
      testLeadId = lead.id;

      const result = await searchLeads('Searchable');

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some(l => l.id === testLeadId)).toBe(true);
    });

    it('should search leads by email', async () => {
      const lead = await createLead({
        firstName: 'Test',
        lastName: 'User',
        email: 'unique-email@example.com',
        status: 'new' as const,
      });
      testLeadId = lead.id;

      const result = await searchLeads('unique-email');

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
      });

      const lead2 = await createLead({
        firstName: 'Bulk2',
        lastName: 'Test',
        email: 'bulk2@example.com',
        status: 'new' as const,
      });

      const lead3 = await createLead({
        firstName: 'Bulk3',
        lastName: 'Test',
        email: 'bulk3@example.com',
        status: 'new' as const,
      });

      // Bulk update
      const successCount = await bulkUpdateLeads(
        [lead1.id, lead2.id, lead3.id],
        { status: 'qualified', score: 75 }
      );

      expect(successCount).toBe(3);

      // Verify updates
      const updated1 = await getLead(lead1.id);
      expect(updated1?.status).toBe('qualified');
      expect(updated1?.score).toBe(75);

      // Cleanup
      await deleteLead(lead1.id);
      await deleteLead(lead2.id);
      await deleteLead(lead3.id);
    });
  });
});




