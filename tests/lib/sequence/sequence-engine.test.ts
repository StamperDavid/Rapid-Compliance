/**
 * Email Sequence Intelligence Engine - Unit Tests
 * 
 * Comprehensive test suite for sequence analysis functionality.
 * 
 * @module tests/lib/sequence/sequence-engine
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  SequenceIntelligenceEngine,
  type SequenceAnalysisInput,
  type SequenceMetrics,
  type SequencePattern,
} from '@/lib/sequence';

// Mock AI service
jest.mock('@/lib/ai/unified-ai-service', () => ({
  sendUnifiedChatMessage: jest.fn(),
}));

describe('SequenceIntelligenceEngine', () => {
  let engine: SequenceIntelligenceEngine;
  
  beforeEach(() => {
    engine = new SequenceIntelligenceEngine();
    jest.clearAllMocks();
  });
  
  // ============================================================================
  // SEQUENCE ANALYSIS TESTS
  // ============================================================================
  
  describe('analyzeSequences', () => {
    it('should analyze sequences with valid input', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        includePatterns: true,
        includeOptimizations: true,
        includeTimingAnalysis: true,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
      expect(analysis.analysisId).toBeDefined();
      expect(analysis.sequences).toHaveLength(1);
      expect(analysis.metrics).toHaveLength(1);
      expect(analysis.summary).toBeDefined();
    });
    
    it('should handle multiple sequences', async () => {
      const input: SequenceAnalysisInput = {
        sequenceIds: ['seq-1', 'seq-2', 'seq-3'],
        includePatterns: true,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.sequences).toHaveLength(3);
      expect(analysis.metrics).toHaveLength(3);
    });
    
    it('should use default time range if not provided', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.timeRange.start).toBeInstanceOf(Date);
      expect(analysis.timeRange.end).toBeInstanceOf(Date);
      expect(analysis.timeRange.end.getTime()).toBeGreaterThan(
        analysis.timeRange.start.getTime()
      );
    });
    
    it('should include patterns when requested', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        includePatterns: true,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.patterns).toBeDefined();
    });
    
    it('should include optimizations when requested', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        includeOptimizations: true,
        includePatterns: true,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.optimizations).toBeDefined();
    });
    
    it('should include timing analysis when requested', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        includeTimingAnalysis: true,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.timingAnalysis).toBeDefined();
      expect(analysis.timingAnalysis?.bestSendTimes).toBeDefined();
      expect(analysis.timingAnalysis?.bestDaysOfWeek).toBeDefined();
    });
    
    it('should generate AI insights', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.aiInsights).toBeDefined();
      expect(analysis.aiInsights?.keyFindings).toBeDefined();
      expect(analysis.aiInsights?.concerns).toBeDefined();
      expect(analysis.aiInsights?.opportunities).toBeDefined();
      expect(analysis.aiInsights?.nextSteps).toBeDefined();
    });
    
    it('should calculate summary correctly', async () => {
      const input: SequenceAnalysisInput = {
        sequenceIds: ['seq-1', 'seq-2'],
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.summary.totalSequences).toBe(2);
      expect(analysis.summary.totalRecipients).toBeGreaterThan(0);
      expect(analysis.summary.totalEmails).toBeGreaterThan(0);
      expect(analysis.summary.avgReplyRate).toBeGreaterThanOrEqual(0);
      expect(analysis.summary.avgReplyRate).toBeLessThanOrEqual(100);
      expect(analysis.summary.topPerformingSequence).toBeDefined();
      expect(analysis.summary.lowestPerformingSequence).toBeDefined();
    });
    
    it('should throw error for invalid input', async () => {
      const invalidInput = {
        // Missing sequenceId or sequenceIds
        includePatterns: true,
      } as unknown as SequenceAnalysisInput;

      await expect(engine.analyzeSequences(invalidInput)).rejects.toThrow();
    });
  });
  
  // ============================================================================
  // PATTERN DETECTION TESTS
  // ============================================================================
  
  describe('detectPatterns', () => {
    it('should detect patterns from sequence metrics', async () => {
      const metrics: SequenceMetrics[] = [{
        sequenceId: 'seq-1',
        sequenceName: 'Test Sequence',
        totalRecipients: 100,
        activeExecutions: 20,
        completedExecutions: 75,
        stoppedExecutions: 5,
        totalSent: 300,
        totalDelivered: 290,
        totalOpened: 145,
        totalClicked: 60,
        totalReplied: 25,
        totalUnsubscribed: 5,
        overallDeliveryRate: 96.7,
        overallOpenRate: 50.0,
        overallClickRate: 20.7,
        overallReplyRate: 8.6,
        overallUnsubscribeRate: 1.7,
        conversationStarted: 12,
        meetingBooked: 8,
        opportunityCreated: 5,
        conversationRate: 12.0,
        meetingRate: 8.0,
        opportunityRate: 5.0,
        stepMetrics: [],
        startDate: new Date(),
        endDate: new Date(),
        dataPoints: 100,
      }];
      
      const patterns = await engine.detectPatterns({
        sequenceMetrics: metrics,
        minimumSampleSize: 50,
        minimumLift: 10,
      });
      
      expect(Array.isArray(patterns)).toBe(true);
    });
    
    it('should filter out patterns with insufficient sample size', async () => {
      const metrics: SequenceMetrics[] = [{
        sequenceId: 'seq-1',
        sequenceName: 'Small Sequence',
        totalRecipients: 10, // Too small
        activeExecutions: 2,
        completedExecutions: 8,
        stoppedExecutions: 0,
        totalSent: 30,
        totalDelivered: 29,
        totalOpened: 15,
        totalClicked: 6,
        totalReplied: 2,
        totalUnsubscribed: 1,
        overallDeliveryRate: 96.7,
        overallOpenRate: 50.0,
        overallClickRate: 20.0,
        overallReplyRate: 6.7,
        overallUnsubscribeRate: 3.3,
        conversationStarted: 1,
        meetingBooked: 0,
        opportunityCreated: 0,
        conversationRate: 10.0,
        meetingRate: 0.0,
        opportunityRate: 0.0,
        stepMetrics: [],
        startDate: new Date(),
        endDate: new Date(),
        dataPoints: 10,
      }];
      
      const patterns = await engine.detectPatterns({
        sequenceMetrics: metrics,
        minimumSampleSize: 50,
      });
      
      expect(patterns).toHaveLength(0);
    });
    
    it('should reject when no metrics provided (Zod min validation)', async () => {
      await expect(
        engine.detectPatterns({ sequenceMetrics: [] })
      ).rejects.toThrow();
    });
  });
  
  // ============================================================================
  // OPTIMIZATION TESTS
  // ============================================================================
  
  describe('generateOptimizations', () => {
    it('should generate optimizations for sequences', async () => {
      const metrics: SequenceMetrics[] = [{
        sequenceId: 'seq-1',
        sequenceName: 'Test Sequence',
        totalRecipients: 100,
        activeExecutions: 20,
        completedExecutions: 75,
        stoppedExecutions: 5,
        totalSent: 300,
        totalDelivered: 290,
        totalOpened: 145,
        totalClicked: 60,
        totalReplied: 25,
        totalUnsubscribed: 5,
        overallDeliveryRate: 96.7,
        overallOpenRate: 50.0,
        overallClickRate: 20.7,
        overallReplyRate: 8.6,
        overallUnsubscribeRate: 1.7,
        conversationStarted: 12,
        meetingBooked: 8,
        opportunityCreated: 5,
        conversationRate: 12.0,
        meetingRate: 8.0,
        opportunityRate: 5.0,
        stepMetrics: [],
        startDate: new Date(),
        endDate: new Date(),
        dataPoints: 100,
      }];
      
      const patterns: SequencePattern[] = [];
      
      const optimizations = await engine.generateOptimizations(metrics, patterns);
      
      expect(Array.isArray(optimizations)).toBe(true);
    });
    
    it('should sort optimizations by priority', async () => {
      const metrics: SequenceMetrics[] = [{
        sequenceId: 'seq-1',
        sequenceName: 'Test Sequence',
        totalRecipients: 100,
        activeExecutions: 20,
        completedExecutions: 75,
        stoppedExecutions: 5,
        totalSent: 300,
        totalDelivered: 290,
        totalOpened: 145,
        totalClicked: 60,
        totalReplied: 25,
        totalUnsubscribed: 5,
        overallDeliveryRate: 96.7,
        overallOpenRate: 50.0,
        overallClickRate: 20.7,
        overallReplyRate: 8.6,
        overallUnsubscribeRate: 1.7,
        conversationStarted: 12,
        meetingBooked: 8,
        opportunityCreated: 5,
        conversationRate: 12.0,
        meetingRate: 8.0,
        opportunityRate: 5.0,
        stepMetrics: [],
        startDate: new Date(),
        endDate: new Date(),
        dataPoints: 100,
      }];
      
      const patterns: SequencePattern[] = [];
      const optimizations = await engine.generateOptimizations(metrics, patterns);
      
      if (optimizations.length > 1) {
        const priorities = ['critical', 'high', 'medium', 'low'];
        for (let i = 0; i < optimizations.length - 1; i++) {
          const currentPriority = priorities.indexOf(optimizations[i].priority);
          const nextPriority = priorities.indexOf(optimizations[i + 1].priority);
          expect(currentPriority).toBeLessThanOrEqual(nextPriority);
        }
      }
    });
  });
  
  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  
  describe('Input Validation', () => {
    it('should reject analysis with no sequence identifier', async () => {
      const input = {
        includePatterns: true,
      } as unknown as SequenceAnalysisInput;

      await expect(engine.analyzeSequences(input)).rejects.toThrow();
    });
    
    it('should reject pattern detection with empty metrics', async () => {
      await expect(
        engine.detectPatterns({ sequenceMetrics: [] })
      ).rejects.toThrow();
    });
    
    it('should handle invalid date ranges', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2024-01-01'), // End before start
      };
      
      // Should still complete without error, engine handles this
      const analysis = await engine.analyzeSequences(input);
      expect(analysis).toBeDefined();
    });
  });
  
  // ============================================================================
  // EDGE CASES
  // ============================================================================
  
  describe('Edge Cases', () => {
    it('should handle sequences with zero recipients', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'empty-seq',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
      expect(analysis.summary.totalRecipients).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle sequences with 100% engagement', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'perfect-seq',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
    });
    
    it('should handle sequences with 0% engagement', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'dead-seq',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
    });
    
    it('should handle custom date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        startDate,
        endDate,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis.timeRange.start.getTime()).toBe(startDate.getTime());
      expect(analysis.timeRange.end.getTime()).toBe(endDate.getTime());
    });
  });
  
  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  
  describe('Integration', () => {
    it('should generate complete analysis with all features', async () => {
      const input: SequenceAnalysisInput = {
        sequenceIds: ['seq-1', 'seq-2'],
        includePatterns: true,
        includeOptimizations: true,
        includeTimingAnalysis: true,
        includeABTests: false,
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
      expect(analysis.sequences).toHaveLength(2);
      expect(analysis.metrics).toHaveLength(2);
      expect(analysis.patterns).toBeDefined();
      expect(analysis.optimizations).toBeDefined();
      expect(analysis.timingAnalysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.aiInsights).toBeDefined();
    });
    
    it('should handle recipient segment filtering', async () => {
      const input: SequenceAnalysisInput = {
        sequenceId: 'test-seq-1',
        recipientSegment: 'enterprise',
      };
      
      const analysis = await engine.analyzeSequences(input);
      
      expect(analysis).toBeDefined();
    });
  });
});
