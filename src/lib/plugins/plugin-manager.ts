/**
 * Plugin Manager
 * Production-ready plugin system with JSON-Schema validation, authentication, and tool registration
 *
 * @module PluginManager
 * @status FUNCTIONAL
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============== Type Definitions ==============

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema | { type: string; description?: string; enum?: unknown[]; items?: JSONSchema }>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  additionalProperties?: boolean | JSONSchema;
}

export interface ToolContext {
  workspaceId?: string;
  userId?: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  handler: (input: unknown, context: ToolContext) => Promise<unknown>;
  requiredPermissions?: string[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  tools: ToolDefinition[];
  requiredScopes?: string[];
  dependencies?: string[];
  init?: (context: PluginContext) => Promise<void>;
  cleanup?: () => Promise<void>;
  healthCheck?: () => Promise<boolean>;
}

export interface PluginContext {
  config: Record<string, unknown>;
  logger: typeof logger;
}

export interface PluginState {
  plugin: PluginDefinition;
  enabled: boolean;
  initializedAt?: string;
  error?: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  toolName: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============== Rate Limiter ==============

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  check(key: string, maxCalls: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= maxCalls) {
      return false;
    }

    entry.count++;
    return true;
  }

  reset(key: string): void {
    this.limits.delete(key);
  }
}

// ============== Schema Validator ==============

function validateAgainstSchema(data: unknown, schema: JSONSchema, path: string = ''): ValidationResult {
  const errors: string[] = [];

  if (schema.type === 'null') {
    if (data !== null) {
      errors.push(`${path}: expected null`);
    }
    return { valid: errors.length === 0, errors };
  }

  if (data === null || data === undefined) {
    if (schema.default !== undefined) {
      return { valid: true, errors: [] };
    }
    errors.push(`${path}: value is required`);
    return { valid: false, errors };
  }

  switch (schema.type) {
    case 'object': {
      if (typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${path}: expected object`);
        break;
      }

      const obj = data as Record<string, unknown>;

      // Check required properties
      if (schema.required) {
        for (const reqProp of schema.required) {
          if (!(reqProp in obj)) {
            errors.push(`${path}.${reqProp}: required property missing`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in obj) {
            const propResult = validateAgainstSchema(
              obj[propName],
              propSchema as JSONSchema,
              `${path}.${propName}`
            );
            errors.push(...propResult.errors);
          }
        }
      }

      // Check additional properties
      if (schema.additionalProperties === false && schema.properties) {
        const allowedProps = new Set(Object.keys(schema.properties));
        for (const key of Object.keys(obj)) {
          if (!allowedProps.has(key)) {
            errors.push(`${path}.${key}: unexpected property`);
          }
        }
      }
      break;
    }

    case 'array':
      if (!Array.isArray(data)) {
        errors.push(`${path}: expected array`);
        break;
      }

      if (schema.items) {
        const itemSchema = schema.items;
        data.forEach((item, index) => {
          const itemResult = validateAgainstSchema(item, itemSchema, `${path}[${index}]`);
          errors.push(...itemResult.errors);
        });
      }
      break;

    case 'string':
      if (typeof data !== 'string') {
        errors.push(`${path}: expected string`);
      } else if (schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path}: value must be one of [${schema.enum.join(', ')}]`);
      }
      break;

    case 'number':
      if (typeof data !== 'number') {
        errors.push(`${path}: expected number`);
      }
      break;

    case 'boolean':
      if (typeof data !== 'boolean') {
        errors.push(`${path}: expected boolean`);
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

// ============== Plugin Manager Class ==============

export class PluginManager {
  private plugins: Map<string, PluginState> = new Map();
  private toolIndex: Map<string, { pluginId: string; tool: ToolDefinition }> = new Map();
  private rateLimiter: RateLimiter = new RateLimiter();
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  /**
   * Register a plugin and its tools
   */
  async registerPlugin(plugin: PluginDefinition): Promise<void> {
    // Validate plugin structure
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new Error('Plugin must have id, name, and version');
    }

    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Plugin ${plugin.id} depends on ${depId} which is not registered`);
        }
      }
    }

    // Validate tool schemas
    for (const tool of plugin.tools) {
      this.validateToolDefinition(tool);

      // Check for tool name conflicts
      if (this.toolIndex.has(tool.name)) {
        throw new Error(`Tool name conflict: ${tool.name} is already registered by another plugin`);
      }
    }

    // Initialize plugin
    const state: PluginState = {
      plugin,
      enabled: false,
      healthStatus: 'unknown',
    };

    try {
      if (plugin.init) {
        const { PLATFORM_ID } = await import('@/lib/constants/platform');
        await plugin.init({
          config: this.config,
          logger,
        });
      }

      state.enabled = true;
      state.initializedAt = new Date().toISOString();
      state.healthStatus = 'healthy';

      // Register tools
      for (const tool of plugin.tools) {
        this.toolIndex.set(tool.name, { pluginId: plugin.id, tool });
      }

      logger.info(`Plugin registered: ${plugin.id}`, {
        version: plugin.version,
        tools: plugin.tools.map(t => t.name),
      });
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      state.healthStatus = 'unhealthy';
      logger.error(`Failed to initialize plugin ${plugin.id}:`, error instanceof Error ? error : new Error(String(error)), { file: 'plugin-manager.ts' });
      throw error;
    }

    this.plugins.set(plugin.id, state);
  }

  /**
   * Unregister a plugin and remove its tools
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);
    if (!state) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    // Check if other plugins depend on this one
    for (const [otherId, otherState] of this.plugins.entries()) {
      if (otherState.plugin.dependencies?.includes(pluginId)) {
        throw new Error(`Cannot unregister ${pluginId}: plugin ${otherId} depends on it`);
      }
    }

    // Cleanup
    if (state.plugin.cleanup) {
      try {
        await state.plugin.cleanup();
      } catch (error) {
        logger.warn(`Error during cleanup of plugin ${pluginId}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Remove tools
    for (const tool of state.plugin.tools) {
      this.toolIndex.delete(tool.name);
    }

    this.plugins.delete(pluginId);
    logger.info(`Plugin unregistered: ${pluginId}`);
  }

  /**
   * Get all available tools for a given context
   */
  getAvailableTools(context: ToolContext): ToolDefinition[] {
    const availableTools: ToolDefinition[] = [];

    for (const [_name, entry] of this.toolIndex) {
      const pluginState = this.plugins.get(entry.pluginId);
      if (!pluginState?.enabled) {
        continue;
      }

      // Check plugin-level scopes
      const plugin = pluginState.plugin;
      if (plugin.requiredScopes) {
        const hasAllScopes = plugin.requiredScopes.every(scope =>
          context.permissions.includes(scope) || context.permissions.includes('*')
        );
        if (!hasAllScopes) {
          continue;
        }
      }

      // Check tool-level permissions
      if (entry.tool.requiredPermissions) {
        const hasAllPerms = entry.tool.requiredPermissions.every(perm =>
          context.permissions.includes(perm) || context.permissions.includes('*')
        );
        if (!hasAllPerms) {
          continue;
        }
      }

      availableTools.push(entry.tool);
    }

    return availableTools;
  }

  /**
   * Execute a tool with input validation and error handling
   */
  async executeTool(
    toolName: string,
    input: unknown,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const entry = this.toolIndex.get(toolName);
    if (!entry) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
        executionTimeMs: Date.now() - startTime,
        toolName,
      };
    }

    const pluginState = this.plugins.get(entry.pluginId);
    if (!pluginState?.enabled) {
      return {
        success: false,
        error: `Plugin ${entry.pluginId} is not enabled`,
        executionTimeMs: Date.now() - startTime,
        toolName,
      };
    }

    const tool = entry.tool;

    // Check permissions
    if (tool.requiredPermissions) {
      const hasPermission = tool.requiredPermissions.every(perm =>
        context.permissions.includes(perm) || context.permissions.includes('*')
      );
      if (!hasPermission) {
        return {
          success: false,
          error: `Insufficient permissions for tool ${toolName}`,
          executionTimeMs: Date.now() - startTime,
          toolName,
        };
      }
    }

    // Check rate limit
    if (tool.rateLimit) {
      const rateLimitKey = `${PLATFORM_ID}:${toolName}`;
      const allowed = this.rateLimiter.check(rateLimitKey, tool.rateLimit.maxCalls, tool.rateLimit.windowMs);
      if (!allowed) {
        return {
          success: false,
          error: `Rate limit exceeded for tool ${toolName}`,
          executionTimeMs: Date.now() - startTime,
          toolName,
        };
      }
    }

    // Validate input
    const inputValidation = validateAgainstSchema(input, tool.inputSchema, 'input');
    if (!inputValidation.valid) {
      return {
        success: false,
        error: `Input validation failed: ${inputValidation.errors.join('; ')}`,
        executionTimeMs: Date.now() - startTime,
        toolName,
      };
    }

    // Execute tool
    try {
      const result = await tool.handler(input, context);

      // Validate output
      const outputValidation = validateAgainstSchema(result, tool.outputSchema, 'output');
      if (!outputValidation.valid) {
        logger.warn(`Tool ${toolName} output validation failed`, { errors: outputValidation.errors });
      }

      return {
        success: true,
        data: result,
        executionTimeMs: Date.now() - startTime,
        toolName,
      };
    } catch (error) {
      logger.error(`Tool ${toolName} execution failed:`, error instanceof Error ? error : new Error(String(error)), { file: 'plugin-manager.ts' });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
        toolName,
      };
    }
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginId: string): PluginState | null {
    return this.plugins.get(pluginId) ?? null;
  }

  /**
   * List all registered plugins
   */
  listPlugins(): Array<{ id: string; name: string; version: string; enabled: boolean; toolCount: number }> {
    return Array.from(this.plugins.values()).map(state => ({
      id: state.plugin.id,
      name: state.plugin.name,
      version: state.plugin.version,
      enabled: state.enabled,
      toolCount: state.plugin.tools.length,
    }));
  }

  /**
   * Enable/disable a plugin
   */
  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const state = this.plugins.get(pluginId);
    if (!state) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (enabled && !state.enabled) {
      // Re-initialize
      if (state.plugin.init) {
        const { PLATFORM_ID } = await import('@/lib/constants/platform');
        await state.plugin.init({
          config: this.config,
          logger,
        });
      }
    } else if (!enabled && state.enabled) {
      // Cleanup
      if (state.plugin.cleanup) {
        await state.plugin.cleanup();
      }
    }

    state.enabled = enabled;
    logger.info(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Run health checks on all plugins
   */
  async runHealthChecks(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [pluginId, state] of this.plugins) {
      if (!state.enabled) {
        results.set(pluginId, false);
        continue;
      }

      if (state.plugin.healthCheck) {
        try {
          const healthy = await state.plugin.healthCheck();
          state.healthStatus = healthy ? 'healthy' : 'unhealthy';
          state.lastHealthCheck = new Date().toISOString();
          results.set(pluginId, healthy);
        } catch (error) {
          state.healthStatus = 'unhealthy';
          state.error = error instanceof Error ? error.message : String(error);
          results.set(pluginId, false);
        }
      } else {
        results.set(pluginId, true);
      }
    }

    return results;
  }

  /**
   * Get tool definition by name
   */
  getTool(toolName: string): ToolDefinition | null {
    const entry = this.toolIndex.get(toolName);
    return entry?.tool ?? null;
  }

  /**
   * Convert tools to OpenAI function format for AI integration
   */
  getToolsAsOpenAIFunctions(context: ToolContext): Array<{
    name: string;
    description: string;
    parameters: JSONSchema;
  }> {
    const tools = this.getAvailableTools(context);
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }

  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool ${tool.name} must have a description`);
    }
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      throw new Error(`Tool ${tool.name} must have an inputSchema`);
    }
    if (!tool.outputSchema || typeof tool.outputSchema !== 'object') {
      throw new Error(`Tool ${tool.name} must have an outputSchema`);
    }
    if (typeof tool.handler !== 'function') {
      throw new Error(`Tool ${tool.name} must have a handler function`);
    }
  }
}

// ============== Factory Function ==============

const pluginManagerInstances: Map<string, PluginManager> = new Map();

export function getPluginManager(config: Record<string, unknown> = {}): PluginManager {
  let instance = pluginManagerInstances.get(PLATFORM_ID);
  if (!instance) {
    instance = new PluginManager(config);
    pluginManagerInstances.set(PLATFORM_ID, instance);
  }
  return instance;
}

export function clearPluginManager(): void {
  pluginManagerInstances.delete(PLATFORM_ID);
}
