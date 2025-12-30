/**
 * Workflow State Tracking
 * 
 * Standardized state management for all processing engines.
 * Allows the system to track where each entity is in the processing pipeline.
 * 
 * Pipeline stages:
 * 1. discovery → Company/person data scraped and cached
 * 2. scoring → Lead quality score calculated
 * 3. sequencing → Enrolled in outbound sequences
 * 4. engagement → Active conversation/nurturing
 */

/**
 * Processing stage in the automation pipeline
 */
export type WorkflowStage = 
  | 'discovery'      // Initial data collection
  | 'scoring'        // Lead quality assessment
  | 'sequencing'     // Outbound campaign enrollment
  | 'engagement'     // Active conversation
  | 'converted'      // Deal closed
  | 'disqualified';  // Removed from pipeline

/**
 * Current status of processing at this stage
 */
export type WorkflowStatus =
  | 'idle'           // Ready to process
  | 'processing'     // Currently being processed
  | 'completed'      // Stage complete, ready for next
  | 'failed'         // Processing failed
  | 'paused'         // Manually paused
  | 'blocked';       // Blocked by dependency

/**
 * Workflow state object
 * Add this to any entity that goes through the automation pipeline
 */
export interface WorkflowState {
  /** Current stage in the pipeline */
  stage: WorkflowStage;
  
  /** Status at current stage */
  status: WorkflowStatus;
  
  /** Last engine that processed this entity */
  lastEngine: string;
  
  /** When this was last updated */
  updatedAt: Date;
  
  /** Error details if status === 'failed' */
  error?: {
    code: string;
    message: string;
    stack?: string;
    occurredAt: Date;
  };
  
  /** Number of retry attempts at current stage */
  retryCount: number;
  
  /** Optional: Next scheduled processing time */
  nextProcessAt?: Date;
  
  /** Optional: Processing history breadcrumbs */
  history?: WorkflowHistoryEntry[];
}

/**
 * History entry for audit trail
 */
export interface WorkflowHistoryEntry {
  stage: WorkflowStage;
  status: WorkflowStatus;
  engine: string;
  timestamp: Date;
  durationMs?: number;
  error?: string;
}

/**
 * Helper to create initial workflow state
 */
export function createWorkflowState(
  stage: WorkflowStage = 'discovery',
  status: WorkflowStatus = 'idle'
): WorkflowState {
  return {
    stage,
    status,
    lastEngine: 'system',
    updatedAt: new Date(),
    retryCount: 0,
    history: [],
  };
}

/**
 * Helper to update workflow state
 */
export function updateWorkflowState(
  current: WorkflowState,
  updates: {
    stage?: WorkflowStage;
    status?: WorkflowStatus;
    engine?: string;
    error?: WorkflowState['error'];
  }
): WorkflowState {
  const now = new Date();
  
  // Add current state to history
  const historyEntry: WorkflowHistoryEntry = {
    stage: current.stage,
    status: current.status,
    engine: current.lastEngine,
    timestamp: current.updatedAt,
    error: current.error?.message,
  };
  
  return {
    stage: updates.stage ?? current.stage,
    status: updates.status ?? current.status,
    lastEngine: updates.engine ?? current.lastEngine,
    updatedAt: now,
    error: updates.error,
    retryCount: updates.status === 'failed' ? current.retryCount + 1 : current.retryCount,
    nextProcessAt: current.nextProcessAt,
    history: [...(current.history || []), historyEntry].slice(-10), // Keep last 10 entries
  };
}

/**
 * Check if entity is ready for processing
 */
export function isReadyForProcessing(workflow: WorkflowState): boolean {
  return workflow.status === 'idle' || workflow.status === 'failed';
}

/**
 * Check if entity is stuck (failed too many times)
 */
export function isStuck(workflow: WorkflowState, maxRetries: number = 3): boolean {
  return workflow.status === 'failed' && workflow.retryCount >= maxRetries;
}
