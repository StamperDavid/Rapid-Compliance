/**
 * Execution Policy Types
 *
 * Controls whether Jasper stops at draft/review for tasks or auto-executes.
 * Default: require_approval — Jasper creates drafts and waits for user review.
 */

export type ExecutionMode = 'require_approval' | 'fully_automate';

export interface ExecutionPolicy {
  mode: ExecutionMode;
  updatedBy: string;
  updatedAt: Date;
}

export const DEFAULT_EXECUTION_MODE: ExecutionMode = 'require_approval';
