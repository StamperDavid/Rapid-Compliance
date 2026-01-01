/**
 * Onboarding Module
 * 
 * Exception-Based Validation for magical first-time user experience.
 * 
 * NOTE: This module exports server-only functions. 
 * For client components, import from './types' or './constants' directly.
 */

// Server-only exports (use in API routes and server components only)
export {
  prefillOnboardingData,
  emitOnboardingCompletedSignal,
  emitOnboardingAbandonedSignal,
  getSuggestedAction,
} from './prefill-engine';

// Client-safe exports (safe to use in client components)
export type {
  OnboardingFormData,
  FieldConfidence,
  PrefillResult,
  PrefillUIState,
  ConfidenceBadgeProps,
} from './types';

export { CONFIDENCE_THRESHOLDS } from './constants';
