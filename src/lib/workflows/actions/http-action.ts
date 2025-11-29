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
function resolveVariables(config: any, triggerData: any): any {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: any = {};
    for (const key in config) {
      resolved[key] = resolveVariables(config[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

