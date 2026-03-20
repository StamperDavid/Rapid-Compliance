/**
 * Scene Grading Service
 *
 * Compares AI-generated video audio transcription against the original script
 * to produce a quality grade. Uses word-level LCS (Longest Common Subsequence)
 * for accurate script adherence measurement.
 */

import type { TranscriptionResult, SceneAutoGrade, PacingScore } from '@/types/scene-grading';

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // Strip punctuation
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}

/**
 * Tokenize normalized text into word arrays.
 */
function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

// ============================================================================
// Longest Common Subsequence (Word-Level)
// ============================================================================

/**
 * Compute the Longest Common Subsequence of two word arrays.
 * Returns the LCS words in order.
 *
 * Uses dynamic programming with O(m*n) time and space.
 * Word-level (not character-level) for meaningful script comparison.
 */
function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS words
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// ============================================================================
// Grading Engine
// ============================================================================

/**
 * Grade a scene by comparing the transcription against the original script.
 *
 * Algorithm:
 * 1. Normalize and tokenize both texts
 * 2. Compute word-level LCS
 * 3. scriptAccuracy = (LCS length / original word count) * 100
 * 4. wordsDropped = original words not in LCS
 * 5. wordsAdded = transcription words not in LCS
 * 6. actualWpm = transcription word count / (duration / 60)
 * 7. targetWpm = original word count / (duration / 60)
 * 8. Pacing: good (within 30% of target), too_fast (>130%), too_slow (<70%)
 * 9. overallScore = weighted: 60% accuracy + 20% pacing + 20% confidence
 *
 * B-roll handling: If originalScript is empty, returns a neutral "no_speech" grade.
 */
export function gradeScene(
  originalScript: string,
  transcription: TranscriptionResult,
  videoDurationSeconds: number,
): SceneAutoGrade {
  const originalWords = tokenize(originalScript);
  const transcriptionWords = tokenize(transcription.transcript);

  // B-roll / no-speech scene — nothing to grade
  if (originalWords.length === 0) {
    return {
      scriptAccuracy: 100,
      actualWpm: transcriptionWords.length / (videoDurationSeconds / 60) || 0,
      targetWpm: 0,
      pacingScore: 'good',
      wordsDropped: [],
      wordsAdded: transcriptionWords,
      transcription,
      gradedAt: new Date().toISOString(),
      overallScore: 100,
    };
  }

  // Compute LCS
  const lcs = longestCommonSubsequence(originalWords, transcriptionWords);

  // Script accuracy
  const scriptAccuracy = Math.round((lcs.length / originalWords.length) * 100);

  // Words dropped (in original but not in LCS)
  // We need to track which specific words were dropped, not just set membership
  const lcsWordCounts = new Map<string, number>();
  for (const word of lcs) {
    lcsWordCounts.set(word, (lcsWordCounts.get(word) ?? 0) + 1);
  }

  const originalWordCounts = new Map<string, number>();
  for (const word of originalWords) {
    originalWordCounts.set(word, (originalWordCounts.get(word) ?? 0) + 1);
  }

  const transcriptionWordCounts = new Map<string, number>();
  for (const word of transcriptionWords) {
    transcriptionWordCounts.set(word, (transcriptionWordCounts.get(word) ?? 0) + 1);
  }

  const wordsDropped: string[] = [];
  for (const [word, count] of originalWordCounts) {
    const lcsCount = lcsWordCounts.get(word) ?? 0;
    const droppedCount = count - lcsCount;
    for (let k = 0; k < droppedCount; k++) {
      wordsDropped.push(word);
    }
  }

  const wordsAdded: string[] = [];
  for (const [word, count] of transcriptionWordCounts) {
    const lcsCount = lcsWordCounts.get(word) ?? 0;
    const addedCount = count - lcsCount;
    for (let k = 0; k < addedCount; k++) {
      wordsAdded.push(word);
    }
  }

  // WPM calculations
  const durationMinutes = videoDurationSeconds / 60;
  const actualWpm = durationMinutes > 0
    ? Math.round(transcriptionWords.length / durationMinutes)
    : 0;
  const targetWpm = durationMinutes > 0
    ? Math.round(originalWords.length / durationMinutes)
    : 0;

  // Pacing score
  let pacingScore: PacingScore = 'good';
  if (targetWpm > 0) {
    const ratio = actualWpm / targetWpm;
    if (ratio > 1.3) {
      pacingScore = 'too_fast';
    } else if (ratio < 0.7) {
      pacingScore = 'too_slow';
    }
  }

  // Pacing component score (0-100)
  let pacingComponentScore = 100;
  if (targetWpm > 0) {
    const ratio = actualWpm / targetWpm;
    const deviation = Math.abs(1 - ratio);
    // Linear decay: 0% deviation = 100, 50%+ deviation = 0
    pacingComponentScore = Math.max(0, Math.round(100 - deviation * 200));
  }

  // Overall score: 60% accuracy + 20% pacing + 20% confidence
  const confidenceScore = Math.round(transcription.confidence * 100);
  const overallScore = Math.round(
    scriptAccuracy * 0.6 +
    pacingComponentScore * 0.2 +
    confidenceScore * 0.2
  );

  return {
    scriptAccuracy,
    actualWpm,
    targetWpm,
    pacingScore,
    wordsDropped,
    wordsAdded,
    transcription,
    gradedAt: new Date().toISOString(),
    overallScore: Math.min(100, Math.max(0, overallScore)),
  };
}
