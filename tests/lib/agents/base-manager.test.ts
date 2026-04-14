/**
 * BaseManager Unit Tests
 *
 * Tests the abstract BaseManager class via a minimal concrete subclass
 * (TestManager). Covers specialist registration, delegation routing,
 * broadcasting, capability reporting, pause checking, and the review/retry
 * quality gate.
 *
 * All external I/O (MemoryVault, SignalBus, swarm-control,
 * performance-tracker, logger) is mocked so tests are hermetic and fast.
 */

// ---------------------------------------------------------------------------
// Mocks — factories use inline jest.fn() to avoid hoisting issues.
// Top-level `const mock*` names with jest.fn() ARE accessible in factories
// when prefixed with "mock" (Babel-jest allowance), but nested object
// properties must be defined inline. We therefore keep factory bodies
// self-contained and re-expose handles via jest.mocked() after imports.
// ---------------------------------------------------------------------------

const mockVaultWrite = jest.fn();
const mockVaultQuery = jest.fn().mockResolvedValue([]);
const mockVaultGetMessagesForAgent = jest.fn().mockResolvedValue([]);
const mockSignalBusSend = jest.fn().mockResolvedValue(undefined);
const mockSignalBusCreateSignal = jest.fn((type: string, from: string, to: string, payload: unknown) => ({
  id: `sig_${Date.now()}`,
  type,
  origin: from,
  target: to,
  payload,
  hops: [],
  maxHops: 10,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
}));

jest.mock('@/lib/agents/shared/memory-vault', () => ({
  __esModule: true,
  getMemoryVault: jest.fn(() => ({
    write: mockVaultWrite,
    query: mockVaultQuery,
    getMessagesForAgent: mockVaultGetMessagesForAgent,
  })),
}));

jest.mock('@/lib/orchestrator/signal-bus', () => ({
  __esModule: true,
  getSignalBus: jest.fn(() => ({
    send: mockSignalBusSend,
    createSignal: mockSignalBusCreateSignal,
  })),
}));

jest.mock('@/lib/orchestration/swarm-control', () => ({
  __esModule: true,
  isManagerPaused: jest.fn(),
}));

jest.mock('@/lib/agents/shared/performance-tracker', () => ({
  __esModule: true,
  recordExecution: jest.fn(),
}));

jest.mock('@/lib/logger/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports — after all mocks
// ---------------------------------------------------------------------------

import { BaseManager, type ReviewResult, type MutationDirective } from '@/lib/agents/base-manager';
import { BaseSpecialist } from '@/lib/agents/base-specialist';
import { isManagerPaused } from '@/lib/orchestration/swarm-control';
import { recordExecution } from '@/lib/agents/shared/performance-tracker';
import { getMemoryVault } from '@/lib/agents/shared/memory-vault';
import type {
  AgentMessage,
  AgentReport,
  ManagerConfig,
  Signal,
  SpecialistConfig,
} from '@/lib/agents/types';

// Typed handles to the auto-mocked module functions
const mockedIsManagerPaused = jest.mocked(isManagerPaused);
const mockedRecordExecution = jest.mocked(recordExecution);
const mockedGetMemoryVault = jest.mocked(getMemoryVault);

// ---------------------------------------------------------------------------
// Helpers — shared config builders
// ---------------------------------------------------------------------------

function makeManagerConfig(overrides: Partial<ManagerConfig> = {}): ManagerConfig {
  return {
    identity: {
      id: 'mgr-test',
      name: 'Test Manager',
      role: 'manager',
      status: 'FUNCTIONAL',
      reportsTo: null,
      capabilities: ['coordinate'],
    },
    systemPrompt: '',
    tools: [],
    outputSchema: {},
    maxTokens: 1000,
    temperature: 0.5,
    specialists: [],
    delegationRules: [
      { triggerKeywords: ['test', 'verify'], delegateTo: 'test-specialist-1', priority: 10, requiresApproval: false },
      { triggerKeywords: ['report'], delegateTo: 'report-specialist-2', priority: 5, requiresApproval: false },
    ],
    ...overrides,
  };
}

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: 'msg-001',
    timestamp: new Date(),
    from: 'jasper',
    to: 'mgr-test',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: { task: 'test the system' },
    requiresResponse: false,
    traceId: 'trace-001',
    ...overrides,
  };
}

function makeReport(overrides: Partial<AgentReport> = {}): AgentReport {
  return {
    agentId: 'test-specialist-1',
    timestamp: new Date(),
    taskId: 'msg-001',
    status: 'COMPLETED',
    data: { result: 'ok' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Concrete TestManager — minimal, fully typed implementation
// ---------------------------------------------------------------------------

class TestManager extends BaseManager {
  // Promote protected methods to public for direct testing.
  // Override the real LLM-backed reviewOutput with a synchronous pass-through
  // so unit tests don't require Firestore or OpenRouter. Tests that need to
  // exercise the real review path use the non-overridden BaseManager.
  public async reviewOutput(_report: AgentReport): Promise<ReviewResult> {
    return Promise.resolve({ approved: true, feedback: [], severity: 'PASS', qualityScore: 100 });
  }

  public findDelegationTargetPublic(message: AgentMessage): string | null {
    return super.findDelegationTarget(message);
  }

  public delegateToSpecialistPublic(specialistId: string, message: AgentMessage): Promise<AgentReport> {
    return super.delegateToSpecialist(specialistId, message);
  }

  public broadcastToSpecialistsPublic(signal: Signal): Promise<AgentReport[]> {
    return super.broadcastToSpecialists(signal);
  }

  public checkManagerPausedPublic(taskId: string): Promise<AgentReport | null> {
    return super.checkManagerPaused(taskId);
  }

  public delegateWithReviewPublic(specialistId: string, message: AgentMessage): Promise<AgentReport> {
    return super.delegateWithReview(specialistId, message);
  }

  protected getManagedMutationTypes(): string[] {
    return ['test_mutation'];
  }

  protected applyMutation(_directive: MutationDirective): { mutationType: string; applied: boolean; beforeState: Record<string, unknown>; afterState: Record<string, unknown> } {
    return { mutationType: _directive.type, applied: true, beforeState: {}, afterState: {} };
  }

  // Required abstract methods from BaseSpecialist
  initialize(): Promise<void> { return Promise.resolve(); }

  execute(message: AgentMessage): Promise<AgentReport> {
    return Promise.resolve(this.createReport(message.id, 'COMPLETED', { executed: true }));
  }

  handleSignal(signal: Signal): Promise<AgentReport> {
    return Promise.resolve(this.createReport(signal.id, 'COMPLETED', { handled: true }));
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 50, boilerplate: 10 };
  }
}

// ---------------------------------------------------------------------------
// TestSpecialist — fully typed, no stubs, carries its own mock handles
// ---------------------------------------------------------------------------

function makeSpecialistConfig(
  id: string,
  name: string,
  status: SpecialistConfig['identity']['status'] = 'FUNCTIONAL'
): SpecialistConfig {
  return {
    identity: { id, name, role: 'specialist', status, reportsTo: 'mgr-test', capabilities: ['unit testing'] },
    systemPrompt: '',
    tools: [],
    outputSchema: {},
    maxTokens: 500,
    temperature: 0.3,
  };
}

class TestSpecialist extends BaseSpecialist {
  public readonly handleMessageMock: jest.Mock;
  public readonly handleSignalMock: jest.Mock;

  constructor(config: SpecialistConfig) {
    super(config);
    this.handleMessageMock = jest.fn().mockResolvedValue(
      makeReport({ agentId: config.identity.id, taskId: 'msg-001', status: 'COMPLETED' })
    );
    this.handleSignalMock = jest.fn().mockResolvedValue(
      makeReport({ agentId: config.identity.id, taskId: 'sig-001', status: 'COMPLETED' })
    );
  }

  initialize(): Promise<void> { return Promise.resolve(); }

  execute(message: AgentMessage): Promise<AgentReport> {
    return this.handleMessageMock(message) as Promise<AgentReport>;
  }

  handleSignal(signal: Signal): Promise<AgentReport> {
    return this.handleSignalMock(signal) as Promise<AgentReport>;
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 30, boilerplate: 5 };
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('BaseManager', () => {
  let manager: TestManager;
  let functionalSpecialist: TestSpecialist;
  let ghostSpecialist: TestSpecialist;
  let shellSpecialist: TestSpecialist;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-wire top-level mock handles that factories closed over
    mockedIsManagerPaused.mockResolvedValue(false);
    mockedRecordExecution.mockResolvedValue(undefined as never);
    mockedGetMemoryVault.mockReturnValue({
      write: mockVaultWrite,
      query: mockVaultQuery,
      getMessagesForAgent: mockVaultGetMessagesForAgent,
    } as never);

    manager = new TestManager(makeManagerConfig());

    functionalSpecialist = new TestSpecialist(
      makeSpecialistConfig('test-specialist-1', 'Test Specialist', 'FUNCTIONAL')
    );
    ghostSpecialist = new TestSpecialist(
      makeSpecialistConfig('ghost-specialist-2', 'Ghost Specialist', 'GHOST')
    );
    shellSpecialist = new TestSpecialist(
      makeSpecialistConfig('shell-specialist-3', 'Shell Specialist', 'SHELL')
    );
  });

  // =========================================================================
  // registerSpecialist
  // =========================================================================

  describe('registerSpecialist()', () => {
    it('adds the specialist to the internal registry', () => {
      manager.registerSpecialist(functionalSpecialist);

      const statuses = manager.getSpecialistStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].id).toBe('test-specialist-1');
      expect(statuses[0].name).toBe('Test Specialist');
    });

    it('can register multiple specialists independently', () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);

      const statuses = manager.getSpecialistStatuses();
      expect(statuses).toHaveLength(2);
      const ids = statuses.map(s => s.id);
      expect(ids).toContain('test-specialist-1');
      expect(ids).toContain('ghost-specialist-2');
    });
  });

  // =========================================================================
  // getSpecialistStatuses
  // =========================================================================

  describe('getSpecialistStatuses()', () => {
    it('returns empty array when no specialists are registered', () => {
      expect(manager.getSpecialistStatuses()).toEqual([]);
    });

    it('returns id, name, and status for every registered specialist', () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);
      manager.registerSpecialist(shellSpecialist);

      const statuses = manager.getSpecialistStatuses();
      expect(statuses).toHaveLength(3);

      const functional = statuses.find(s => s.id === 'test-specialist-1');
      expect(functional).toBeDefined();
      expect(functional?.status).toBe('FUNCTIONAL');

      expect(statuses.find(s => s.id === 'ghost-specialist-2')?.status).toBe('GHOST');
      expect(statuses.find(s => s.id === 'shell-specialist-3')?.status).toBe('SHELL');
    });
  });

  // =========================================================================
  // getFunctionalSpecialistCount
  // =========================================================================

  describe('getFunctionalSpecialistCount()', () => {
    it('returns all-zero counts when no specialists are registered', () => {
      expect(manager.getFunctionalSpecialistCount()).toEqual({ total: 0, functional: 0, ghosts: 0, shells: 0 });
    });

    it('counts only FUNCTIONAL specialists as functional, separates ghosts and shells', () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);
      manager.registerSpecialist(shellSpecialist);

      const counts = manager.getFunctionalSpecialistCount();
      expect(counts.total).toBe(3);
      expect(counts.functional).toBe(1);
      expect(counts.ghosts).toBe(1);
      expect(counts.shells).toBe(1);
    });

    it('counts a TESTED specialist as functional', () => {
      const tested = new TestSpecialist(
        makeSpecialistConfig('tested-spec', 'Tested Spec', 'TESTED')
      );
      manager.registerSpecialist(tested);

      const counts = manager.getFunctionalSpecialistCount();
      expect(counts.functional).toBe(1);
      expect(counts.ghosts).toBe(0);
      expect(counts.shells).toBe(0);
    });
  });

  // =========================================================================
  // findDelegationTarget
  // =========================================================================

  describe('findDelegationTarget()', () => {
    it('routes a message to the specialist whose keyword appears in the payload', () => {
      const message = makeMessage({ payload: { task: 'please test this feature' } });
      expect(manager.findDelegationTargetPublic(message)).toBe('test-specialist-1');
    });

    it('chooses the higher-priority rule when multiple rules match', () => {
      // 'test' hits priority-10 rule; 'report' hits priority-5 rule.
      const message = makeMessage({ payload: { task: 'test the report output' } });
      expect(manager.findDelegationTargetPublic(message)).toBe('test-specialist-1');
    });

    it('returns null when no keyword in the payload matches any delegation rule', () => {
      const message = makeMessage({ payload: { task: 'deploy the application' } });
      expect(manager.findDelegationTargetPublic(message)).toBeNull();
    });
  });

  // =========================================================================
  // delegateToSpecialist
  // =========================================================================

  describe('delegateToSpecialist()', () => {
    it('calls execute() on the registered specialist and returns its report', async () => {
      manager.registerSpecialist(functionalSpecialist);
      const message = makeMessage();

      const report = await manager.delegateToSpecialistPublic('test-specialist-1', message);

      expect(functionalSpecialist.handleMessageMock).toHaveBeenCalledWith(message);
      expect(report.status).toBe('COMPLETED');
      expect(report.agentId).toBe('test-specialist-1');
    });

    it('returns a FAILED report when the specialist ID is not registered', async () => {
      const report = await manager.delegateToSpecialistPublic('unknown-id', makeMessage());

      expect(report.status).toBe('FAILED');
      expect(report.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('unknown-id')])
      );
    });

    it('returns a BLOCKED report with SPECIALIST_NOT_BUILT reason for GHOST specialists', async () => {
      manager.registerSpecialist(ghostSpecialist);
      const report = await manager.delegateToSpecialistPublic('ghost-specialist-2', makeMessage({ id: 'msg-ghost' }));

      expect(report.status).toBe('BLOCKED');
      expect((report.data as Record<string, unknown>).reason).toBe('SPECIALIST_NOT_BUILT');
    });

    it('returns a BLOCKED report with SPECIALIST_IS_SHELL reason for SHELL specialists', async () => {
      manager.registerSpecialist(shellSpecialist);
      const report = await manager.delegateToSpecialistPublic('shell-specialist-3', makeMessage({ id: 'msg-shell' }));

      expect(report.status).toBe('BLOCKED');
      expect((report.data as Record<string, unknown>).reason).toBe('SPECIALIST_IS_SHELL');
    });
  });

  // =========================================================================
  // broadcastToSpecialists
  // =========================================================================

  describe('broadcastToSpecialists()', () => {
    function makeSignal(id: string): Signal {
      return {
        id,
        type: 'BROADCAST',
        origin: 'jasper',
        target: 'ALL',
        payload: makeMessage({ id }),
        hops: [],
        maxHops: 10,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      };
    }

    it('calls handleSignal() on every FUNCTIONAL specialist', async () => {
      manager.registerSpecialist(functionalSpecialist);
      const signal = makeSignal('sig-001');

      const reports = await manager.broadcastToSpecialistsPublic(signal);

      expect(reports).toHaveLength(1);
      expect(functionalSpecialist.handleSignalMock).toHaveBeenCalledWith(signal);
      expect(reports[0].status).toBe('COMPLETED');
    });

    it('emits a BLOCKED report for non-functional specialists without calling handleSignal', async () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);
      const signal = makeSignal('sig-002');

      const reports = await manager.broadcastToSpecialistsPublic(signal);

      expect(reports).toHaveLength(2);
      expect(ghostSpecialist.handleSignalMock).not.toHaveBeenCalled();

      const blockedReport = reports.find(r => r.status === 'BLOCKED');
      expect(blockedReport).toBeDefined();
    });
  });

  // =========================================================================
  // getCapabilityReport
  // =========================================================================

  describe('getCapabilityReport()', () => {
    it('reports actuallyWorks=true and no blockers when manager is FUNCTIONAL with only functional specialists', () => {
      manager.registerSpecialist(functionalSpecialist);

      const report = manager.getCapabilityReport();

      expect(report.manager).toBe('mgr-test');
      expect(report.status).toBe('FUNCTIONAL');
      expect(report.actuallyWorks).toBe(true);
      expect(report.blockedBy).toHaveLength(0);
    });

    it('lists ghost and shell IDs in blockedBy and sets actuallyWorks=false', () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);
      manager.registerSpecialist(shellSpecialist);

      const report = manager.getCapabilityReport();

      expect(report.blockedBy).toContain('ghost-specialist-2');
      expect(report.blockedBy).toContain('shell-specialist-3');
      expect(report.blockedBy).not.toContain('test-specialist-1');
      expect(report.actuallyWorks).toBe(false);
    });

    it('includes all registered specialists with their hasRealLogic flag', () => {
      manager.registerSpecialist(functionalSpecialist);
      manager.registerSpecialist(ghostSpecialist);

      const report = manager.getCapabilityReport();

      expect(report.specialists).toHaveLength(2);
      const funcEntry = report.specialists.find(s => s.id === 'test-specialist-1');
      expect(funcEntry?.hasRealLogic).toBe(true);
    });
  });

  // =========================================================================
  // checkManagerPaused
  // =========================================================================

  describe('checkManagerPaused()', () => {
    it('returns null when the manager is not paused', async () => {
      mockedIsManagerPaused.mockResolvedValue(false);

      const result = await manager.checkManagerPausedPublic('task-123');

      expect(result).toBeNull();
    });

    it('returns a BLOCKED AgentReport containing MANAGER_PAUSED reason when paused', async () => {
      mockedIsManagerPaused.mockResolvedValue(true);

      const result = await manager.checkManagerPausedPublic('task-456');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('BLOCKED');
      expect(result?.taskId).toBe('task-456');
      expect((result?.data as Record<string, unknown>).reason).toBe('MANAGER_PAUSED');
      expect((result?.data as Record<string, unknown>).managerId).toBe('mgr-test');
    });

    it('passes the manager identity ID to isManagerPaused', async () => {
      mockedIsManagerPaused.mockResolvedValue(false);

      await manager.checkManagerPausedPublic('task-789');

      expect(mockedIsManagerPaused).toHaveBeenCalledWith('mgr-test');
    });
  });

  // =========================================================================
  // delegateWithReview (quality gate)
  // =========================================================================

  describe('delegateWithReview()', () => {
    it('returns the specialist report immediately when reviewOutput approves on the first attempt', async () => {
      manager.registerSpecialist(functionalSpecialist);

      const report = await manager.delegateWithReviewPublic('test-specialist-1', makeMessage());

      expect(report.status).toBe('COMPLETED');
      expect(functionalSpecialist.handleMessageMock).toHaveBeenCalledTimes(1);
    });

    it('retries on review failure and succeeds on a subsequent attempt', async () => {
      // The quality gate is called once per execute() call. The feedback-injection
      // path also calls reviewOutput() to get feedback text for the retry message.
      // We use a flag-based approach to approve only after at least one rejection,
      // verifying that execute() is invoked more than once.
      let gateApproved = false;
      jest.spyOn(manager, 'reviewOutput').mockImplementation((): Promise<ReviewResult> => {
        if (!gateApproved) {
          // Reject the first time the gate evaluates a real report, then approve.
          // The review cache in BaseManager keys on the AgentReport object, so
          // successive calls with DIFFERENT report objects (one per retry) each
          // re-enter this mock and flip the flag.
          gateApproved = true;
          return Promise.resolve({ approved: false, feedback: ['Too short'], severity: 'MAJOR', qualityScore: 40 });
        }
        return Promise.resolve({ approved: true, feedback: [], severity: 'PASS', qualityScore: 90 });
      });

      manager.registerSpecialist(functionalSpecialist);

      const report = await manager.delegateWithReviewPublic('test-specialist-1', makeMessage());

      // At minimum two calls to execute() — the initial attempt plus at least one retry
      expect(functionalSpecialist.handleMessageMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(report.status).toBe('COMPLETED');
    });

    it('escalates to Jasper via MemoryVault after exhausting all retries', async () => {
      jest.spyOn(manager, 'reviewOutput').mockResolvedValue({
        approved: false,
        feedback: ['Does not meet quality bar'],
        severity: 'BLOCK',
        qualityScore: 10,
      });

      manager.registerSpecialist(functionalSpecialist);
      const message = makeMessage({ id: 'msg-escalate' });

      const report = await manager.delegateWithReviewPublic('test-specialist-1', message);

      expect(report.status).toBe('BLOCKED');
      expect((report.data as Record<string, unknown>).reason).toBe('QUALITY_GATE_ESCALATION');

      expect(mockVaultWrite).toHaveBeenCalledWith(
        'CROSS_AGENT',
        expect.stringContaining('escalation_msg-escalate'),
        expect.objectContaining({ toAgent: 'JASPER' }),
        'mgr-test',
        expect.objectContaining({ tags: expect.arrayContaining(['escalation', 'quality-gate']) })
      );
    });

    it('returns a FAILED report immediately without retrying when the specialist itself fails', async () => {
      functionalSpecialist.handleMessageMock.mockResolvedValue(
        makeReport({ status: 'FAILED', errors: ['Specialist exploded'] })
      );
      manager.registerSpecialist(functionalSpecialist);

      const report = await manager.delegateWithReviewPublic('test-specialist-1', makeMessage());

      expect(report.status).toBe('FAILED');
      expect(functionalSpecialist.handleMessageMock).toHaveBeenCalledTimes(1);
    });
  });
});
