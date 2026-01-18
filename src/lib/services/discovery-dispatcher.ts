/**
 * Discovery Dispatcher
 * 
 * Queue manager for the Discovery Engine. This is the "gearbox" that:
 * 1. Finds companies/people that need discovery
 * 2. Locks them (sets status = 'processing')
 * 3. Executes the Discovery Engine
 * 4. Updates workflow state based on result
 * 
 * This enables automated batch processing without manual triggers.
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import { discoverCompany, discoverPerson, type DiscoveredCompany, type DiscoveredPerson } from './discovery-engine';
import {
  createSuccessResult,
  createFailureResult,
  createBatchResult,
  calculateLLMCost,
  calculateScrapingCost,
  type EngineResult,
  type BatchEngineResult
} from '@/types/engine-runtime';
import { updateWorkflowState, isStuck, type WorkflowState } from '@/types/workflow-state';
import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Discovery task - represents a domain or email that needs discovery
 */
export interface DiscoveryTask {
  id: string;
  type: 'company' | 'person';
  target: string; // domain for company, email for person
  organizationId: string;
  workspaceId: string;
  workflow: WorkflowState;
  priority?: number; // Optional: higher = process first
  createdAt: Date;
}

/**
 * Dispatcher configuration
 */
export interface DispatcherConfig {
  /** Maximum tasks to process in one batch */
  batchSize: number;
  
  /** Maximum concurrent executions */
  concurrency: number;
  
  /** Maximum retries for failed tasks */
  maxRetries: number;
  
  /** Delay between batches (ms) */
  delayMs: number;
  
  /** Organization ID filter (optional) */
  organizationId?: string;
}

const DEFAULT_CONFIG: DispatcherConfig = {
  batchSize: 10,
  concurrency: 3,
  maxRetries: 3,
  delayMs: 2000,
};

// ============================================================================
// MAIN DISPATCHER FUNCTIONS
// ============================================================================

/**
 * Process discovery queue
 * 
 * Finds all tasks with workflow.stage='discovery' and workflow.status='idle',
 * executes them, and updates their state.
 * 
 * @param config - Dispatcher configuration
 * @returns Batch result with all processed tasks
 * 
 * @example
 * ```typescript
 * // Process up to 10 discoveries
 * const result = await processDiscoveryQueue({ batchSize: 10 });
 * 
 * console.log(`Processed ${result.stats.total} tasks`);
 * console.log(`Success: ${result.stats.succeeded}, Failed: ${result.stats.failed}`);
 * console.log(`Total cost: $${result.totalUsage.cost}`);
 * ```
 */
export async function processDiscoveryQueue(
  config: Partial<DispatcherConfig> = {}
): Promise<BatchEngineResult<DiscoveredCompany | DiscoveredPerson>> {
  const conf = { ...DEFAULT_CONFIG, ...config };
  
  logger.info('[DiscoveryDispatcher] Starting queue processing', {
    batchSize: conf.batchSize,
    concurrency: conf.concurrency,
  });

  try {
    // Step 1: Find idle tasks
    const tasks = await findIdleTasks(conf.batchSize, conf.organizationId);
    
    if (tasks.length === 0) {
      logger.info('[DiscoveryDispatcher] No tasks in queue');
      return createBatchResult([]);
    }

    logger.info('[DiscoveryDispatcher] Found idle tasks', {
      count: tasks.length,
      companies: tasks.filter(t => t.type === 'company').length,
      people: tasks.filter(t => t.type === 'person').length,
    });

    // Step 2: Lock tasks (set status to 'processing')
    await lockTasks(tasks);

    // Step 3: Process tasks with concurrency control
    const results = await processTasks(tasks, conf);

    // Step 4: Update workflow states based on results
    await updateTaskStates(tasks, results);

    const batchResult = createBatchResult(results);
    
    logger.info('[DiscoveryDispatcher] Queue processing complete', {
      total: batchResult.stats.total,
      succeeded: batchResult.stats.succeeded,
      failed: batchResult.stats.failed,
      totalCost: batchResult.totalUsage.cost,
      totalTokens: batchResult.totalUsage.tokens,
    });

    return batchResult;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DiscoveryDispatcher] Queue processing failed', err);
    throw error;
  }
}

/**
 * Process a single discovery task
 * 
 * @param task - Discovery task to process
 * @returns Engine result with discovered data
 */
export async function processDiscoveryTask(
  task: DiscoveryTask
): Promise<EngineResult<DiscoveredCompany | DiscoveredPerson>> {
  const startTime = Date.now();
  
  logger.info('[DiscoveryDispatcher] Processing task', {
    id: task.id,
    type: task.type,
    target: task.target,
  });

  try {
    let discoveryResult: DiscoveredCompany | DiscoveredPerson;
    let tokensIn = 0;
    let tokensOut = 0;
    let fromCache = false;

    // Execute discovery based on type
    if (task.type === 'company') {
      const companyResult = await discoverCompany(task.target, task.organizationId);
      discoveryResult = companyResult.company;
      fromCache = companyResult.fromCache ?? false;
    } else {
      const personResult = await discoverPerson(task.target, task.organizationId);
      discoveryResult = personResult.person;
      fromCache = personResult.fromCache ?? false;
    }

    const durationMs = Date.now() - startTime;

    // Estimate token usage (approximate based on complexity)
    // In a real implementation, you'd track this from the actual LLM calls
    if (!fromCache) {
      tokensIn = 2000;  // Approximate prompt size
      tokensOut = 500;  // Approximate synthesis output
    }

    const llmCost = calculateLLMCost(tokensIn, tokensOut, 'gpt-4o-mini');
    const scrapingCost = fromCache ? 0 : calculateScrapingCost(500 * 1024); // ~500KB HTML

    const result = createSuccessResult(
      discoveryResult,
      {
        tokens: tokensIn + tokensOut,
        tokensIn,
        tokensOut,
        cost: llmCost + scrapingCost,
        costBreakdown: {
          llm: llmCost,
          proxy: scrapingCost,
        },
        durationMs,
        cacheHit: fromCache,
      },
      {
        engine: 'discovery-engine',
        version: '1.0.0',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        organizationId: task.organizationId,
      }
    );

    logger.info('[DiscoveryDispatcher] Task succeeded', {
      id: task.id,
      durationMs,
      cost: result.usage.cost,
      fromCache,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DiscoveryDispatcher] Task failed', err, {
      id: task.id,
      target: task.target,
    });

    return createFailureResult(
      {
        code: 'DISCOVERY_FAILED',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        retryable: isRetryableError(error),
        retryAfterMs: 60000, // 1 minute
      },
      {
        durationMs,
      },
      {
        engine: 'discovery-engine',
        version: '1.0.0',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        organizationId: task.organizationId,
      }
    );
  }
}

// ============================================================================
// TASK QUEUE MANAGEMENT
// ============================================================================

/**
 * Find tasks that are ready for discovery
 */
async function findIdleTasks(
  limit: number,
  organizationId?: string
): Promise<DiscoveryTask[]> {
  try {
    // Query for entities with workflow.stage='discovery' and workflow.status='idle'
    // In a real implementation, you'd have a dedicated queue collection
    // For now, we'll simulate by checking a hypothetical 'discoveryQueue' collection

    let query = db.collection('discoveryQueue')
      .where('workflow.stage', '==', 'discovery')
      .where('workflow.status', '==', 'idle')
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'asc')
      .limit(limit);

    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    const snapshot = await query.get();

    const tasks: DiscoveryTask[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip stuck tasks (failed too many times)
      if (isStuck(data.workflow as WorkflowState)) {
        const workflowData = data.workflow as WorkflowState;
        logger.warn('[DiscoveryDispatcher] Skipping stuck task', {
          id: doc.id,
          retryCount: workflowData.retryCount,
        });
        continue;
      }

      const workflowData = data.workflow as WorkflowState;
      const updatedAtValue = workflowData.updatedAt as Timestamp | string | number | Date;
      const createdAtValue = data.createdAt as Timestamp | string | number | Date;

      tasks.push({
        id: doc.id,
        type: data.type as 'company' | 'person',
        target: data.target as string,
        organizationId: data.organizationId as string,
        workspaceId: data.workspaceId as string,
        workflow: {
          ...workflowData,
          updatedAt: updatedAtValue instanceof Timestamp
            ? updatedAtValue.toDate()
            : new Date(updatedAtValue),
        },
        priority: data.priority as number | undefined,
        createdAt: createdAtValue instanceof Timestamp
          ? createdAtValue.toDate()
          : new Date(createdAtValue),
      });
    }

    return tasks;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DiscoveryDispatcher] Failed to find idle tasks', err);
    return [];
  }
}

/**
 * Lock tasks by setting their status to 'processing'
 */
async function lockTasks(tasks: DiscoveryTask[]): Promise<void> {
  const batch = db.batch();
  
  for (const task of tasks) {
    const taskRef = db.collection('discoveryQueue').doc(task.id);
    
    const updatedWorkflow = updateWorkflowState(task.workflow, {
      status: 'processing',
      engine: 'discovery-dispatcher',
    });
    
    batch.update(taskRef, {
      'workflow.status': 'processing',
      'workflow.lastEngine': 'discovery-dispatcher',
      'workflow.updatedAt': Timestamp.fromDate(updatedWorkflow.updatedAt),
    });
  }
  
  await batch.commit();
  
  logger.info('[DiscoveryDispatcher] Locked tasks', { count: tasks.length });
}

/**
 * Process tasks with concurrency control
 */
async function processTasks(
  tasks: DiscoveryTask[],
  config: DispatcherConfig
): Promise<EngineResult<DiscoveredCompany | DiscoveredPerson>[]> {
  const results: EngineResult<DiscoveredCompany | DiscoveredPerson>[] = [];
  
  // Process in batches for concurrency control
  for (let i = 0; i < tasks.length; i += config.concurrency) {
    const batch = tasks.slice(i, i + config.concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(task => processDiscoveryTask(task))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Promise rejected - create failure result
        const errorReason = result.reason as Error | undefined;
        const errorMessage = errorReason?.message ?? 'Unknown error';
        results.push(createFailureResult(
          {
            code: 'DISPATCHER_ERROR',
            message: errorMessage,
            retryable: true,
          },
          { durationMs: 0 }
        ));
      }
    }

    // Delay between batches
    if (i + config.concurrency < tasks.length) {
      await new Promise<void>(resolve => { setTimeout(resolve, config.delayMs); });
    }
  }
  
  return results;
}

/**
 * Update task workflow states based on results
 */
async function updateTaskStates(
  tasks: DiscoveryTask[],
  results: EngineResult<DiscoveredCompany | DiscoveredPerson>[]
): Promise<void> {
  const batch = db.batch();
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = results[i];
    const taskRef = db.collection('discoveryQueue').doc(task.id);

    if (!task || !result) {
      continue;
    }

    if (result.success) {
      // Success: Move to next stage (scoring)
      const updatedWorkflow = updateWorkflowState(task.workflow, {
        status: 'completed',
        stage: 'scoring',
        engine: 'discovery-engine',
      });

      batch.update(taskRef, {
        'workflow.stage': 'scoring',
        'workflow.status': 'idle', // Ready for scoring
        'workflow.lastEngine': 'discovery-engine',
        'workflow.updatedAt': Timestamp.fromDate(updatedWorkflow.updatedAt),
        'workflow.retryCount': 0,
      });
    } else {
      // Failure: Mark as failed
      const error = result.error;
      if (!error) {
        continue;
      }

      const updatedWorkflow = updateWorkflowState(task.workflow, {
        status: 'failed',
        engine: 'discovery-engine',
        error: {
          code: error.code,
          message: error.message,
          stack: error.stack,
          occurredAt: new Date(),
        },
      });

      batch.update(taskRef, {
        'workflow.status': 'failed',
        'workflow.lastEngine': 'discovery-engine',
        'workflow.updatedAt': Timestamp.fromDate(updatedWorkflow.updatedAt),
        'workflow.retryCount': updatedWorkflow.retryCount,
        'workflow.error': updatedWorkflow.error,
      });
    }
  }
  
  await batch.commit();
  
  logger.info('[DiscoveryDispatcher] Updated task states', { count: tasks.length });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {return true;}
  
  const message = error.message.toLowerCase();
  
  // Non-retryable errors
  if (message.includes('invalid domain')) {return false;}
  if (message.includes('invalid email')) {return false;}
  if (message.includes('blocked')) {return false;}
  if (message.includes('forbidden')) {return false;}
  
  // Retryable errors (network, rate limits, etc.)
  return true;
}

/**
 * Add a new discovery task to the queue
 * 
 * @param type - Type of discovery (company or person)
 * @param target - Domain or email to discover
 * @param organizationId - Organization ID
 * @param workspaceId - Workspace ID
 * @param priority - Optional priority (higher = process first)
 */
export async function queueDiscoveryTask(
  type: 'company' | 'person',
  target: string,
  organizationId: string,
  workspaceId: string,
  priority: number = 0
): Promise<string> {
  try {
    const taskRef = db.collection('discoveryQueue').doc();
    
    const task: Omit<DiscoveryTask, 'id'> = {
      type,
      target,
      organizationId,
      workspaceId,
      workflow: {
        stage: 'discovery',
        status: 'idle',
        lastEngine: 'system',
        updatedAt: new Date(),
        retryCount: 0,
      },
      priority,
      createdAt: new Date(),
    };
    
    await taskRef.set({
      ...task,
      createdAt: Timestamp.fromDate(task.createdAt),
      workflow: {
        ...task.workflow,
        updatedAt: Timestamp.fromDate(task.workflow.updatedAt),
      },
    });
    
    logger.info('[DiscoveryDispatcher] Task queued', {
      id: taskRef.id,
      type,
      target,
    });
    
    return taskRef.id;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DiscoveryDispatcher] Failed to queue task', err, {
      type,
      target,
    });
    throw error;
  }
}
