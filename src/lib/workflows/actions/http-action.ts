/**
 * HTTP Action Executor
 * Executes HTTP request actions in workflows
 */

import type { HTTPRequestAction, WorkflowTriggerData } from '@/types/workflow';

/**
 * Execute HTTP action
 */
export async function executeHTTPAction(
  action: HTTPRequestAction,
  triggerData: WorkflowTriggerData
): Promise<unknown> {
  // Resolve variables
  const resolvedUrl = resolveVariables(action.url, triggerData);
  const url = typeof resolvedUrl === 'string' ? resolvedUrl : String(resolvedUrl);
  const method = action.method;
  const headers = action.headers ? resolveVariables(action.headers, triggerData) : {};
  const body = action.body ? resolveVariables(action.body, triggerData) : undefined;
  const timeout = 30000;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(typeof headers === 'object' && headers !== null ? headers as Record<string, string> : {}),
    },
    signal: controller.signal,
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // Make request
  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const responseData = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseData) as unknown;
    } catch {
      parsedData = responseData;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(parsedData)}`);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: parsedData,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Resolve variables in config
 */
function resolveVariables(config: unknown, triggerData: WorkflowTriggerData): unknown {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const key in config) {
      resolved[key] = resolveVariables((config as Record<string, unknown>)[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => 
    (current as Record<string, unknown>)?.[key], obj);
}

