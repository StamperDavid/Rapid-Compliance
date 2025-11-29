/**
 * Ensemble Service Tests
 * Test multi-model querying, scoring, and selection
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('Ensemble Service', () => {
  describe('Response Scoring', () => {
    it('should calculate coherence score correctly', () => {
      const { calculateCoherence } = require('@/lib/ai/ensemble-service');
      
      const goodResponse = 'This is a well-structured response. It has multiple sentences. The formatting is clear.';
      const poorResponse = 'bad response no structure';
      
      expect(calculateCoherence(goodResponse)).toBeGreaterThan(calculateCoherence(poorResponse));
    });
    
    it('should calculate relevance score based on question keywords', () => {
      const { calculateRelevance } = require('@/lib/ai/ensemble-service');
      
      const question = 'What is the best payment processor for e-commerce?';
      const relevantResponse = 'The best payment processor for e-commerce is Stripe because...';
      const irrelevantResponse = 'I like pizza and ice cream.';
      
      expect(calculateRelevance(relevantResponse, question)).toBeGreaterThan(
        calculateRelevance(irrelevantResponse, question)
      );
    });
    
    it('should calculate specificity score', () => {
      const { calculateSpecificity } = require('@/lib/ai/ensemble-service');
      
      const specificResponse = 'The cost is $299 per month. For example, companies like Shopify use this approach.';
      const vagueResponse = 'It might cost some money. Perhaps it could work for some companies.';
      
      expect(calculateSpecificity(specificResponse)).toBeGreaterThan(
        calculateSpecificity(vagueResponse)
      );
    });
    
    it('should calculate confidence score', () => {
      const { calculateConfidence } = require('@/lib/ai/ensemble-service');
      
      const confidentResponse = 'This is definitely the correct answer. Specifically, the solution is X.';
      const uncertainResponse = 'I think maybe it could be X, but I\'m not sure. Perhaps it might work.';
      
      expect(calculateConfidence(confidentResponse)).toBeGreaterThan(
        calculateConfidence(uncertainResponse)
      );
    });
  });
  
  describe('Model Selection', () => {
    it('should select smart models based on conversation context', () => {
      const { selectSmartModels } = require('@/lib/ai/ensemble-service');
      
      const shortConversation = [
        { role: 'user', content: 'Hello' }
      ];
      
      const longConversation = Array(10).fill({ role: 'user', content: 'Test message' });
      
      const shortModels = selectSmartModels(shortConversation);
      const longModels = selectSmartModels(longConversation);
      
      expect(shortModels).toContain('gemini-2.0-flash-exp');
      expect(longModels.length).toBeGreaterThanOrEqual(shortModels.length);
    });
    
    it('should include Claude for creative requests', () => {
      const { selectSmartModels } = require('@/lib/ai/ensemble-service');
      
      const creativeRequest = [
        { role: 'user', content: 'Write a creative story about a dragon' }
      ];
      
      const models = selectSmartModels(creativeRequest);
      
      expect(models.some((m: string) => m.startsWith('claude-'))).toBe(true);
    });
  });
  
  describe('Best Response Selection', () => {
    it('should select response with highest score', () => {
      const { selectBestResponse } = require('@/lib/ai/ensemble-service');
      
      const responses = [
        { model: 'gpt-4', response: 'Response 1', score: 85, metrics: {}, usage: {}, responseTime: 1000 },
        { model: 'claude', response: 'Response 2', score: 92, metrics: {}, usage: {}, responseTime: 1000 },
        { model: 'gemini', response: 'Response 3', score: 78, metrics: {}, usage: {}, responseTime: 500 },
      ];
      
      const best = selectBestResponse(responses);
      
      expect(best.model).toBe('claude');
      expect(best.score).toBe(92);
    });
  });
  
  describe('Fallback Chains', () => {
    it('should have fallback chain for all major models', () => {
      const { FALLBACK_CHAINS } = require('@/lib/ai/model-fallback-service');
      
      expect(FALLBACK_CHAINS['gpt-4']).toBeDefined();
      expect(FALLBACK_CHAINS['claude-3.5-sonnet']).toBeDefined();
      expect(FALLBACK_CHAINS['gemini-2.0-flash-exp']).toBeDefined();
      
      expect(FALLBACK_CHAINS['gpt-4'].length).toBeGreaterThan(0);
    });
    
    it('should always include Gemini as final fallback', () => {
      const { FALLBACK_CHAINS } = require('@/lib/ai/model-fallback-service');
      
      Object.values(FALLBACK_CHAINS).forEach((chain: any) => {
        const lastModel = chain[chain.length - 1];
        expect(lastModel).toMatch(/gemini/i);
      });
    });
  });
});

