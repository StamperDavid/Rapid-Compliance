/**
 * Onboarding Constants
 * 
 * Client-safe constants (no server-only dependencies).
 * Safe to import in both client and server components.
 */

/**
 * Confidence thresholds for prefill behavior
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Auto-fill without confirmation (>90% confidence) */
  HIGH: 0.9,
  /** Show suggestion, ask for confirmation (70-90% confidence) */
  MEDIUM: 0.7,
  /** Show as hint only, user must enter (<70% confidence) */
  LOW: 0.0,
} as const;
