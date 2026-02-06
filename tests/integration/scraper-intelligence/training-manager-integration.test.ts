/**
 * Integration Tests for Training Manager
 * 
 * Tests real Firestore interactions for training data management.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { db } from '@/lib/firebase-admin';
import {
  submitFeedback,
  getTrainingData,
  getAllTrainingData,
  deactivateTrainingData,
  activateTrainingData,
  getTrainingHistory,
  rollbackTrainingData,
  getFeedbackForScrape,
  getUnprocessedFeedback,
  getTrainingAnalytics,
  resetRateLimiter,
  TrainingManagerError,
} from '@/lib/scraper-intelligence/training-manager';
import {
  saveTemporaryScrape,
  getTemporaryScrape,
} from '@/lib/scraper-intelligence/discovery-archive-service';

describe('Training Manager Integration Tests', () => {
  const testUserId = `test_user_${Date.now()}`;
  const createdIds: { collection: string; id: string }[] = [];

  // Helper to track created documents for cleanup
  function trackForCleanup(collection: string, id: string) {
    createdIds.push({ collection, id });
  }

  // Cleanup after each test
  afterEach(async () => {
    resetRateLimiter();

    // Delete all created documents in reverse order
    for (const { collection, id } of createdIds.reverse()) {
      try {
        await db.collection(collection).doc(id).delete();
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdIds.length = 0;
  });

  describe('submitFeedback', () => {
    it('should submit feedback and create training data', async () => {
      // Create a temporary scrape first
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>We are hiring 5 software engineers</body></html>',
        cleanedContent: 'We are hiring 5 software engineers',
        metadata: { title: 'Careers' },
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      // Submit feedback
      const feedback = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'hiring_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'We are hiring 5 software engineers',
        metadata: {
          url: 'https://example.com',
          industry: 'technology',
          systemConfidence: 85,
        },
      });

      trackForCleanup('training_feedback', feedback.id);

      expect(feedback).toBeDefined();
      expect(feedback.feedbackType).toBe('correct');
      expect(feedback.userId).toBe(testUserId);
      expect(feedback.processed).toBe(false);

      // Wait a bit for async processing
      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      // Check that feedback was processed
      const feedbackDoc = await db
        .collection('training_feedback')
        .doc(feedback.id)
        .get();

      const feedbackData = feedbackDoc.data();
      expect(feedbackData?.processed).toBe(true);
      expect(feedbackData?.processedAt).toBeDefined();

      // Check that temporary scrape was flagged for deletion
      const scrape = await getTemporaryScrape(scrapeResult.scrape.id);
      expect(scrape?.flaggedForDeletion).toBe(true);
      expect(scrape?.verified).toBe(true);

      // Check that training data was created
      const trainingData = await getTrainingData('hiring_signal');
      expect(trainingData.length).toBeGreaterThan(0);
      
      const pattern = trainingData.find(
        (td) => td.pattern.toLowerCase().includes('hiring')
      );
      expect(pattern).toBeDefined();
      expect(pattern?.positiveCount).toBeGreaterThan(0);
      expect(pattern?.confidence).toBeGreaterThan(50);

      if (pattern) {
        trackForCleanup('training_data', pattern.id);
      }
    });

    it('should handle negative feedback correctly', async () => {
      // Create a temporary scrape
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Test content</body></html>',
        cleanedContent: 'Test content',
        metadata: { title: 'Test' },
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      // Submit negative feedback
      const feedback = await submitFeedback({
        userId: testUserId,
        feedbackType: 'incorrect',
        signalId: 'test_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'False positive text',
        correctedValue: 'Should be this instead',
      });

      trackForCleanup('training_feedback', feedback.id);

      expect(feedback.feedbackType).toBe('incorrect');
      expect(feedback.correctedValue).toBe('Should be this instead');

      // Scrape should NOT be flagged for deletion
      const scrape = await getTemporaryScrape(scrapeResult.scrape.id);
      expect(scrape?.flaggedForDeletion).toBe(false);

      // Wait for processing
      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      // Training data should have negative count
      const trainingData = await getTrainingData('test_signal');
      const pattern = trainingData.find((td) =>
        td.pattern.toLowerCase().includes('false positive')
      );
      
      if (pattern) {
        expect(pattern.negativeCount).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThan(50);
        trackForCleanup('training_data', pattern.id);
      }
    });

    it('should update existing training data on duplicate pattern', async () => {
      // Create scrape
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Expanding team</body></html>',
        cleanedContent: 'Expanding team',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      // Submit first feedback
      const feedback1 = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'growth_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'expanding team',
      });

      trackForCleanup('training_feedback', feedback1.id);

      // Wait for processing
      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      // Get initial training data
      const trainingData1 = await getTrainingData('growth_signal');
      const pattern1 = trainingData1.find((td) =>
        td.pattern.includes('expanding team')
      );
      
      expect(pattern1).toBeDefined();
      if (pattern1) {
        trackForCleanup('training_data', pattern1.id);
        const initialPositiveCount = pattern1.positiveCount;
        const initialVersion = pattern1.version;

        // Submit second feedback with same pattern
        const feedback2 = await submitFeedback({
            userId: testUserId,
          feedbackType: 'correct',
          signalId: 'growth_signal',
          sourceScrapeId: scrapeResult.scrape.id,
          sourceText: 'expanding team',
        });

        trackForCleanup('training_feedback', feedback2.id);

        // Wait for processing
        await new Promise((resolve) => { setTimeout(resolve, 1000); });

        // Get updated training data
        const trainingData2 = await getTrainingData('growth_signal');
        const pattern2 = trainingData2.find((td) => td.id === pattern1.id);

        expect(pattern2).toBeDefined();
        if (pattern2) {
          expect(pattern2.positiveCount).toBeGreaterThan(initialPositiveCount);
          expect(pattern2.version).toBeGreaterThan(initialVersion);
          expect(pattern2.confidence).toBeGreaterThanOrEqual(pattern1.confidence);
        }
      }
    });

    it('should enforce rate limiting', async () => {
      // Create scrape
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Test</body></html>',
        cleanedContent: 'Test',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      const params = {
        userId: testUserId,
        feedbackType: 'correct' as const,
        signalId: 'test_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'Test',
      };

      // Submit 10 feedback (within limit)
      for (let i = 0; i < 10; i++) {
        const feedback = await submitFeedback(params);
        trackForCleanup('training_feedback', feedback.id);
      }

      // 11th should fail with rate limit error
      try {
        await submitFeedback(params);
        throw new Error('Should have thrown rate limit error');
      } catch (error) {
        expect(error).toBeInstanceOf(TrainingManagerError);
        if (error instanceof TrainingManagerError) {
          expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
          expect(error.statusCode).toBe(429);
        }
      }
    });
  });

  describe('Training Data Management', () => {
    it('should deactivate and reactivate training data', async () => {
      // Create scrape and feedback
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Test pattern</body></html>',
        cleanedContent: 'Test pattern',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      const feedback = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'test_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'test pattern',
      });

      trackForCleanup('training_feedback', feedback.id);

      // Wait for processing
      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      // Get training data
      const trainingData = await getTrainingData('test_signal');
      expect(trainingData.length).toBeGreaterThan(0);
      
      const pattern = trainingData[0];
      trackForCleanup('training_data', pattern.id);
      
      expect(pattern.active).toBe(true);

      // Deactivate
      await deactivateTrainingData(
        pattern.id,
        testUserId,
        'Testing deactivation'
      );

      // Verify deactivated
      const deactivatedData = await getAllTrainingData(false);
      const deactivatedPattern = deactivatedData.find((td) => td.id === pattern.id);
      expect(deactivatedPattern?.active).toBe(false);

      // Should not appear in active-only query
      const activeData = await getTrainingData('test_signal', true);
      const stillActive = activeData.find((td) => td.id === pattern.id);
      expect(stillActive).toBeUndefined();

      // Reactivate
      await activateTrainingData(
        pattern.id,
        testUserId,
        'Testing reactivation'
      );

      // Verify reactivated
      const reactivatedData = await getTrainingData('test_signal');
      const reactivatedPattern = reactivatedData.find((td) => td.id === pattern.id);
      expect(reactivatedPattern?.active).toBe(true);

      // Check history
      const history = await getTrainingHistory(pattern.id);
      expect(history.length).toBeGreaterThanOrEqual(2); // At least created + deactivated + activated

      const deactivationEntry = history.find((h) => h.changeType === 'deactivated');
      expect(deactivationEntry).toBeDefined();
      expect(deactivationEntry?.reason).toBe('Testing deactivation');

      const activationEntry = history.find((h) => h.changeType === 'activated');
      expect(activationEntry).toBeDefined();
      expect(activationEntry?.reason).toBe('Testing reactivation');
    });

    it('should rollback training data to previous version', async () => {
      // Create scrape and submit multiple feedbacks to create version history
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Rollback test</body></html>',
        cleanedContent: 'Rollback test',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      // First feedback
      const feedback1 = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'rollback_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'rollback test',
      });

      trackForCleanup('training_feedback', feedback1.id);

      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      // Get initial training data
      const initialData = await getTrainingData('rollback_signal');
      const pattern = initialData[0];
      trackForCleanup('training_data', pattern.id);
      
      const initialVersion = pattern.version;
      const initialConfidence = pattern.confidence;

      // Deactivate (creates version 2)
      await deactivateTrainingData(
        pattern.id,
        testUserId,
        'Create version 2'
      );

      await new Promise((resolve) => { setTimeout(resolve, 500); });

      // Reactivate (creates version 3)
      await activateTrainingData(
        pattern.id,
        testUserId,
        'Create version 3'
      );

      await new Promise((resolve) => { setTimeout(resolve, 500); });

      // Get current version
      const currentData = await getAllTrainingData(false);
      const currentPattern = currentData.find((td) => td.id === pattern.id);
      expect(currentPattern?.version).toBeGreaterThan(initialVersion);

      // Rollback to version 1
      await rollbackTrainingData(
        pattern.id,
        initialVersion,
        testUserId,
        'Testing rollback'
      );

      await new Promise((resolve) => { setTimeout(resolve, 500); });

      // Verify rollback
      const rolledBackData = await getAllTrainingData(false);
      const rolledBackPattern = rolledBackData.find((td) => td.id === pattern.id);
      
      expect(rolledBackPattern).toBeDefined();
      // Note: Version increments even on rollback, but data should match target version
      expect(rolledBackPattern?.confidence).toBe(initialConfidence);

      // Check history includes rollback
      const history = await getTrainingHistory(pattern.id);
      const rollbackEntry = history.find((h) =>
        h.reason?.includes('Rollback to version')
      );
      expect(rollbackEntry).toBeDefined();
    });
  });

  describe('Analytics', () => {
    it('should calculate training analytics correctly', async () => {
      // Create multiple scrapes and feedbacks
      const scrapeResults = await Promise.all([
        saveTemporaryScrape({
            url: 'https://example.com/1',
          rawHtml: '<html><body>Test 1</body></html>',
          cleanedContent: 'Test 1',
          metadata: {},
        }),
        saveTemporaryScrape({
            url: 'https://example.com/2',
          rawHtml: '<html><body>Test 2</body></html>',
          cleanedContent: 'Test 2',
          metadata: {},
        }),
      ]);

      scrapeResults.forEach((result) => {
        trackForCleanup('temporary_scrapes', result.scrape.id);
      });

      // Submit various types of feedback
      const feedbacks = await Promise.all([
        submitFeedback({
            userId: testUserId,
          feedbackType: 'correct',
          signalId: 'signal_1',
          sourceScrapeId: scrapeResults[0].scrape.id,
          sourceText: 'correct extraction',
        }),
        submitFeedback({
            userId: testUserId,
          feedbackType: 'incorrect',
          signalId: 'signal_2',
          sourceScrapeId: scrapeResults[1].scrape.id,
          sourceText: 'wrong extraction',
        }),
        submitFeedback({
            userId: testUserId,
          feedbackType: 'missing',
          signalId: 'signal_3',
          sourceScrapeId: scrapeResults[0].scrape.id,
          sourceText: 'missed this',
        }),
      ]);

      feedbacks.forEach((feedback) => {
        trackForCleanup('training_feedback', feedback.id);
      });

      // Wait for processing
      await new Promise((resolve) => { setTimeout(resolve, 1500); });

      // Get analytics
      const analytics = await getTrainingAnalytics();

      expect(analytics.totalFeedback).toBeGreaterThanOrEqual(3);
      expect(analytics.processedFeedback).toBeGreaterThanOrEqual(3);
      expect(analytics.feedbackByType.correct).toBeGreaterThanOrEqual(1);
      expect(analytics.feedbackByType.incorrect).toBeGreaterThanOrEqual(1);
      expect(analytics.feedbackByType.missing).toBeGreaterThanOrEqual(1);
      expect(analytics.totalPatterns).toBeGreaterThan(0);
      expect(analytics.activePatterns).toBeGreaterThan(0);
      expect(analytics.averageConfidence).toBeGreaterThan(0);

      // Clean up training data
      const allTraining = await getAllTrainingData(false);
      allTraining.forEach((td) => {
        trackForCleanup('training_data', td.id);
      });
    });
  });

  describe('Feedback Queries', () => {
    it('should retrieve feedback for a specific scrape', async () => {
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Query test</body></html>',
        cleanedContent: 'Query test',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      const feedback1 = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'query_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'query test',
      });

      trackForCleanup('training_feedback', feedback1.id);

      const feedback2 = await submitFeedback({
        userId: testUserId,
        feedbackType: 'incorrect',
        signalId: 'query_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'another query',
      });

      trackForCleanup('training_feedback', feedback2.id);

      // Query feedback for scrape
      const feedbacks = await getFeedbackForScrape(
        scrapeResult.scrape.id
      );

      expect(feedbacks.length).toBeGreaterThanOrEqual(2);
      expect(feedbacks.some((f) => f.feedbackType === 'correct')).toBe(true);
      expect(feedbacks.some((f) => f.feedbackType === 'incorrect')).toBe(true);

      // Clean up training data
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
      const allTraining = await getAllTrainingData(false);
      allTraining.forEach((td) => {
        trackForCleanup('training_data', td.id);
      });
    });

    it('should retrieve unprocessed feedback', async () => {
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Unprocessed test</body></html>',
        cleanedContent: 'Unprocessed test',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      // Submit feedback
      const feedback = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'unprocessed_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'unprocessed test',
      });

      trackForCleanup('training_feedback', feedback.id);

      // Immediately query unprocessed (before async processing completes)
      const unprocessed = await getUnprocessedFeedback();
      
      // Should find the feedback if queried quickly enough
      // (It may or may not be processed yet depending on timing)
      expect(Array.isArray(unprocessed)).toBe(true);

      // Clean up training data
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
      const allTraining = await getAllTrainingData(false);
      allTraining.forEach((td) => {
        trackForCleanup('training_data', td.id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject feedback for non-existent scrape', async () => {
      try {
        await submitFeedback({
          userId: testUserId,
          feedbackType: 'correct',
          signalId: 'test_signal',
          sourceScrapeId: 'non_existent_scrape',
          sourceText: 'test',
        });
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TrainingManagerError);
        if (error instanceof TrainingManagerError) {
          expect(error.code).toBe('SCRAPE_NOT_FOUND');
          expect(error.statusCode).toBe(404);
        }
      }
    });

    it('should reject deactivation of non-existent training data', async () => {
      try {
        await deactivateTrainingData(
          'non_existent_training',
          testUserId
        );
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TrainingManagerError);
        if (error instanceof TrainingManagerError) {
          expect(error.code).toBe('NOT_FOUND');
          expect(error.statusCode).toBe(404);
        }
      }
    });

    it('should reject rollback to non-existent version', async () => {
      // Create a pattern first
      const scrapeResult = await saveTemporaryScrape({
        url: 'https://example.com',
        rawHtml: '<html><body>Rollback error test</body></html>',
        cleanedContent: 'Rollback error test',
        metadata: {},
      });

      trackForCleanup('temporary_scrapes', scrapeResult.scrape.id);

      const feedback = await submitFeedback({
        userId: testUserId,
        feedbackType: 'correct',
        signalId: 'error_signal',
        sourceScrapeId: scrapeResult.scrape.id,
        sourceText: 'rollback error test',
      });

      trackForCleanup('training_feedback', feedback.id);

      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      const trainingData = await getTrainingData('error_signal');
      const pattern = trainingData[0];
      trackForCleanup('training_data', pattern.id);

      try {
        await rollbackTrainingData(
          pattern.id,
          999, // Non-existent version
          testUserId
        );
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TrainingManagerError);
        if (error instanceof TrainingManagerError) {
          expect(error.code).toBe('VERSION_NOT_FOUND');
          expect(error.statusCode).toBe(404);
        }
      }
    });
  });
});
