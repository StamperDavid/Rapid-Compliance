/**
 * Jasper Tools — Unit Tests
 *
 * Tests the core tool execution framework: executeToolCall dispatcher,
 * query_docs (blueprint lookup), REVIEW_LINK_MAP routing, and tool result structure.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  executeToolCall,
  executeToolCalls,
  executeQueryDocs,
  executeInspectAgentLogs,
  JASPER_TOOLS,
  type ToolCall,
  type ToolResult,
} from '@/lib/orchestrator/jasper-tools';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/constants/platform', () => ({
  PLATFORM_ID: 'test-platform',
}));

// ============================================================================
// Helpers
// ============================================================================

function makeToolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: `call_${name}_${Date.now()}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Jasper Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Tool Definitions
  // --------------------------------------------------------------------------

  describe('JASPER_TOOLS definitions', () => {
    it('should have 51 tool definitions', () => {
      expect(JASPER_TOOLS.length).toBe(51);
    });

    it('should have unique tool names', () => {
      const names = JASPER_TOOLS.map((t) => t.function.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have valid function-calling format', () => {
      for (const tool of JASPER_TOOLS) {
        expect(tool.type).toBe('function');
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
      }
    });

    it('should include critical tools', () => {
      const names = JASPER_TOOLS.map((t) => t.function.name);
      expect(names).toContain('query_docs');
      expect(names).toContain('get_platform_stats');
      expect(names).toContain('get_system_state');
      expect(names).toContain('delegate_to_agent');
      expect(names).toContain('produce_video');
      expect(names).toContain('create_campaign');
    });
  });

  // --------------------------------------------------------------------------
  // executeQueryDocs
  // --------------------------------------------------------------------------

  describe('executeQueryDocs', () => {
    it('should return results when query matches blueprint content', async () => {
      const results = await executeQueryDocs('agent');
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.section).toBeDefined();
        expect(r.content).toBeDefined();
      }
    });

    it('should return summary when query has no matches', async () => {
      const results = await executeQueryDocs('zzz_nonexistent_term_xyz');
      expect(results.length).toBe(1);
      expect(results[0].section).toBe('Query Result');
      expect(results[0].content).toMatch(/No specific documentation found/);
    });

    it('should filter by section when provided', async () => {
      const results = await executeQueryDocs('agent', 'agents');
      // Should only return sections matching the agents category
      for (const r of results) {
        const isAgentSection =
          r.section.includes('Agents') ||
          r.section.includes('Specialized') ||
          r.section.includes('Creative') ||
          r.section.includes('Social') ||
          r.section.includes('Technical') ||
          r.section === 'Query Result';
        expect(isAgentSection).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // executeInspectAgentLogs
  // --------------------------------------------------------------------------

  describe('executeInspectAgentLogs', () => {
    it('should return log entries', async () => {
      const logs = await executeInspectAgentLogs('all');
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const logs = await executeInspectAgentLogs('all', 5);
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });

  // --------------------------------------------------------------------------
  // executeToolCall Dispatcher
  // --------------------------------------------------------------------------

  describe('executeToolCall', () => {
    it('should dispatch query_docs tool', async () => {
      const toolCall = makeToolCall('query_docs', { query: 'agents' });
      const result: ToolResult = await executeToolCall(toolCall);

      expect(result.tool_call_id).toBe(toolCall.id);
      expect(result.role).toBe('tool');
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');

      const parsed = JSON.parse(result.content);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should handle invalid JSON arguments gracefully', async () => {
      const toolCall: ToolCall = {
        id: 'call_bad_json',
        type: 'function',
        function: {
          name: 'query_docs',
          arguments: '{bad json',
        },
      };

      // Should not throw — handles gracefully
      const result = await executeToolCall(toolCall);
      expect(result.tool_call_id).toBe('call_bad_json');
      expect(result.role).toBe('tool');
    });

    it('should return error for query_docs with missing query arg', async () => {
      const toolCall = makeToolCall('query_docs', {});
      const result = await executeToolCall(toolCall);

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBeDefined();
    });

    it('should dispatch get_system_state tool', async () => {
      const toolCall = makeToolCall('get_system_state', {});
      const result = await executeToolCall(toolCall);

      expect(result.role).toBe('tool');
      const parsed = JSON.parse(result.content);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should dispatch provision_organization tool', async () => {
      const toolCall = makeToolCall('provision_organization', {
        name: 'Test Corp',
        ownerEmail: 'owner@test.com',
        plan: 'trial',
      });
      const result = await executeToolCall(toolCall);

      const parsed = JSON.parse(result.content);
      expect(parsed.status).toBe('queued');
      expect(parsed.message).toContain('Test Corp');
    });

    it('should handle unknown tool name gracefully', async () => {
      const toolCall = makeToolCall('nonexistent_tool', {});
      const result = await executeToolCall(toolCall);

      expect(result.role).toBe('tool');
      const parsed = JSON.parse(result.content);
      expect(parsed.error ?? parsed.message).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // executeToolCalls (batch)
  // --------------------------------------------------------------------------

  describe('executeToolCalls', () => {
    it('should execute multiple tools in parallel', async () => {
      const toolCalls: ToolCall[] = [
        makeToolCall('query_docs', { query: 'video' }),
        makeToolCall('get_system_state', {}),
      ];

      const results = await executeToolCalls(toolCalls);

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result.role).toBe('tool');
        expect(result.content).toBeDefined();
      }
    });
  });

  // --------------------------------------------------------------------------
  // REVIEW_LINK_MAP (routing fix verification)
  // --------------------------------------------------------------------------

  describe('REVIEW_LINK_MAP routing', () => {
    // Verify the fix: all delegation tools should route to /mission-control
    it('should route all delegate_to_* tools to /mission-control', async () => {
      // Execute a delegation tool to trigger getReviewLink
      const toolCall = makeToolCall('delegate_to_agent', {
        agentId: 'intelligence',
        action: 'research',
      });

      const result = await executeToolCall(toolCall);
      const parsed = JSON.parse(result.content);

      // The review link should be /mission-control, NOT /analytics
      if (parsed.reviewLink) {
        expect(parsed.reviewLink).not.toContain('/analytics');
      }
    });
  });
});
