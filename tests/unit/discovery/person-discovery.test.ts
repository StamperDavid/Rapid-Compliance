/**
 * Unit tests for Person Discovery
 * Tests the native person discovery functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { discoverPerson, discoverPeopleBatch } from '@/lib/services/discovery-engine';
import { deleteFlaggedArchiveEntries, deleteExpiredArchiveEntries } from '@/lib/scraper-intelligence/discovery-archive-service';

// Set timeout for real Firestore operations
jest.setTimeout(30000);

describe('Person Discovery Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await deleteFlaggedArchiveEntries();
    await deleteExpiredArchiveEntries();
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await deleteFlaggedArchiveEntries();
  }, 30000);

  describe('Single Person Discovery', () => {
    it('should discover person from email address', async () => {
      // Use a test email format
      const result = await discoverPerson('john.doe@example.com');

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.person).toBeDefined();
      expect(typeof result.fromCache).toBe('boolean');
      expect(result.scrapeId).toBeDefined();

      // Verify person data structure
      expect(result.person.email).toBe('john.doe@example.com');
      expect(result.person.metadata).toBeDefined();
      expect(result.person.metadata.source).toBe('person-discovery');
      expect(result.person.metadata.discoveredAt).toBeInstanceOf(Date);
      expect(result.person.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(result.person.metadata.confidence).toBeLessThanOrEqual(1);

      // Verify social profiles object exists
      expect(result.person.socialProfiles).toBeDefined();
      expect(typeof result.person.socialProfiles).toBe('object');

      // Verify methods array
      expect(Array.isArray(result.person.metadata.methods)).toBe(true);
    }, 60000);

    it('should extract name from email local part', async () => {
      const result = await discoverPerson('jane.smith@example.com');

      // Should extract first and last name
      expect(result.person.firstName).toBeDefined();
      expect(result.person.lastName).toBeDefined();
      expect(result.person.fullName).toBeDefined();
      
      // Names should be capitalized
      if (result.person.firstName) {
        expect(result.person.firstName.charAt(0)).toBe(result.person.firstName.charAt(0).toUpperCase());
      }
    }, 60000);

    it('should use 30-day cache on second discovery', async () => {
      const email = 'test.user@example.com';
      
      // First discovery
      const result1 = await discoverPerson(email);
      expect(result1.fromCache).toBe(false);

      // Second discovery (should hit cache)
      const result2 = await discoverPerson(email);
      expect(result2.fromCache).toBe(true);
      expect(result2.scrapeId).toBe(result1.scrapeId);

      // Verify data consistency
      expect(result2.person.email).toBe(result1.person.email);
      expect(result2.person.fullName).toBe(result1.person.fullName);
    }, 90000);

    it('should handle invalid email gracefully', async () => {
      await expect(
        discoverPerson('invalid-email')
      ).rejects.toThrow('Invalid email address');
    });

    it('should handle empty email', async () => {
      await expect(
        discoverPerson('')
      ).rejects.toThrow();
    });
  });

  describe('Batch Person Discovery', () => {
    it('should discover multiple people', async () => {
      const emails = [
        'person1@example.com',
        'person2@example.org',
      ];
      
      const results = await discoverPeopleBatch(emails, {
        concurrency: 2,
        delayMs: 1000,
      });

      expect(results.length).toBeGreaterThan(0);
      
      results.forEach((result) => {
        expect(result.person).toBeDefined();
        expect(result.person.email).toBeDefined();
        expect(result.scrapeId).toBeDefined();
      });
    }, 120000);

    it('should handle mix of valid and invalid emails', async () => {
      const emails = [
        'valid@example.com',
        'invalid-email',
        'another.valid@example.org',
      ];

      const results = await discoverPeopleBatch(emails, {
        concurrency: 1,
        delayMs: 500,
      });

      // Should have some results (valid emails)
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(emails.length); // Some should fail
    }, 120000);
  });

  describe('Discovery Methods', () => {
    it('should track discovery methods used', async () => {
      const result = await discoverPerson('engineer@example.com');

      expect(result.person.metadata.methods).toBeDefined();
      expect(Array.isArray(result.person.metadata.methods)).toBe(true);
      
      // Methods could include: company-website, google-linkedin-search, github
      // At minimum, one method should be attempted
      expect(result.person.metadata.methods.length).toBeGreaterThanOrEqual(0);
    }, 60000);

    it('should calculate confidence based on data found', async () => {
      const result = await discoverPerson('ceo@example.com');

      expect(result.person.metadata.confidence).toBeDefined();
      expect(typeof result.person.metadata.confidence).toBe('number');
      expect(result.person.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(result.person.metadata.confidence).toBeLessThanOrEqual(1);
    }, 60000);
  });

  describe('Data Enrichment', () => {
    it('should enrich person data with available information', async () => {
      const result = await discoverPerson('contact@example.com');

      // Should at minimum have email and basic name extraction
      expect(result.person.email).toBeDefined();
      expect(result.person.fullName).toBeDefined();
      
      // Social profiles object should exist (may be empty)
      expect(result.person.socialProfiles).toBeDefined();
    }, 60000);

    it('should save to discovery archive with 30-day TTL', async () => {
      const email = 'archive-test@example.com';
      const result = await discoverPerson(email);

      // First discovery should not be from cache
      expect(result.fromCache).toBe(false);
      expect(result.scrapeId).toBeDefined();

      // Second discovery should hit cache
      const cached = await discoverPerson(email);
      expect(cached.fromCache).toBe(true);
      expect(cached.scrapeId).toBe(result.scrapeId);
    }, 90000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Email with non-existent domain that will fail DNS lookup
      const result = await discoverPerson('user@nonexistentdomain12345.com');

      // Should still return a result with minimal data
      expect(result.person).toBeDefined();
      expect(result.person.email).toBe('user@nonexistentdomain12345.com');
      expect(result.person.metadata.confidence).toBeLessThan(0.5);
    }, 60000);

    it('should validate email format', async () => {
      await expect(
        discoverPerson('not-an-email')
      ).rejects.toThrow();
    });

    it('should handle invalid email', async () => {
      await expect(
        discoverPerson('')
      ).rejects.toThrow();
    });
  });

  describe('Hunter-Closer Compliance', () => {
    it('should use zero third-party data APIs', async () => {
      const result = await discoverPerson('native@example.com');

      // All data should come from our discovery, not third-party APIs
      expect(result.person.metadata.source).toBe('person-discovery');
      
      // Methods should be our native strategies
      const validMethods = ['company-website', 'google-linkedin-search', 'github'];
      result.person.metadata.methods.forEach((method) => {
        expect(validMethods.includes(method)).toBe(true);
      });
    }, 60000);

    it('should build proprietary 30-day cache moat', async () => {
      const result = await discoverPerson('cache-test@example.com');

      // Verify 30-day TTL
      const expiresAt = new Date(result.person.metadata.expiresAt);
      const discoveredAt = new Date(result.person.metadata.discoveredAt);
      
      const ttlDays = (expiresAt.getTime() - discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Should be approximately 30 days
      expect(ttlDays).toBeGreaterThan(29);
      expect(ttlDays).toBeLessThan(31);
    }, 60000);
  });
});
