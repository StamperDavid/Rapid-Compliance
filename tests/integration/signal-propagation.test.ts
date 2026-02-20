/**
 * Signal Propagation Integration Tests
 *
 * Tests the signal bus, swarm control, and inter-agent communication:
 * - Signal sent from one agent → received by another
 * - Swarm pause → signals queued → resume → signals dequeued
 * - Global kill switch guards on SignalBus, EventRouter, BaseManager
 * - Per-manager pause checks
 *
 * @test-scope Tier 1.3 — E2E Agent Integration Testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock firebase admin to prevent Firestore calls — swarm-control falls back to in-memory cache
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: null,
  adminAuth: null,
  adminStorage: null,
  admin: {},
  default: null,
}));

// Mock logger to silence output
jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { SignalBus } from '@/lib/orchestrator/signal-bus';
import {
  getSwarmControlState,
  pauseSwarm,
  resumeSwarm,
  pauseManager,
  resumeManager,
  pauseAgent,
  resumeAgent,
  isSwarmPaused,
  isManagerPaused,
  isAgentPaused,
  type SwarmControlState,
} from '@/lib/orchestration/swarm-control';
import type { Signal, AgentMessage, AgentReport, SignalHandler } from '@/lib/agents/types';

// =============================================================================
// TEST HELPERS
// =============================================================================

const TEST_PREFIX = 'E2E_TEMP_';

function createTestMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: `${TEST_PREFIX}msg_${Date.now()}`,
    timestamp: new Date(),
    from: `${TEST_PREFIX}agent_source`,
    to: `${TEST_PREFIX}agent_target`,
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: { action: 'test' },
    requiresResponse: false,
    traceId: `${TEST_PREFIX}trace_${Date.now()}`,
    ...overrides,
  };
}

function createTestSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: `${TEST_PREFIX}sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'DIRECT',
    origin: `${TEST_PREFIX}agent_source`,
    target: `${TEST_PREFIX}agent_target`,
    payload: createTestMessage(),
    hops: [],
    maxHops: 5,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function createMockHandler(agentId: string, response: Partial<AgentReport> = {}): SignalHandler {
  return {
    agentId,
    canHandle: () => true,
    handle: (): Promise<AgentReport> => Promise.resolve({
      agentId,
      timestamp: new Date(),
      taskId: `${TEST_PREFIX}task_1`,
      status: 'COMPLETED',
      data: { result: 'mock_result' },
      ...response,
    }),
  };
}

// =============================================================================
// SIGNAL BUS TESTS
// =============================================================================

describe('SignalBus — Agent-to-Agent Communication', () => {
  let bus: SignalBus;

  beforeEach(async () => {
    // Ensure swarm is not paused from a previous test
    await resumeSwarm('test_setup');
    bus = new SignalBus();
  });

  it('should register agents and send direct signals', async () => {
    const handlerA = createMockHandler(`${TEST_PREFIX}agent_A`);
    const handlerB = createMockHandler(`${TEST_PREFIX}agent_B`);

    bus.registerAgent(`${TEST_PREFIX}agent_A`, null, handlerA);
    bus.registerAgent(`${TEST_PREFIX}agent_B`, null, handlerB);

    const signal = createTestSignal({
      type: 'DIRECT',
      origin: `${TEST_PREFIX}agent_A`,
      target: `${TEST_PREFIX}agent_B`,
    });

    const reports = await bus.send(signal);

    // Signal should be processed (either delivered or queued if paused)
    expect(Array.isArray(reports)).toBe(true);
  });

  it('should deduplicate signals with same ID', async () => {
    const handler = createMockHandler(`${TEST_PREFIX}agent_dedup`);
    bus.registerAgent(`${TEST_PREFIX}agent_dedup`, null, handler);

    const signal = createTestSignal({
      target: `${TEST_PREFIX}agent_dedup`,
    });

    // Send same signal twice
    const results1 = await bus.send(signal);
    const results2 = await bus.send(signal);

    // Second send should return empty (deduplicated)
    expect(Array.isArray(results1)).toBe(true);
    expect(results2).toHaveLength(0);
  });

  it('should maintain signal history', async () => {
    const handler = createMockHandler(`${TEST_PREFIX}agent_history`);
    bus.registerAgent(`${TEST_PREFIX}agent_history`, null, handler);

    const signal = createTestSignal({
      target: `${TEST_PREFIX}agent_history`,
    });

    await bus.send(signal);

    const history = bus.getHistory();
    expect(history).toBeDefined();
    expect(Array.isArray(history.entries)).toBe(true);
  });

  it('should register parent-child hierarchy', () => {
    const managerHandler = createMockHandler(`${TEST_PREFIX}manager`);
    const specialistHandler = createMockHandler(`${TEST_PREFIX}specialist`);

    bus.registerAgent(`${TEST_PREFIX}manager`, null, managerHandler);
    bus.registerAgent(`${TEST_PREFIX}specialist`, `${TEST_PREFIX}manager`, specialistHandler);

    // Verify bus has agents registered (no errors thrown)
    const metrics = bus.getMetrics();
    expect(metrics).toBeDefined();
  });

  it('should handle broadcast signals', async () => {
    const handlerA = createMockHandler(`${TEST_PREFIX}bcast_A`);
    const handlerB = createMockHandler(`${TEST_PREFIX}bcast_B`);

    bus.registerAgent(`${TEST_PREFIX}bcast_A`, null, handlerA);
    bus.registerAgent(`${TEST_PREFIX}bcast_B`, null, handlerB);

    const signal = createTestSignal({
      type: 'BROADCAST',
      target: 'ALL',
    });

    const reports = await bus.send(signal);
    expect(Array.isArray(reports)).toBe(true);
  });
});

// =============================================================================
// SWARM CONTROL STATE TESTS
// =============================================================================

describe('Swarm Control — State Management', () => {
  let _originalState: SwarmControlState | null = null;

  beforeEach(async () => {
    try {
      _originalState = await getSwarmControlState();
    } catch {
      _originalState = null;
    }
  });

  afterEach(async () => {
    // Restore: always resume swarm and clear test pauses
    try {
      await resumeSwarm('test_cleanup');
      await resumeManager(`${TEST_PREFIX}manager_1`, 'test_cleanup');
      await resumeAgent(`${TEST_PREFIX}agent_1`, 'test_cleanup');
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should get default swarm state', async () => {
    const state = await getSwarmControlState();
    expect(state).toBeDefined();
    expect(typeof state.globalPause).toBe('boolean');
    expect(Array.isArray(state.pausedManagers)).toBe(true);
    expect(Array.isArray(state.pausedAgents)).toBe(true);
    expect(state.updatedAt).toBeDefined();
  });

  it('should pause and resume swarm globally', async () => {
    // Pause
    const paused = await pauseSwarm(`${TEST_PREFIX}tester`);
    expect(paused.globalPause).toBe(true);
    expect(paused.globalPauseBy).toBe(`${TEST_PREFIX}tester`);
    expect(paused.globalPauseAt).toBeDefined();

    // Verify via guard function
    const isPaused = await isSwarmPaused();
    expect(isPaused).toBe(true);

    // Resume
    const resumed = await resumeSwarm(`${TEST_PREFIX}tester`);
    expect(resumed.globalPause).toBe(false);

    const isPausedAfter = await isSwarmPaused();
    expect(isPausedAfter).toBe(false);
  });

  it('should pause and resume individual managers', async () => {
    const managerId = `${TEST_PREFIX}manager_1`;

    // Pause manager
    const paused = await pauseManager(managerId, `${TEST_PREFIX}tester`);
    expect(paused.pausedManagers).toContain(managerId);

    // Verify guard
    const isPaused = await isManagerPaused(managerId);
    expect(isPaused).toBe(true);

    // Another manager should NOT be paused
    const otherPaused = await isManagerPaused(`${TEST_PREFIX}manager_2`);
    expect(otherPaused).toBe(false);

    // Resume manager
    const resumed = await resumeManager(managerId, `${TEST_PREFIX}tester`);
    expect(resumed.pausedManagers).not.toContain(managerId);

    const isPausedAfter = await isManagerPaused(managerId);
    expect(isPausedAfter).toBe(false);
  });

  it('should pause and resume individual agents', async () => {
    const agentId = `${TEST_PREFIX}agent_1`;

    // Pause agent
    const paused = await pauseAgent(agentId, `${TEST_PREFIX}tester`);
    expect(paused.pausedAgents).toContain(agentId);

    // Verify guard
    const isPaused = await isAgentPaused(agentId);
    expect(isPaused).toBe(true);

    // Resume agent
    const resumed = await resumeAgent(agentId, `${TEST_PREFIX}tester`);
    expect(resumed.pausedAgents).not.toContain(agentId);
  });

  it('global pause should block all managers', async () => {
    const managerId = `${TEST_PREFIX}manager_global_test`;

    // Activate global pause
    await pauseSwarm(`${TEST_PREFIX}tester`);

    // Manager should now be paused even without individual pause
    const duringPause = await isManagerPaused(managerId);
    expect(duringPause).toBe(true);

    // Resume
    await resumeSwarm(`${TEST_PREFIX}tester`);

    // Manager should no longer be paused (unless individually paused)
    const afterResume = await isManagerPaused(managerId);
    expect(afterResume).toBe(false);
  });

  it('global pause should block all agents', async () => {
    const agentId = `${TEST_PREFIX}agent_global_test`;
    const managerId = `${TEST_PREFIX}manager_for_agent`;

    await pauseSwarm(`${TEST_PREFIX}tester`);

    const isPaused = await isAgentPaused(agentId, managerId);
    expect(isPaused).toBe(true);

    await resumeSwarm(`${TEST_PREFIX}tester`);

    const isPausedAfter = await isAgentPaused(agentId, managerId);
    expect(isPausedAfter).toBe(false);
  });

  it('manager pause should cascade to agents under that manager', async () => {
    const managerId = `${TEST_PREFIX}manager_cascade`;
    const agentId = `${TEST_PREFIX}agent_under_manager`;

    await pauseManager(managerId, `${TEST_PREFIX}tester`);

    // Agent under this manager should be paused
    const isPaused = await isAgentPaused(agentId, managerId);
    expect(isPaused).toBe(true);

    // Agent under different manager should NOT be paused
    const otherPaused = await isAgentPaused(agentId, `${TEST_PREFIX}other_manager`);
    expect(otherPaused).toBe(false);

    await resumeManager(managerId, `${TEST_PREFIX}tester`);
  });
});

// =============================================================================
// SIGNAL PAUSE → QUEUE → RESUME → DEQUEUE TESTS
// =============================================================================

describe('SignalBus — Pause/Queue/Resume/Dequeue', () => {
  let bus: SignalBus;

  beforeEach(() => {
    bus = new SignalBus();
  });

  afterEach(async () => {
    // Always resume to not leave system in paused state
    try {
      await resumeSwarm('test_cleanup');
    } catch {
      // Ignore
    }
  });

  it('should queue signals when swarm is paused', async () => {
    const handler = createMockHandler(`${TEST_PREFIX}queue_agent`);
    bus.registerAgent(`${TEST_PREFIX}queue_agent`, null, handler);

    // Pause the swarm
    await pauseSwarm(`${TEST_PREFIX}queue_test`);

    const signal = createTestSignal({
      target: `${TEST_PREFIX}queue_agent`,
    });

    const reports = await bus.send(signal);

    // Should return a BLOCKED/QUEUED report instead of executing
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe('BLOCKED');

    // Resume for cleanup
    await resumeSwarm(`${TEST_PREFIX}queue_test`);
  });

  it('should drain queued signals after resume', async () => {
    const handler = createMockHandler(`${TEST_PREFIX}dequeue_agent`);
    bus.registerAgent(`${TEST_PREFIX}dequeue_agent`, null, handler);

    // Pause → queue a signal
    await pauseSwarm(`${TEST_PREFIX}dequeue_test`);

    const signal = createTestSignal({
      target: `${TEST_PREFIX}dequeue_agent`,
    });

    await bus.send(signal);

    // Resume
    await resumeSwarm(`${TEST_PREFIX}dequeue_test`);

    // Drain pending signals
    const result = await bus.drainPausedSignals();
    expect(result).toBeDefined();
    expect(typeof result.processed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(Array.isArray(result.reports)).toBe(true);
  });
});

// =============================================================================
// GUARD FUNCTION UNIT TESTS
// =============================================================================

describe('Guard Functions', () => {
  afterEach(async () => {
    try {
      await resumeSwarm('guard_test_cleanup');
    } catch {
      // Ignore
    }
  });

  it('isSwarmPaused returns false by default', async () => {
    // Ensure not paused
    await resumeSwarm('guard_test_setup');

    const paused = await isSwarmPaused();
    expect(paused).toBe(false);
  });

  it('isSwarmPaused returns true after pauseSwarm', async () => {
    await pauseSwarm(`${TEST_PREFIX}guard_test`);

    const paused = await isSwarmPaused();
    expect(paused).toBe(true);

    await resumeSwarm(`${TEST_PREFIX}guard_test`);
  });

  it('isManagerPaused handles non-existent manager gracefully', async () => {
    await resumeSwarm('guard_test_setup');

    const paused = await isManagerPaused('non_existent_manager_xyz');
    expect(paused).toBe(false);
  });

  it('isAgentPaused handles non-existent agent gracefully', async () => {
    await resumeSwarm('guard_test_setup');

    const paused = await isAgentPaused('non_existent_agent_xyz');
    expect(paused).toBe(false);
  });
});
