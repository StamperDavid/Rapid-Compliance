/**
 * Unit Tests for Version Control
 * 
 * Tests diff generation, branch management, changelog generation,
 * and data recovery.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateDiff,
  validateIntegrity,
  exportChangelogToMarkdown,
  VersionControlError,
} from '@/lib/scraper-intelligence/version-control';
import type { TrainingData } from '@/types/scraper-intelligence';
import type { Changelog } from '@/lib/scraper-intelligence/version-control';

describe('Version Control', () => {
  describe('generateDiff', () => {
    const baseTrainingData: TrainingData = {
      id: 'training_123',
      organizationId: 'org_123',
      signalId: 'signal_456',
      pattern: 'hiring engineers',
      patternType: 'keyword',
      confidence: 75,
      positiveCount: 5,
      negativeCount: 2,
      seenCount: 7,
      createdAt: new Date('2024-01-01'),
      lastUpdatedAt: new Date('2024-01-01'),
      lastSeenAt: new Date('2024-01-01'),
      version: 1,
      active: true,
    };

    it('should generate diff for confidence change', () => {
      const before = { ...baseTrainingData };
      const after = { ...baseTrainingData, confidence: 85, version: 2 };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(1);
      expect(diff.changes[0].field).toBe('confidence');
      expect(diff.changes[0].oldValue).toBe(75);
      expect(diff.changes[0].newValue).toBe(85);
      expect(diff.changes[0].changeType).toBe('modified');
    });

    it('should generate diff for activation state change', () => {
      const before = { ...baseTrainingData, active: true };
      const after = { ...baseTrainingData, active: false, version: 2 };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(1);
      expect(diff.changes[0].field).toBe('active');
      expect(diff.summary).toContain('Deactivated');
    });

    it('should generate diff for feedback count changes', () => {
      const before = { ...baseTrainingData, positiveCount: 5, negativeCount: 2 };
      const after = { ...baseTrainingData, positiveCount: 6, negativeCount: 2, version: 2 };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(1);
      expect(diff.changes[0].field).toBe('positiveCount');
      expect(diff.summary).toContain('Positive feedback');
    });

    it('should detect no changes', () => {
      const before = { ...baseTrainingData };
      const after = { ...baseTrainingData };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(0);
      expect(diff.summary).toBe('No changes');
    });

    it('should generate diff for pattern change', () => {
      const before = { ...baseTrainingData, pattern: 'old pattern' };
      const after = { ...baseTrainingData, pattern: 'new pattern', version: 2 };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(1);
      expect(diff.changes[0].field).toBe('pattern');
      expect(diff.summary).toContain('Pattern modified');
    });

    it('should generate diff for multiple changes', () => {
      const before = {
        ...baseTrainingData,
        confidence: 75,
        positiveCount: 5,
        active: true,
      };
      const after = {
        ...baseTrainingData,
        confidence: 85,
        positiveCount: 6,
        active: false,
        version: 2,
      };

      const diff = generateDiff(before, after);

      expect(diff.changes.length).toBe(3);
      expect(diff.changes.some((c) => c.field === 'confidence')).toBe(true);
      expect(diff.changes.some((c) => c.field === 'positiveCount')).toBe(true);
      expect(diff.changes.some((c) => c.field === 'active')).toBe(true);
    });

    it('should throw error for different training data IDs', () => {
      const before = { ...baseTrainingData, id: 'training_123' };
      const after = { ...baseTrainingData, id: 'training_456' };

      expect(() => generateDiff(before, after)).toThrow(VersionControlError);
      expect(() => generateDiff(before, after)).toThrow('different training data');
    });

    it('should detect added field', () => {
      const before: any = { ...baseTrainingData, embedding: undefined };
      const after: any = {
        ...baseTrainingData,
        embedding: [0.1, 0.2, 0.3],
        version: 2,
      };

      const diff = generateDiff(before, after);

      const embeddingChange = diff.changes.find((c) => c.field === 'embedding');
      expect(embeddingChange).toBeDefined();
      expect(embeddingChange?.changeType).toBe('added');
    });

    it('should detect removed field', () => {
      const before: any = {
        ...baseTrainingData,
        embedding: [0.1, 0.2, 0.3],
      };
      const after: any = { ...baseTrainingData, embedding: undefined, version: 2 };

      const diff = generateDiff(before, after);

      const embeddingChange = diff.changes.find((c) => c.field === 'embedding');
      expect(embeddingChange).toBeDefined();
      expect(embeddingChange?.changeType).toBe('removed');
    });

    it('should detect metadata changes', () => {
      const before = {
        ...baseTrainingData,
        metadata: { industry: 'tech', examples: ['test'] },
      };
      const after = {
        ...baseTrainingData,
        metadata: { industry: 'finance', examples: ['test'] },
        version: 2,
      };

      const diff = generateDiff(before, after);

      const metadataChange = diff.changes.find((c) => c.field === 'metadata');
      expect(metadataChange).toBeDefined();
    });
  });

  describe('validateIntegrity', () => {
    const validTrainingData: TrainingData = {
      id: 'training_123',
      organizationId: 'org_123',
      signalId: 'signal_456',
      pattern: 'hiring engineers',
      patternType: 'keyword',
      confidence: 75,
      positiveCount: 5,
      negativeCount: 2,
      seenCount: 7,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      lastSeenAt: new Date(),
      version: 1,
      active: true,
    };

    it('should validate correct training data', () => {
      const result = validateIntegrity(validTrainingData);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing id', () => {
      const invalid: any = { ...validTrainingData, id: '' };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing id');
    });

    it('should detect missing organizationId', () => {
      const invalid: any = { ...validTrainingData, organizationId: '' };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing organizationId');
    });

    it('should detect missing signalId', () => {
      const invalid: any = { ...validTrainingData, signalId: '' };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing signalId');
    });

    it('should detect missing pattern', () => {
      const invalid: any = { ...validTrainingData, pattern: '' };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing pattern');
    });

    it('should detect invalid confidence (negative)', () => {
      const invalid = { ...validTrainingData, confidence: -10 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid confidence (must be 0-100)');
    });

    it('should detect invalid confidence (too high)', () => {
      const invalid = { ...validTrainingData, confidence: 150 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid confidence (must be 0-100)');
    });

    it('should detect invalid positiveCount', () => {
      const invalid = { ...validTrainingData, positiveCount: -1 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid positiveCount (must be >= 0)');
    });

    it('should detect invalid negativeCount', () => {
      const invalid = { ...validTrainingData, negativeCount: -1 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid negativeCount (must be >= 0)');
    });

    it('should detect invalid seenCount', () => {
      const invalid = { ...validTrainingData, seenCount: -1 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid seenCount (must be >= 0)');
    });

    it('should detect invalid version', () => {
      const invalid = { ...validTrainingData, version: 0 };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid version (must be > 0)');
    });

    it('should detect inconsistent seenCount', () => {
      const invalid = {
        ...validTrainingData,
        positiveCount: 5,
        negativeCount: 3,
        seenCount: 7, // Should be at least 8
      };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('seenCount less than total feedback count');
    });

    it('should detect multiple errors', () => {
      const invalid: any = {
        ...validTrainingData,
        id: '',
        confidence: -10,
        positiveCount: -1,
      };

      const result = validateIntegrity(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept edge case: zero feedback', () => {
      const edgeCase = {
        ...validTrainingData,
        positiveCount: 0,
        negativeCount: 0,
        seenCount: 0,
      };

      const result = validateIntegrity(edgeCase);

      expect(result.valid).toBe(true);
    });

    it('should accept confidence at boundaries', () => {
      const min = { ...validTrainingData, confidence: 0 };
      const max = { ...validTrainingData, confidence: 100 };

      expect(validateIntegrity(min).valid).toBe(true);
      expect(validateIntegrity(max).valid).toBe(true);
    });
  });

  describe('exportChangelogToMarkdown', () => {
    it('should export changelog to markdown', () => {
      const changelog: Changelog = {
        organizationId: 'org_123',
        generatedAt: new Date('2024-01-01T00:00:00Z'),
        entries: [
          {
            version: 2,
            date: new Date('2024-01-02'),
            author: 'user_123',
            changes: ['Updated training pattern', 'Confidence: 75 → 85'],
            type: 'patch',
          },
          {
            version: 1,
            date: new Date('2024-01-01'),
            author: 'user_456',
            changes: ['Created new training pattern'],
            type: 'minor',
          },
        ],
      };

      const markdown = exportChangelogToMarkdown(changelog);

      expect(markdown).toContain('# Training Data Changelog');
      expect(markdown).toContain('Version 2');
      expect(markdown).toContain('Version 1');
      expect(markdown).toContain('user_123');
      expect(markdown).toContain('user_456');
      expect(markdown).toContain('Updated training pattern');
      expect(markdown).toContain('Created new training pattern');
    });

    it('should include change type badges', () => {
      const changelog: Changelog = {
        organizationId: 'org_123',
        generatedAt: new Date(),
        entries: [
          {
            version: 3,
            date: new Date(),
            author: 'user_123',
            changes: ['Deleted pattern'],
            type: 'major',
          },
          {
            version: 2,
            date: new Date(),
            author: 'user_123',
            changes: ['Added pattern'],
            type: 'minor',
          },
          {
            version: 1,
            date: new Date(),
            author: 'user_123',
            changes: ['Updated pattern'],
            type: 'patch',
          },
        ],
      };

      const markdown = exportChangelogToMarkdown(changelog);

      expect(markdown).toContain('🔴'); // Major
      expect(markdown).toContain('🟡'); // Minor
      expect(markdown).toContain('🟢'); // Patch
    });

    it('should handle empty changelog', () => {
      const changelog: Changelog = {
        organizationId: 'org_123',
        generatedAt: new Date(),
        entries: [],
      };

      const markdown = exportChangelogToMarkdown(changelog);

      expect(markdown).toContain('# Training Data Changelog');
      expect(markdown).toContain('Generated:');
    });

    it('should format dates correctly', () => {
      const changelog: Changelog = {
        organizationId: 'org_123',
        generatedAt: new Date('2024-01-01T00:00:00Z'),
        entries: [
          {
            version: 1,
            date: new Date('2024-01-15T12:30:00Z'),
            author: 'user_123',
            changes: ['Test'],
            type: 'patch',
          },
        ],
      };

      const markdown = exportChangelogToMarkdown(changelog);

      expect(markdown).toContain('2024-01-01'); // Generated date
      expect(markdown).toContain('2024-01-15'); // Entry date
    });

    it('should list all changes for an entry', () => {
      const changelog: Changelog = {
        organizationId: 'org_123',
        generatedAt: new Date(),
        entries: [
          {
            version: 1,
            date: new Date(),
            author: 'user_123',
            changes: [
              'Change 1',
              'Change 2',
              'Change 3',
            ],
            type: 'patch',
          },
        ],
      };

      const markdown = exportChangelogToMarkdown(changelog);

      expect(markdown).toContain('- Change 1');
      expect(markdown).toContain('- Change 2');
      expect(markdown).toContain('- Change 3');
    });
  });

  describe('VersionControlError', () => {
    it('should create error with correct properties', () => {
      const error = new VersionControlError(
        'Test error',
        'TEST_ERROR',
        400
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('VersionControlError');
    });

    it('should default to 500 status code', () => {
      const error = new VersionControlError(
        'Test error',
        'TEST_ERROR'
      );

      expect(error.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle diff with null values', () => {
      const before: any = {
        id: 'training_123',
        organizationId: 'org_123',
        signalId: 'signal_456',
        pattern: 'test',
        patternType: 'keyword',
        confidence: 75,
        positiveCount: 5,
        negativeCount: 2,
        seenCount: 7,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        lastSeenAt: new Date(),
        version: 1,
        active: true,
        metadata: null,
      };
      const after: any = {
        ...before,
        metadata: { test: 'value' },
        version: 2,
      };

      const diff = generateDiff(before, after);

      const metadataChange = diff.changes.find((c) => c.field === 'metadata');
      expect(metadataChange).toBeDefined();
      expect(metadataChange?.changeType).toBe('added');
    });

    it('should handle validation with boundary values', () => {
      const boundary: TrainingData = {
        id: 'training_123',
        organizationId: 'org_123',
        signalId: 'signal_456',
        pattern: 'a', // Minimal pattern
        patternType: 'keyword',
        confidence: 0, // Min confidence
        positiveCount: 0,
        negativeCount: 0,
        seenCount: 0,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        lastSeenAt: new Date(),
        version: 1,
        active: false,
      };

      const result = validateIntegrity(boundary);

      expect(result.valid).toBe(true);
    });
  });
});
