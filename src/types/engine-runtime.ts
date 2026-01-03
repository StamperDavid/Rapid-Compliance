/**
 * Engine Runtime Types
 * 
 * Standardized interfaces for all worker engines to report their execution results,
 * resource usage, and costs. This enables:
 * 
 * 1. Cost tracking per lead/operation
 * 2. Performance monitoring
 * 3. Token usage auditing
 * 4. Consistent error handling
 * 5. Manager agent decision-making based on economic constraints
 */

/**
 * Standardized result wrapper for all engine operations
 * 
 * @template T - The specific data type returned by the engine
 * 
 * @example
 * ```typescript
 * const result: EngineResult<DiscoveredCompany> = await discoveryEngine.run();
 * 
 * if (result.success) {
 *   console.log(`Discovery cost: $${result.usage.cost}`);
 *   console.log(`Tokens used: ${result.usage.tokens}`);
 *   const company = result.data;
 * } else {
 *   console.error(`Failed: ${result.error.message}`);
 * }
 * ```
 */
export interface EngineResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** The actual data payload (only present if success = true) */
  data?: T;
  
  /** Error details (only present if success = false) */
  error?: EngineError;
  
  /** Resource usage and cost metrics */
  usage: EngineUsage;
  
  /** Additional metadata about the execution */
  metadata?: EngineMetadata;
}

/**
 * Error details for failed operations
 */
export interface EngineError {
  /** Error code for programmatic handling */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Stack trace (for debugging) */
  stack?: string;
  
  /** Whether this error is retryable */
  retryable: boolean;
  
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Resource usage tracking
 */
export interface EngineUsage {
  /** Total LLM tokens consumed (input + output) */
  tokens: number;
  
  /** Input tokens only */
  tokensIn?: number;
  
  /** Output tokens only */
  tokensOut?: number;
  
  /** Total cost in USD */
  cost: number;
  
  /** Cost breakdown by resource type */
  costBreakdown?: {
    llm?: number;        // LLM API costs
    proxy?: number;      // Proxy/scraping costs
    storage?: number;    // Database writes
    other?: number;      // Misc costs
  };
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** External API calls made */
  apiCalls?: number;
  
  /** Cache hits (if applicable) */
  cacheHit?: boolean;
}

/**
 * Additional execution metadata
 */
export interface EngineMetadata {
  /** Engine identifier */
  engine: string;
  
  /** Engine version */
  version?: string;
  
  /** Start timestamp */
  startedAt: Date;
  
  /** Completion timestamp */
  completedAt: Date;
  
  /** Model used (if AI operation) */
  model?: string;
  
  /** Organization/tenant ID */
  organizationId?: string;
  
  /** User who initiated the operation */
  userId?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Helper to create a successful result
 */
export function createSuccessResult<T>(
  data: T,
  usage: EngineUsage,
  metadata?: EngineMetadata
): EngineResult<T> {
  return {
    success: true,
    data,
    usage,
    metadata,
  };
}

/**
 * Helper to create a failed result
 */
export function createFailureResult<T>(
  error: EngineError,
  usage: Partial<EngineUsage>,
  metadata?: EngineMetadata
): EngineResult<T> {
  return {
    success: false,
    error,
    usage: {
      tokens: usage.tokens ?? 0,
      cost: usage.cost ?? 0,
      durationMs: usage.durationMs ?? 0,
      ...usage,
    },
    metadata,
  };
}

/**
 * Calculate LLM cost based on token usage and model
 */
export function calculateLLMCost(
  tokensIn: number,
  tokensOut: number,
  model: string
): number {
  // Pricing per 1K tokens (as of Dec 2025)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': {
      input: 0.00015,
      output: 0.0006,
    },
    'gpt-4-turbo': {
      input: 0.01,
      output: 0.03,
    },
    'gpt-4': {
      input: 0.03,
      output: 0.06,
    },
    'claude-3.5-sonnet': {
      input: 0.003,
      output: 0.015,
    },
    'claude-3-haiku': {
      input: 0.00025,
      output: 0.00125,
    },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // Default to cheapest
  
  const inputCost = (tokensIn / 1000) * modelPricing.input;
  const outputCost = (tokensOut / 1000) * modelPricing.output;
  
  return inputCost + outputCost;
}

/**
 * Estimate proxy/scraping cost
 */
export function calculateScrapingCost(
  bytesFetched: number,
  proxyType: 'residential' | 'datacenter' = 'datacenter'
): number {
  // Average proxy pricing per GB
  const costPerGB = proxyType === 'residential' ? 10 : 2;
  const costPerByte = costPerGB / (1024 * 1024 * 1024);
  
  return bytesFetched * costPerByte;
}

/**
 * Batch result for multiple operations
 */
export interface BatchEngineResult<T> {
  /** Overall success (true if at least one succeeded) */
  success: boolean;
  
  /** Individual results */
  results: EngineResult<T>[];
  
  /** Aggregate usage statistics */
  totalUsage: EngineUsage;
  
  /** Success/failure counts */
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    successRate: number;
  };
}

/**
 * Helper to create batch result from individual results
 */
export function createBatchResult<T>(
  results: EngineResult<T>[]
): BatchEngineResult<T> {
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  const totalUsage: EngineUsage = {
    tokens: results.reduce((sum, r) => sum + r.usage.tokens, 0),
    cost: results.reduce((sum, r) => sum + r.usage.cost, 0),
    durationMs: Math.max(...results.map(r => r.usage.durationMs)),
    apiCalls: results.reduce((sum, r) => sum + (r.usage.apiCalls ?? 0), 0),
  };
  
  return {
    success: succeeded > 0,
    results,
    totalUsage,
    stats: {
      total: results.length,
      succeeded,
      failed,
      successRate: results.length > 0 ? succeeded / results.length : 0,
    },
  };
}
