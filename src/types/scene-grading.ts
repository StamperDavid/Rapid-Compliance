/**
 * Scene Grading & Review Types
 * Auto-grading via transcription, human review, and training center integration.
 */

// Per-word transcription result from Deepgram
export interface TranscriptionWord {
  word: string;
  start: number;    // seconds
  end: number;      // seconds
  confidence: number; // 0-1
}

export interface TranscriptionResult {
  transcript: string;
  words: TranscriptionWord[];
  durationSeconds: number;
  confidence: number; // average confidence across all words
}

export type PacingScore = 'too_slow' | 'good' | 'too_fast';

export interface SceneAutoGrade {
  scriptAccuracy: number;      // 0-100, how much of the original script was spoken
  actualWpm: number;           // words per minute in the transcription
  targetWpm: number;           // expected words per minute based on original script
  pacingScore: PacingScore;
  wordsDropped: string[];      // words in original script not found in transcription
  wordsAdded: string[];        // words in transcription not found in original script
  transcription: TranscriptionResult;
  gradedAt: string;            // ISO timestamp
  overallScore: number;        // 0-100, weighted composite score
}

export type SceneReviewAction = 'accept' | 'regenerate';

export interface SceneReview {
  sceneId: string;
  projectId: string;
  humanGrade: number;          // 1-5 star rating
  feedback: string;
  autoGrade: SceneAutoGrade | null;
  action: SceneReviewAction;
  trainingSessionId: string | null;
  flagged: boolean;
}
