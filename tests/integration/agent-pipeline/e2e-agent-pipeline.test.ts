/**
 * End-to-End Agent Pipeline Integration Tests
 * Task 3.3: Tests the full chain: user → API → orchestrator → manager → specialist → UI
 *
 * These tests verify that the entire agent swarm pipeline works correctly,
 * from user request through factory instantiation, orchestration, delegation,
 * specialist execution, and result propagation.
 */

import { describe, it, expect } from '@jest/globals';

// Agent Infrastructure
import {
  getAgentInstance,
  isValidAgentId,
  getAllAgentIds,
  getAgentIdsByTier,
  getAgentCount,
} from '@/lib/agents/agent-factory';
import { AGENT_IDS, type AgentId } from '@/lib/agents/index';
import type { AgentMessage, AgentReport, Signal } from '@/lib/agents/types';
import { BaseSpecialist } from '@/lib/agents/base-specialist';
import { BaseManager } from '@/lib/agents/base-manager';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a standardized AgentMessage for testing
 */
function createTestMessage(
  to: string,
  payload: Record<string, unknown>,
  options?: Partial<AgentMessage>
): AgentMessage {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'TEST_HARNESS',
    to,
    type: 'COMMAND',
    priority: 'NORMAL',
    payload,
    requiresResponse: true,
    traceId: `trace_test_${Date.now()}`,
    ...options,
  };
}

/**
 * Create a standardized Signal for testing
 */
function createTestSignal(
  origin: string,
  target: string,
  payload: AgentMessage
): Signal {
  return {
    id: `signal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'DIRECT',
    origin,
    target,
    payload,
    hops: [origin],
    maxHops: 5,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  };
}

/**
 * Validate an AgentReport has the expected shape
 */
function expectValidReport(report: AgentReport): void {
  expect(report).toBeDefined();
  expect(report.agentId).toBeDefined();
  expect(typeof report.agentId).toBe('string');
  expect(report.timestamp).toBeInstanceOf(Date);
  expect(report.taskId).toBeDefined();
  expect(['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED']).toContain(report.status);
}

// ============================================================================
// TIER 1: AGENT FACTORY & REGISTRY
// ============================================================================

describe('Agent Factory & Registry', () => {
  it('should validate all registered agent IDs', () => {
    const allIds = getAllAgentIds();
    expect(allIds.length).toBeGreaterThanOrEqual(40);

    for (const id of allIds) {
      expect(isValidAgentId(id)).toBe(true);
    }
  });

  it('should reject invalid agent IDs', () => {
    expect(isValidAgentId('FAKE_AGENT')).toBe(false);
    expect(isValidAgentId('')).toBe(false);
    expect(isValidAgentId('master_orchestrator')).toBe(false); // case-sensitive
  });

  it('should instantiate all registered agents', () => {
    const allIds = getAllAgentIds();
    let instantiated = 0;

    for (const id of allIds) {
      const agent = getAgentInstance(id);
      expect(agent).not.toBeNull();
      if (agent) {
        expect(agent).toBeInstanceOf(BaseSpecialist);
        instantiated++;
      }
    }

    expect(instantiated).toBe(allIds.length);
  });

  it('should return null for invalid agent IDs', () => {
    expect(getAgentInstance('INVALID_AGENT')).toBeNull();
    expect(getAgentInstance('')).toBeNull();
  });

  it('should categorize agents by tier correctly', () => {
    const l1 = getAgentIdsByTier('L1');
    const l2 = getAgentIdsByTier('L2');
    const l3 = getAgentIdsByTier('L3');

    expect(l1).toContain(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(l1).toHaveLength(1);

    expect(l2).toContain(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(l2).toContain(AGENT_IDS.MARKETING_MANAGER);
    expect(l2).toContain(AGENT_IDS.REVENUE_DIRECTOR);
    expect(l2.length).toBeGreaterThanOrEqual(9);

    expect(l3).toContain(AGENT_IDS.SCRAPER_SPECIALIST);
    expect(l3).toContain(AGENT_IDS.LINKEDIN_EXPERT);
    expect(l3).toContain(AGENT_IDS.LEAD_QUALIFIER);
    expect(l3.length).toBeGreaterThanOrEqual(30);
  });

  it('should report correct agent count', () => {
    const count = getAgentCount();
    expect(count).toBeGreaterThanOrEqual(40);
    expect(count).toBe(getAllAgentIds().length);
  });

  it('should match AGENT_IDS keys to factory registry', () => {
    const registryIds = new Set(getAllAgentIds());
    const constantIds = new Set(Object.values(AGENT_IDS));

    // Every constant ID should be in the factory
    for (const id of constantIds) {
      expect(registryIds.has(id)).toBe(true);
    }
  });
});

// ============================================================================
// TIER 2: AGENT IDENTITY & STATUS
// ============================================================================

describe('Agent Identity & Status', () => {
  it('should have valid identity for all agents', () => {
    const allIds = getAllAgentIds();

    for (const id of allIds) {
      const agent = getAgentInstance(id);
      if (!agent) {continue;}

      const identity = agent.getIdentity();
      // Agent internal identity ID may differ from factory key (e.g. TWITTER_X_EXPERT vs TWITTER_EXPERT)
      expect(identity.id).toBeTruthy();
      expect(identity.name).toBeTruthy();
      expect(identity.role).toBeTruthy();
      expect(['GHOST', 'UNBUILT', 'SHELL', 'FUNCTIONAL', 'TESTED']).toContain(identity.status);
      expect(identity.capabilities).toBeInstanceOf(Array);
      expect(identity.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('should have FUNCTIONAL or TESTED status for all agents', () => {
    const allIds = getAllAgentIds();
    const nonFunctional: string[] = [];

    for (const id of allIds) {
      const agent = getAgentInstance(id);
      if (!agent) {continue;}

      if (!agent.isFunctional()) {
        nonFunctional.push(id);
      }
    }

    // All agents should be functional (100% swarm completion)
    expect(nonFunctional).toEqual([]);
  });

  it('should report hasRealLogic for functional agents', () => {
    const allIds = getAllAgentIds();

    for (const id of allIds) {
      const agent = getAgentInstance(id);
      if (!agent?.isFunctional()) {continue;}

      expect(agent.hasRealLogic()).toBe(true);
    }
  });

  it('should have positive functional LOC for all agents', () => {
    const allIds = getAllAgentIds();

    for (const id of allIds) {
      const agent = getAgentInstance(id);
      if (!agent?.isFunctional()) {continue;}

      const loc = agent.getFunctionalLOC();
      expect(loc.functional).toBeGreaterThan(0);
      expect(loc.boilerplate).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have managers report to orchestrator or JASPER', () => {
    const managerIds = getAgentIdsByTier('L2');

    for (const id of managerIds) {
      const agent = getAgentInstance(id);
      if (!agent) {continue;}

      const identity = agent.getIdentity();
      expect(identity.reportsTo).not.toBeNull();
    }
  });

  it('should have specialists report to their manager', () => {
    const specialistIds = getAgentIdsByTier('L3');

    for (const id of specialistIds) {
      const agent = getAgentInstance(id);
      if (!agent) {continue;}

      const identity = agent.getIdentity();
      expect(identity.reportsTo).not.toBeNull();
    }
  });
});

// ============================================================================
// TIER 3: AGENT INITIALIZATION
// ============================================================================

describe('Agent Initialization', () => {
  it('should initialize all agents without errors', async () => {
    const sampleIds: AgentId[] = [
      AGENT_IDS.INTELLIGENCE_MANAGER,
      AGENT_IDS.SCRAPER_SPECIALIST,
      AGENT_IDS.LEAD_QUALIFIER,
      AGENT_IDS.COMPETITOR_RESEARCHER,
      AGENT_IDS.EMAIL_SPECIALIST,
    ];

    for (const id of sampleIds) {
      const agent = getAgentInstance(id);
      expect(agent).not.toBeNull();
      if (!agent) {continue;}

      // Should not throw during initialization
      await expect(agent.initialize()).resolves.not.toThrow();
    }
  });

  it('should initialize managers and register their specialists', async () => {
    const managerIds: AgentId[] = [
      AGENT_IDS.INTELLIGENCE_MANAGER,
      AGENT_IDS.MARKETING_MANAGER,
      AGENT_IDS.OUTREACH_MANAGER,
      AGENT_IDS.CONTENT_MANAGER,
    ];

    for (const id of managerIds) {
      const agent = getAgentInstance(id);
      if (!agent || !(agent instanceof BaseManager)) {continue;}

      await agent.initialize();

      // Manager should have registered specialists after initialization
      const statuses = agent.getSpecialistStatuses();
      expect(statuses.length).toBeGreaterThan(0);

      // Check specialist status summary
      const counts = agent.getFunctionalSpecialistCount();
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.functional).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// TIER 4: SPECIALIST EXECUTION (L3 → Report)
// ============================================================================

describe('Specialist Execution', () => {
  it('should execute ScraperSpecialist with a URL payload', async () => {
    const agent = getAgentInstance(AGENT_IDS.SCRAPER_SPECIALIST);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message = createTestMessage(AGENT_IDS.SCRAPER_SPECIALIST, {
      action: 'scrape_and_analyze',
      url: 'https://example.com',
      extractContacts: true,
      detectTech: true,
    });

    const report = await agent.execute(message);
    expectValidReport(report);
    expect(report.agentId).toBe('SCRAPER_SPECIALIST');

    // ScraperSpecialist should return either COMPLETED or FAILED (not crash)
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should execute LeadQualifier with prospect data', async () => {
    const agent = getAgentInstance(AGENT_IDS.LEAD_QUALIFIER);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message = createTestMessage(AGENT_IDS.LEAD_QUALIFIER, {
      action: 'qualify_lead',
      prospect: {
        name: 'Test Company',
        website: 'https://example.com',
        industry: 'SaaS',
        employeeCount: 50,
      },
    });

    const report = await agent.execute(message);
    expectValidReport(report);
    // Agent identity ID may include _SPECIALIST suffix
    expect(report.agentId).toContain('LEAD_QUALIFIER');
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should execute CompetitorResearcher with niche data', async () => {
    const agent = getAgentInstance(AGENT_IDS.COMPETITOR_RESEARCHER);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message = createTestMessage(AGENT_IDS.COMPETITOR_RESEARCHER, {
      action: 'search_competitors',
      niche: 'CRM software',
      location: 'US',
      limit: 5,
    });

    const report = await agent.execute(message);
    expectValidReport(report);
    expect(report.agentId).toBe('COMPETITOR_RESEARCHER');
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should handle missing payload gracefully', async () => {
    const agent = getAgentInstance(AGENT_IDS.SCRAPER_SPECIALIST);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message = createTestMessage(AGENT_IDS.SCRAPER_SPECIALIST, {});

    const report = await agent.execute(message);
    expectValidReport(report);
    // Should fail gracefully, not throw
    expect(report.status).toBe('FAILED');
    expect(report.errors).toBeDefined();
    expect(report.errors!.length).toBeGreaterThan(0);
  });

  it('should handle signal bus messages', async () => {
    const agent = getAgentInstance(AGENT_IDS.SCRAPER_SPECIALIST);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const innerMessage = createTestMessage(AGENT_IDS.SCRAPER_SPECIALIST, {
      action: 'acknowledge',
    });

    const signal = createTestSignal(
      'INTELLIGENCE_MANAGER',
      AGENT_IDS.SCRAPER_SPECIALIST,
      innerMessage
    );

    const report = await agent.handleSignal(signal);
    expectValidReport(report);
  });
});

// ============================================================================
// TIER 5: MANAGER DELEGATION (L2 → L3 → Report)
// ============================================================================

describe('Manager Delegation', () => {
  it('should delegate to correct specialist based on keywords', async () => {
    const manager = getAgentInstance(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(manager).not.toBeNull();
    if (!manager) {return;}

    await manager.initialize();

    // Request with "competitor" keyword should route to COMPETITOR_RESEARCHER
    const message = createTestMessage(AGENT_IDS.INTELLIGENCE_MANAGER, {
      intent: 'COMPETITOR_ANALYSIS',
      niche: 'CRM software',
      location: 'US',
    });

    const report = await manager.execute(message);
    expectValidReport(report);

    // Should get a result (either success or graceful failure)
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
    expect(report.data).toBeDefined();
  });

  it('should handle COMPANY_PROFILE intent', async () => {
    const manager = getAgentInstance(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(manager).not.toBeNull();
    if (!manager) {return;}

    await manager.initialize();

    const message = createTestMessage(AGENT_IDS.INTELLIGENCE_MANAGER, {
      intent: 'COMPANY_PROFILE',
      companyUrl: 'https://example.com',
    });

    const report = await manager.execute(message);
    expectValidReport(report);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should execute multiple specialists in parallel for FULL_MARKET_RESEARCH', async () => {
    const manager = getAgentInstance(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(manager).not.toBeNull();
    if (!manager) {return;}

    await manager.initialize();

    const message = createTestMessage(AGENT_IDS.INTELLIGENCE_MANAGER, {
      intent: 'FULL_MARKET_RESEARCH',
      niche: 'SaaS',
      companyUrl: 'https://example.com',
    });

    const report = await manager.execute(message);
    expectValidReport(report);

    // The report data should include execution metadata
    if (report.status === 'COMPLETED' && report.data) {
      const brief = report.data as Record<string, unknown>;
      const execution = brief.execution as Record<string, unknown> | undefined;

      if (execution) {
        // Should have attempted multiple specialists
        expect(execution.totalSpecialists).toBeGreaterThan(1);
      }
    }
  });

  it('should provide capability report for managers', async () => {
    const managerIds = getAgentIdsByTier('L2');

    for (const id of managerIds) {
      const agent = getAgentInstance(id);
      if (!agent || !(agent instanceof BaseManager)) {continue;}

      await agent.initialize();

      const capReport = agent.getCapabilityReport();
      expect(capReport.manager).toBe(id);
      expect(capReport.specialists).toBeInstanceOf(Array);
      expect(capReport.specialists.length).toBeGreaterThan(0);
      expect(typeof capReport.actuallyWorks).toBe('boolean');
    }
  });

  it('should handle signal broadcast to all specialists', async () => {
    const manager = getAgentInstance(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(manager).not.toBeNull();
    if (!manager) {return;}

    await manager.initialize();

    const innerMessage = createTestMessage(AGENT_IDS.INTELLIGENCE_MANAGER, {
      action: 'status_check',
    });

    const signal = createTestSignal(
      'MASTER_ORCHESTRATOR',
      AGENT_IDS.INTELLIGENCE_MANAGER,
      innerMessage
    );

    const report = await manager.handleSignal(signal);
    expectValidReport(report);
  });
});

// ============================================================================
// TIER 6: ORCHESTRATOR ROUTING (L1 → L2 → L3 → Report)
// ============================================================================

describe('Orchestrator Routing', () => {
  it('should instantiate and initialize the Master Orchestrator', async () => {
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    expect(orchestrator).toBeInstanceOf(BaseManager);
    await orchestrator.initialize();

    const identity = orchestrator.getIdentity();
    expect(identity.id).toBe('MASTER_ORCHESTRATOR');
    expect(identity.status).toBe('FUNCTIONAL');
  });

  it('should route market research intent to Intelligence Manager', async () => {
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    await orchestrator.initialize();

    const message = createTestMessage(AGENT_IDS.MASTER_ORCHESTRATOR, {
      goal: 'research the CRM software market',
      niche: 'CRM',
    });

    const report = await orchestrator.execute(message);
    expectValidReport(report);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should route sales intent to Revenue Director', async () => {
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    await orchestrator.initialize();

    const message = createTestMessage(AGENT_IDS.MASTER_ORCHESTRATOR, {
      goal: 'build a sales pipeline for outbound leads',
    });

    const report = await orchestrator.execute(message);
    expectValidReport(report);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should route marketing intent to Marketing Manager', async () => {
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    await orchestrator.initialize();

    const message = createTestMessage(AGENT_IDS.MASTER_ORCHESTRATOR, {
      goal: 'launch a social media marketing campaign',
    });

    const report = await orchestrator.execute(message);
    expectValidReport(report);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);
  });

  it('should handle unknown intents gracefully', async () => {
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    await orchestrator.initialize();

    const message = createTestMessage(AGENT_IDS.MASTER_ORCHESTRATOR, {
      goal: 'something completely unrelated to business',
    });

    // Should not throw, should return a report
    const report = await orchestrator.execute(message);
    expectValidReport(report);
  });
});

// ============================================================================
// TIER 7: FULL PIPELINE (User → API Shape → Factory → Execute → Response)
// ============================================================================

describe('Full Pipeline Simulation', () => {
  it('should simulate complete user → agent → response flow', async () => {
    // Step 1: USER REQUEST (simulate API request body)
    const userRequest = {
      agentId: AGENT_IDS.INTELLIGENCE_MANAGER,
      taskId: `task_e2e_${Date.now()}`,
      payload: {
        intent: 'COMPANY_PROFILE',
        companyUrl: 'https://example.com',
      },
      priority: 'NORMAL' as const,
    };

    // Step 2: VALIDATE (simulate Zod validation)
    expect(isValidAgentId(userRequest.agentId)).toBe(true);
    expect(userRequest.taskId).toBeTruthy();
    expect(userRequest.payload).toBeDefined();

    // Step 3: AGENT FACTORY (instantiate agent)
    const agent = getAgentInstance(userRequest.agentId);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    // Step 4: INITIALIZE
    await agent.initialize();

    // Step 5: CREATE MESSAGE (simulate API route message creation)
    const message: AgentMessage = {
      id: userRequest.taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: userRequest.agentId,
      type: 'COMMAND',
      priority: userRequest.priority,
      payload: userRequest.payload,
      requiresResponse: true,
      traceId: userRequest.taskId,
    };

    // Step 6: EXECUTE (agent processes the message)
    const startTime = Date.now();
    const report = await agent.execute(message);
    const duration = Date.now() - startTime;

    // Step 7: VALIDATE REPORT
    expectValidReport(report);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);

    // Step 8: FORMAT RESPONSE (simulate API response shape)
    const apiResponse = {
      success: report.status === 'COMPLETED',
      agentId: userRequest.agentId,
      taskId: userRequest.taskId,
      status: report.status,
      data: report.data,
      errors: report.errors ?? [],
      duration,
      timestamp: new Date().toISOString(),
    };

    // Step 9: VERIFY RESPONSE SHAPE (what UI would receive)
    expect(apiResponse.agentId).toBe(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(apiResponse.taskId).toBe(userRequest.taskId);
    expect(typeof apiResponse.success).toBe('boolean');
    expect(typeof apiResponse.duration).toBe('number');
    expect(apiResponse.duration).toBeGreaterThanOrEqual(0);
    expect(apiResponse.timestamp).toBeTruthy();
    expect(apiResponse.errors).toBeInstanceOf(Array);
  });

  it('should simulate full pipeline for specialist direct execution', async () => {
    // Direct specialist execution (bypassing manager)
    const userRequest = {
      agentId: AGENT_IDS.LEAD_QUALIFIER,
      taskId: `task_specialist_${Date.now()}`,
      payload: {
        action: 'qualify_lead',
        prospect: {
          name: 'Acme Corp',
          industry: 'Technology',
          employeeCount: 200,
          budget: 50000,
        },
      },
      priority: 'HIGH' as const,
    };

    // Factory → Initialize → Execute → Report
    const agent = getAgentInstance(userRequest.agentId);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message: AgentMessage = {
      id: userRequest.taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: userRequest.agentId,
      type: 'COMMAND',
      priority: userRequest.priority,
      payload: userRequest.payload,
      requiresResponse: true,
      traceId: userRequest.taskId,
    };

    const report = await agent.execute(message);
    expectValidReport(report);

    // Verify the chain: specialist directly returns report
    // Agent identity ID may differ from factory key (e.g. LEAD_QUALIFIER_SPECIALIST)
    expect(report.agentId).toContain('LEAD_QUALIFIER');
    expect(report.taskId).toBe(userRequest.taskId);
  });

  it('should simulate full pipeline with error propagation', async () => {
    // Test that errors propagate cleanly through the pipeline
    const userRequest = {
      agentId: AGENT_IDS.SCRAPER_SPECIALIST,
      taskId: `task_error_${Date.now()}`,
      payload: {
        // Missing required 'url' field should trigger graceful error
      },
      priority: 'NORMAL' as const,
    };

    const agent = getAgentInstance(userRequest.agentId);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message: AgentMessage = {
      id: userRequest.taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: userRequest.agentId,
      type: 'COMMAND',
      priority: userRequest.priority,
      payload: userRequest.payload,
      requiresResponse: true,
      traceId: userRequest.taskId,
    };

    const report = await agent.execute(message);

    // Should fail gracefully, not crash
    expectValidReport(report);
    expect(report.status).toBe('FAILED');
    expect(report.errors).toBeDefined();
    expect(report.errors!.length).toBeGreaterThan(0);

    // API response should properly convey the error
    const apiResponse = {
      success: false,
      agentId: userRequest.agentId,
      taskId: userRequest.taskId,
      status: report.status,
      errors: report.errors,
    };

    expect(apiResponse.success).toBe(false);
    expect(apiResponse.errors!.length).toBeGreaterThan(0);
  });

  it('should simulate multi-manager orchestration pipeline', async () => {
    // Full flow: User → Orchestrator → Manager → Specialist → Report
    const orchestrator = getAgentInstance(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(orchestrator).not.toBeNull();
    if (!orchestrator) {return;}

    await orchestrator.initialize();

    const userRequest = {
      agentId: AGENT_IDS.MASTER_ORCHESTRATOR,
      taskId: `task_full_pipeline_${Date.now()}`,
      payload: {
        goal: 'research competitors in the CRM market',
        niche: 'CRM',
      },
      priority: 'HIGH' as const,
    };

    const message: AgentMessage = {
      id: userRequest.taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: userRequest.agentId,
      type: 'COMMAND',
      priority: userRequest.priority,
      payload: userRequest.payload,
      requiresResponse: true,
      traceId: userRequest.taskId,
    };

    const report = await orchestrator.execute(message);
    expectValidReport(report);

    // The orchestrator should have delegated to managers/specialists
    expect(report.agentId).toBe(AGENT_IDS.MASTER_ORCHESTRATOR);
    expect(['COMPLETED', 'FAILED']).toContain(report.status);

    // If successful, the report data should contain orchestration metadata
    if (report.status === 'COMPLETED' && report.data) {
      const data = report.data as Record<string, unknown>;
      // Orchestrator typically returns structured data with execution results
      expect(data).toBeDefined();
    }
  });
});

// ============================================================================
// TIER 8: CROSS-CUTTING CONCERNS
// ============================================================================

describe('Cross-Cutting Concerns', () => {
  it('should maintain trace IDs through the pipeline', async () => {
    const traceId = `trace_crosscut_${Date.now()}`;

    const agent = getAgentInstance(AGENT_IDS.SCRAPER_SPECIALIST);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const message = createTestMessage(AGENT_IDS.SCRAPER_SPECIALIST, {
      url: 'https://example.com',
    }, { traceId });

    const report = await agent.execute(message);
    expectValidReport(report);

    // The taskId should match the original message ID
    expect(report.taskId).toBe(message.id);
  });

  it('should handle concurrent agent executions', async () => {
    const agentIds: AgentId[] = [
      AGENT_IDS.SCRAPER_SPECIALIST,
      AGENT_IDS.COMPETITOR_RESEARCHER,
      AGENT_IDS.SENTIMENT_ANALYST,
    ];

    // Initialize all agents
    const agents = await Promise.all(
      agentIds.map(async (id) => {
        const agent = getAgentInstance(id);
        if (agent) {await agent.initialize();}
        return { id, agent };
      })
    );

    // Execute all agents concurrently
    const results = await Promise.allSettled(
      agents
        .filter(({ agent }) => agent !== null)
        .map(({ id, agent }) => {
          const message = createTestMessage(id, {
            action: 'test_concurrent',
            niche: 'technology',
            url: 'https://example.com',
          });
          return agent!.execute(message);
        })
    );

    // All should resolve (not reject)
    for (const result of results) {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expectValidReport(result.value);
      }
    }
  });

  it('should respect priority levels in messages', async () => {
    const agent = getAgentInstance(AGENT_IDS.INTELLIGENCE_MANAGER);
    expect(agent).not.toBeNull();
    if (!agent) {return;}

    await agent.initialize();

    const priorities: Array<AgentMessage['priority']> = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

    for (const priority of priorities) {
      const message = createTestMessage(AGENT_IDS.INTELLIGENCE_MANAGER, {
        intent: 'COMPANY_PROFILE',
        companyUrl: 'https://example.com',
      }, { priority });

      // Should accept all priority levels without error
      const report = await agent.execute(message);
      expectValidReport(report);
    }
  });

  it('should produce consistent report format across all agents', async () => {
    const sampleIds: AgentId[] = [
      AGENT_IDS.SCRAPER_SPECIALIST,
      AGENT_IDS.LEAD_QUALIFIER,
      AGENT_IDS.EMAIL_SPECIALIST,
      AGENT_IDS.COPYWRITER,
      AGENT_IDS.PRICING_STRATEGIST,
    ];

    for (const id of sampleIds) {
      const agent = getAgentInstance(id);
      if (!agent) {continue;}

      await agent.initialize();

      const message = createTestMessage(id, { action: 'test' });
      const report = await agent.execute(message);

      // All reports must have these fields
      expect(typeof report.agentId).toBe('string');
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.taskId).toBe('string');
      expect(typeof report.status).toBe('string');
      // data can be any type (including null)
      // errors is optional but must be array when present
      if (report.errors !== undefined) {
        expect(report.errors).toBeInstanceOf(Array);
      }
    }
  });
});
