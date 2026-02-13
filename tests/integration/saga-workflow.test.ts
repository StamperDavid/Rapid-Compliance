/**
 * Saga Workflow Integration Tests
 *
 * Tests the saga persistence and checkpoint/resume lifecycle:
 * - Saga creation → step execution → checkpoint persistence
 * - Crash simulation → resume from last successful step
 * - Compensation logic on failure (rollback)
 * - Event deduplication
 * - Event replay for unconfirmed events
 *
 * @test-scope Tier 1.3 — E2E Agent Integration Testing
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  checkpointSaga,
  loadSagaState,
  findIncompleteSagas,
  completeSaga,
  cleanupOldSagas,
  isEventProcessed,
  persistEventLog,
  confirmEvent,
  findUnconfirmedEvents,
  type PersistedSagaState,
  type PersistedEventLog,
  type SerializedSagaStep,
  type SerializedCommandResult,
} from '@/lib/orchestration/saga-persistence';

// =============================================================================
// TEST HELPERS
// =============================================================================

const TEST_PREFIX = 'E2E_TEMP_saga_';

function createTestSagaId(): string {
  return `${TEST_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTestStep(overrides: Partial<SerializedSagaStep> = {}): SerializedSagaStep {
  return {
    id: `step_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Step',
    commandId: `cmd_${Math.random().toString(36).slice(2, 8)}`,
    targetManager: 'marketing-manager',
    payload: { testKey: 'testValue' },
    priority: 'NORMAL',
    dependencies: [],
    required: true,
    timeout: 30000,
    retries: 1,
    ...overrides,
  };
}

function createTestSagaState(overrides: Partial<PersistedSagaState> = {}): PersistedSagaState {
  const sagaId = createTestSagaId();
  return {
    id: sagaId,
    name: 'E2E_TEMP_Test Saga',
    description: 'Test saga for integration testing',
    status: 'IN_PROGRESS',
    currentStepIndex: 0,
    completedStepIds: [],
    results: {},
    steps: [
      createTestStep({ id: 'step_1', name: 'Step 1' }),
      createTestStep({ id: 'step_2', name: 'Step 2' }),
      createTestStep({ id: 'step_3', name: 'Step 3' }),
    ],
    startedAt: new Date().toISOString(),
    lastCheckpointAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestCommandResult(overrides: Partial<SerializedCommandResult> = {}): SerializedCommandResult {
  return {
    commandId: `cmd_${Math.random().toString(36).slice(2, 8)}`,
    managerId: 'marketing-manager',
    status: 'SUCCESS',
    data: { result: 'test output' },
    errors: [],
    executionTimeMs: 150,
    ...overrides,
  };
}

function createTestEventLog(overrides: Partial<PersistedEventLog> = {}): PersistedEventLog {
  const eventId = `${TEST_PREFIX}evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: eventId,
    type: 'LEAD_CREATED',
    timestamp: new Date().toISOString(),
    source: 'test-harness',
    payload: { leadId: 'test_lead_1' },
    processedAt: new Date().toISOString(),
    deduplicationKey: `dedup_${eventId}`,
    matchedRules: ['rule_lead_nurture'],
    dispatchedActions: [
      {
        ruleId: 'rule_lead_nurture',
        targetManager: 'marketing-manager',
        command: 'NURTURE_LEAD',
        success: true,
      },
    ],
    processingTimeMs: 42,
    confirmed: false,
    ...overrides,
  };
}

// Track created saga IDs for cleanup
const createdSagaIds: string[] = [];
const createdEventIds: string[] = [];

afterAll(async () => {
  // Cleanup: Mark all test sagas as completed so cleanupOldSagas can remove them
  for (const sagaId of createdSagaIds) {
    try {
      await completeSaga(sagaId, 'COMPLETED');
    } catch {
      // Ignore cleanup errors
    }
  }
});

// =============================================================================
// SAGA CHECKPOINT / RESUME TESTS
// =============================================================================

describe('Saga Checkpoint & Resume', () => {
  let testSaga: PersistedSagaState;

  beforeEach(() => {
    testSaga = createTestSagaState();
    createdSagaIds.push(testSaga.id);
  });

  it('should persist a saga checkpoint to Firestore', async () => {
    await checkpointSaga(testSaga);

    const loaded = await loadSagaState(testSaga.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(testSaga.id);
    expect(loaded?.name).toBe(testSaga.name);
    expect(loaded?.status).toBe('IN_PROGRESS');
    expect(loaded?.steps).toHaveLength(3);
  });

  it('should update checkpoint on step completion', async () => {
    // Initial checkpoint at step 0
    await checkpointSaga(testSaga);

    // Simulate step 1 completion
    const result1 = createTestCommandResult({ commandId: testSaga.steps[0].commandId });
    const updated: PersistedSagaState = {
      ...testSaga,
      currentStepIndex: 1,
      completedStepIds: ['step_1'],
      results: { [testSaga.steps[0].commandId]: result1 },
    };
    await checkpointSaga(updated);

    // Verify checkpoint reflects progress
    const loaded = await loadSagaState(testSaga.id);
    expect(loaded?.currentStepIndex).toBe(1);
    expect(loaded?.completedStepIds).toContain('step_1');
    expect(loaded?.results[testSaga.steps[0].commandId]?.status).toBe('SUCCESS');
  });

  it('should simulate crash and resume from last checkpoint', async () => {
    // Simulate executing steps 1 and 2
    const afterStep2: PersistedSagaState = {
      ...testSaga,
      currentStepIndex: 2,
      completedStepIds: ['step_1', 'step_2'],
      results: {
        [testSaga.steps[0].commandId]: createTestCommandResult({ commandId: testSaga.steps[0].commandId }),
        [testSaga.steps[1].commandId]: createTestCommandResult({ commandId: testSaga.steps[1].commandId }),
      },
    };
    await checkpointSaga(afterStep2);

    // === SIMULATE CRASH ===
    // (Process restarts, in-memory state is gone)

    // === RESUME ===
    const resumed = await loadSagaState(testSaga.id);
    expect(resumed).not.toBeNull();
    expect(resumed?.currentStepIndex).toBe(2);
    expect(resumed?.completedStepIds).toEqual(['step_1', 'step_2']);
    expect(Object.keys(resumed?.results ?? {})).toHaveLength(2);

    // Saga should continue from step 3 (index 2)
    const nextStepIndex = resumed?.currentStepIndex ?? 0;
    expect(nextStepIndex).toBe(2);
    expect(resumed?.steps[nextStepIndex]?.id).toBe('step_3');
  });

  it('should find incomplete sagas for cron resume', async () => {
    // Create an IN_PROGRESS saga
    await checkpointSaga(testSaga);

    const incomplete = await findIncompleteSagas();
    // Should find at least our test saga
    const found = incomplete.find(s => s.id === testSaga.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('IN_PROGRESS');
  });

  it('should mark saga as completed', async () => {
    await checkpointSaga(testSaga);
    await completeSaga(testSaga.id, 'COMPLETED');

    const loaded = await loadSagaState(testSaga.id);
    expect(loaded?.status).toBe('COMPLETED');
    expect(loaded?.completedAt).toBeDefined();
  });

  it('should mark saga as failed with error', async () => {
    await checkpointSaga(testSaga);
    await completeSaga(testSaga.id, 'FAILED', 'Step 2 failed: API timeout');

    const loaded = await loadSagaState(testSaga.id);
    expect(loaded?.status).toBe('FAILED');
    expect(loaded?.error).toBe('Step 2 failed: API timeout');
  });

  it('should handle compensation on failure (rollback scenario)', async () => {
    // Step 1 succeeds
    const afterStep1: PersistedSagaState = {
      ...testSaga,
      currentStepIndex: 1,
      completedStepIds: ['step_1'],
      results: {
        [testSaga.steps[0].commandId]: createTestCommandResult({ commandId: testSaga.steps[0].commandId }),
      },
    };
    await checkpointSaga(afterStep1);

    // Step 2 fails — trigger compensation
    const afterStep2Fail: PersistedSagaState = {
      ...afterStep1,
      currentStepIndex: 1,
      status: 'COMPENSATING',
      results: {
        ...afterStep1.results,
        [testSaga.steps[1].commandId]: createTestCommandResult({
          commandId: testSaga.steps[1].commandId,
          status: 'FAILED',
          errors: ['API timeout on external service'],
        }),
      },
    };
    await checkpointSaga(afterStep2Fail);

    // Compensation: mark step 1 as compensated
    const afterCompensation: PersistedSagaState = {
      ...afterStep2Fail,
      status: 'COMPENSATED',
      results: {
        ...afterStep2Fail.results,
        [testSaga.steps[0].commandId]: createTestCommandResult({
          commandId: testSaga.steps[0].commandId,
          status: 'COMPENSATED',
        }),
      },
    };
    await checkpointSaga(afterCompensation);
    await completeSaga(testSaga.id, 'COMPENSATED');

    const loaded = await loadSagaState(testSaga.id);
    expect(loaded?.status).toBe('COMPENSATED');
    expect(loaded?.results[testSaga.steps[0].commandId]?.status).toBe('COMPENSATED');
    expect(loaded?.results[testSaga.steps[1].commandId]?.status).toBe('FAILED');
  });

  it('should return null for non-existent saga', async () => {
    const loaded = await loadSagaState('non_existent_saga_12345');
    expect(loaded).toBeNull();
  });
});

// =============================================================================
// EVENT DEDUPLICATION TESTS
// =============================================================================

describe('Event Deduplication', () => {
  it('should detect unprocessed events as not processed', async () => {
    const uniqueKey = `dedup_${TEST_PREFIX}${Date.now()}`;
    const processed = await isEventProcessed(uniqueKey);
    expect(processed).toBe(false);
  });

  it('should detect confirmed events as processed', async () => {
    const eventLog = createTestEventLog({ confirmed: true });
    createdEventIds.push(eventLog.id);

    await persistEventLog(eventLog);

    const processed = await isEventProcessed(eventLog.deduplicationKey);
    expect(processed).toBe(true);
  });

  it('should not detect unconfirmed events as processed', async () => {
    const eventLog = createTestEventLog({ confirmed: false });
    createdEventIds.push(eventLog.id);

    await persistEventLog(eventLog);

    const processed = await isEventProcessed(eventLog.deduplicationKey);
    expect(processed).toBe(false);
  });
});

// =============================================================================
// EVENT REPLAY TESTS
// =============================================================================

describe('Event Replay', () => {
  it('should persist event log entries', async () => {
    const eventLog = createTestEventLog();
    createdEventIds.push(eventLog.id);

    await persistEventLog(eventLog);

    // The event log should be persisted (we verify by checking unconfirmed events)
    // Since our event is unconfirmed and recent, it should appear in replay
    const unconfirmed = await findUnconfirmedEvents(60); // look back 60 minutes
    const found = unconfirmed.find(e => e.id === eventLog.id);
    expect(found).toBeDefined();
    expect(found?.type).toBe('LEAD_CREATED');
    expect(found?.confirmed).toBe(false);
  });

  it('should confirm events after successful processing', async () => {
    const eventLog = createTestEventLog();
    createdEventIds.push(eventLog.id);

    await persistEventLog(eventLog);
    await confirmEvent(eventLog.id);

    // Confirmed events should not appear in unconfirmed list
    const unconfirmed = await findUnconfirmedEvents(60);
    const found = unconfirmed.find(e => e.id === eventLog.id);
    expect(found).toBeUndefined();
  });

  it('should find unconfirmed events for replay', async () => {
    const event1 = createTestEventLog({ confirmed: false });
    const event2 = createTestEventLog({ confirmed: false });
    createdEventIds.push(event1.id, event2.id);

    await persistEventLog(event1);
    await persistEventLog(event2);

    const unconfirmed = await findUnconfirmedEvents(60);
    const foundIds = unconfirmed.map(e => e.id);
    expect(foundIds).toContain(event1.id);
    expect(foundIds).toContain(event2.id);
  });
});

// =============================================================================
// CLEANUP TESTS
// =============================================================================

describe('Saga Cleanup', () => {
  it('cleanupOldSagas should execute without error', async () => {
    // Just verify the function runs without throwing
    const deleted = await cleanupOldSagas(0); // 0 days = clean everything old
    expect(typeof deleted).toBe('number');
  });
});
