/**
 * HTTP Action Executor
 * Executes HTTP request actions in workflows
 */

import type { HTTPRequestAction } from '@/types/workflow';

/**
 * Execute HTTP action
 */
export async function executeHTTPAction(
  action: HTTPRequestAction,
  triggerData: any
): Promise<any> {
  // Resolve variables
  const url = resolveVariables(action.url, triggerData);
  const method = action.method;
  const headers = action.headers ? resolveVariables(action.headers, triggerData) : {};
  const body = action.body ? resolveVariables(action.body, triggerData) : undefined;
  const timeout = 30000;
  
  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  
  // Make request
  const response = await fetch(url, fetchOptions);
  
  const responseData = await response.text();
  let parsedData: any;
  try {
    parsedData = JSON.parse(responseData);
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
}

/**
 * Resolve variables in config
 */
function resolveVariables(config: unknown, triggerData: Record<string, unknown>): unknown {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
      const trimmedPath = typeof path === 'string' ? path.trim() : String(path);
      const value = getNestedValue(triggerData, trimmedPath);
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const key in config as Record<string, unknown>) {
      resolved[key] = resolveVariables((config as Record<string, unknown>)[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

