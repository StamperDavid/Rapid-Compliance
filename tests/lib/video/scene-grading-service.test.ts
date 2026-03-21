/**
 * Scene Grading Service — Unit Tests
 *
 * Tests the pure-algorithm grading engine: LCS computation,
 * script accuracy, pacing scores, word diffs, and overall scoring.
 * No external dependencies — all pure functions.
 */

import { describe, it, expect } from '@jest/globals';
import { gradeScene } from '@/lib/video/scene-grading-service';
import type { TranscriptionResult } from '@/types/scene-grading';

// ============================================================================
// Helpers
// ============================================================================

function makeTranscription(
  transcript: string,
  confidence = 0.95,
  durationSeconds = 30,
): TranscriptionResult {
  const words = transcript
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => ({
      word,
      start: i * 0.5,
      end: (i + 1) * 0.5,
      confidence,
    }));

  return {
    transcript,
    words,
    durationSeconds,
    confidence,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('gradeScene', () => {
  // --------------------------------------------------------------------------
  // Perfect Match
  // --------------------------------------------------------------------------

  describe('perfect script match', () => {
    it('should return 100% accuracy when transcription matches original exactly', () => {
      const script = 'Hello world this is a test';
      const transcription = makeTranscription(script);

      const grade = gradeScene(script, transcription, 30);

      expect(grade.scriptAccuracy).toBe(100);
      expect(grade.wordsDropped).toHaveLength(0);
      expect(grade.wordsAdded).toHaveLength(0);
      expect(grade.overallScore).toBeGreaterThanOrEqual(90);
    });

    it('should ignore punctuation when comparing', () => {
      const script = "Hello, world! This is a test.";
      const transcription = makeTranscription('hello world this is a test');

      const grade = gradeScene(script, transcription, 30);

      expect(grade.scriptAccuracy).toBe(100);
    });

    it('should ignore case when comparing', () => {
      const script = 'HELLO WORLD';
      const transcription = makeTranscription('hello world');

      const grade = gradeScene(script, transcription, 30);

      expect(grade.scriptAccuracy).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // Partial Match
  // --------------------------------------------------------------------------

  describe('partial script match', () => {
    it('should calculate correct accuracy when words are dropped', () => {
      const script = 'The quick brown fox jumps over the lazy dog';
      // Missing "brown" and "lazy" — 7 of 9 original words present
      const transcription = makeTranscription('The quick fox jumps over the dog');

      const grade = gradeScene(script, transcription, 30);

      // LCS = 7 out of 9 = 78% (rounded)
      expect(grade.scriptAccuracy).toBe(78);
      expect(grade.wordsDropped).toContain('brown');
      expect(grade.wordsDropped).toContain('lazy');
      expect(grade.wordsDropped).toHaveLength(2);
    });

    it('should detect added words not in original', () => {
      const script = 'Hello world';
      const transcription = makeTranscription('Hello beautiful world today');

      const grade = gradeScene(script, transcription, 30);

      expect(grade.scriptAccuracy).toBe(100); // Both original words are present
      expect(grade.wordsAdded).toContain('beautiful');
      expect(grade.wordsAdded).toContain('today');
      expect(grade.wordsAdded).toHaveLength(2);
    });

    it('should handle both dropped and added words simultaneously', () => {
      const script = 'I want to go home';
      // Dropped "want", added "need"
      const transcription = makeTranscription('I need to go home');

      const grade = gradeScene(script, transcription, 30);

      // LCS = "i to go home" = 4 of 5 = 80%
      expect(grade.scriptAccuracy).toBe(80);
      expect(grade.wordsDropped).toContain('want');
      expect(grade.wordsAdded).toContain('need');
    });
  });

  // --------------------------------------------------------------------------
  // No Match
  // --------------------------------------------------------------------------

  describe('no match', () => {
    it('should return 0% accuracy when completely different', () => {
      const script = 'Alpha beta gamma';
      const transcription = makeTranscription('Delta epsilon zeta');

      const grade = gradeScene(script, transcription, 30);

      expect(grade.scriptAccuracy).toBe(0);
      expect(grade.wordsDropped).toHaveLength(3);
      expect(grade.wordsAdded).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // B-Roll / No-Speech Scenes
  // --------------------------------------------------------------------------

  describe('B-roll handling', () => {
    it('should return neutral grade (100%) for empty original script', () => {
      const transcription = makeTranscription('some background noise detected');

      const grade = gradeScene('', transcription, 10);

      expect(grade.scriptAccuracy).toBe(100);
      expect(grade.overallScore).toBe(100);
      expect(grade.pacingScore).toBe('good');
      expect(grade.targetWpm).toBe(0);
      expect(grade.wordsDropped).toHaveLength(0);
    });

    it('should return neutral grade for whitespace-only original script', () => {
      const transcription = makeTranscription('');

      const grade = gradeScene('   ', transcription, 10);

      expect(grade.scriptAccuracy).toBe(100);
      expect(grade.overallScore).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // WPM Calculations
  // --------------------------------------------------------------------------

  describe('WPM calculations', () => {
    it('should calculate actual and target WPM correctly', () => {
      // 150 words in 60 seconds = 150 WPM
      const words = Array(150).fill('word').join(' ');
      const script = Array(150).fill('word').join(' ');
      const transcription = makeTranscription(words, 0.95, 60);

      const grade = gradeScene(script, transcription, 60);

      expect(grade.actualWpm).toBe(150);
      expect(grade.targetWpm).toBe(150);
    });

    it('should return 0 WPM when duration is 0', () => {
      const script = 'Hello world';
      const transcription = makeTranscription('Hello world', 0.95, 0);

      const grade = gradeScene(script, transcription, 0);

      expect(grade.actualWpm).toBe(0);
      expect(grade.targetWpm).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Pacing Score
  // --------------------------------------------------------------------------

  describe('pacing score', () => {
    it('should return "good" when actual WPM is within 30% of target', () => {
      // 10 words in 60 seconds for both
      const script = 'one two three four five six seven eight nine ten';
      const transcription = makeTranscription(
        'one two three four five six seven eight nine ten',
        0.95,
        60,
      );

      const grade = gradeScene(script, transcription, 60);

      expect(grade.pacingScore).toBe('good');
    });

    it('should return "too_fast" when actual WPM exceeds 130% of target', () => {
      // Target: 5 words in 60s = 5 WPM
      // Actual: 20 words in 60s = 20 WPM → ratio = 4.0 > 1.3
      const script = 'one two three four five';
      const manyWords = Array(20).fill('word').join(' ');
      const transcription = makeTranscription(manyWords, 0.95, 60);

      const grade = gradeScene(script, transcription, 60);

      expect(grade.pacingScore).toBe('too_fast');
    });

    it('should return "too_slow" when actual WPM is below 70% of target', () => {
      // Target: 20 words in 60s = 20 WPM
      // Actual: 5 words in 60s = 5 WPM → ratio = 0.25 < 0.7
      const script = Array(20).fill('word').join(' ');
      const transcription = makeTranscription('word word word word word', 0.95, 60);

      const grade = gradeScene(script, transcription, 60);

      expect(grade.pacingScore).toBe('too_slow');
    });
  });

  // --------------------------------------------------------------------------
  // Overall Score
  // --------------------------------------------------------------------------

  describe('overall score', () => {
    it('should weight 60% accuracy + 20% pacing + 20% confidence', () => {
      // Perfect match, perfect pacing, 0.90 confidence
      const script = 'Hello world test';
      const transcription = makeTranscription('Hello world test', 0.90, 60);

      const grade = gradeScene(script, transcription, 60);

      // accuracy = 100, pacing component ≈ 100 (perfect match), confidence = 90
      // overall = 100*0.6 + 100*0.2 + 90*0.2 = 60 + 20 + 18 = 98
      expect(grade.overallScore).toBe(98);
    });

    it('should clamp overall score between 0 and 100', () => {
      // All factors at maximum
      const script = 'Hello';
      const transcription = makeTranscription('Hello', 1.0, 60);

      const grade = gradeScene(script, transcription, 60);

      expect(grade.overallScore).toBeLessThanOrEqual(100);
      expect(grade.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should produce low score when accuracy is 0 and confidence is low', () => {
      const script = 'Alpha beta gamma';
      const transcription = makeTranscription('Delta epsilon zeta', 0.1, 60);

      const grade = gradeScene(script, transcription, 60);

      // accuracy = 0, confidence = 10
      // overall should be very low
      expect(grade.overallScore).toBeLessThan(30);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle single-word script', () => {
      const script = 'Hello';
      const transcription = makeTranscription('Hello', 0.99, 5);

      const grade = gradeScene(script, transcription, 5);

      expect(grade.scriptAccuracy).toBe(100);
    });

    it('should handle very long scripts', () => {
      const words = Array(500).fill('test').join(' ');
      const transcription = makeTranscription(words, 0.95, 300);

      const grade = gradeScene(words, transcription, 300);

      expect(grade.scriptAccuracy).toBe(100);
    });

    it('should handle repeated words correctly', () => {
      const script = 'go go go';
      const transcription = makeTranscription('go go', 0.95, 10);

      const grade = gradeScene(script, transcription, 10);

      // LCS has "go go" (2), original has 3 "go"s → 2/3 = 67%
      expect(grade.scriptAccuracy).toBe(67);
      expect(grade.wordsDropped).toContain('go');
      expect(grade.wordsDropped).toHaveLength(1);
    });

    it('should handle empty transcription against non-empty script', () => {
      const script = 'This should have been spoken';
      const transcription = makeTranscription('', 0, 10);

      const grade = gradeScene(script, transcription, 10);

      expect(grade.scriptAccuracy).toBe(0);
      expect(grade.wordsDropped.length).toBe(5);
    });

    it('should include gradedAt as valid ISO timestamp', () => {
      const script = 'test';
      const transcription = makeTranscription('test');

      const grade = gradeScene(script, transcription, 10);

      expect(grade.gradedAt).toBeDefined();
      expect(new Date(grade.gradedAt).toISOString()).toBe(grade.gradedAt);
    });

    it('should include the transcription object in the result', () => {
      const script = 'test';
      const transcription = makeTranscription('test');

      const grade = gradeScene(script, transcription, 10);

      expect(grade.transcription).toBe(transcription);
    });

    it('should handle extra whitespace in original script', () => {
      const script = '  Hello   world  ';
      const transcription = makeTranscription('Hello world');

      const grade = gradeScene(script, transcription, 10);

      expect(grade.scriptAccuracy).toBe(100);
    });
  });
});
