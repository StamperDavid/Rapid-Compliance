/**
 * Command Dispatcher — wires JasperCommandAuthority's issueCommand to
 * actual manager execution.
 *
 * issueCommand sends a signal via the SignalBus, but no manager
 * subscribes to listen. This dispatcher bridges the gap: when a command
 * is issued, it instantiates the correct manager and calls execute()
 * with the command parameters mapped to the manager's expected payload.
 *
 * This is the same pattern used by the delegate_to_* tools in
 * jasper-tools.ts — instantiate manager, build message, call execute.
 *
 * Used by: JasperCommandAuthority.issueCommand (after storing the
 * command in history and writing to MemoryVault).
 *
 * @module orchestrator/command-dispatcher
 */

import { logger } from '@/lib/logger/logger';
import type { AgentMessage, AgentReport } from '@/lib/agents/types';

const MANAGER_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface CommandDispatchResult {
  success: boolean;
  managerReport?: AgentReport;
  error?: string;
}

/**
 * Map a command from JasperCommandAuthority to an actual manager
 * execution. Each command type maps to a specific manager + payload.
 *
 * Returns null if the command type is not recognized (the command
 * will still be recorded in history but won't trigger execution).
 */
export async function dispatchCommand(
  targetManager: string,
  command: string,
  parameters: Record<string, unknown>,
): Promise<CommandDispatchResult> {
  try {
    const message: AgentMessage = {
      id: `cmd_exec_${Date.now()}`,
      timestamp: new Date(),
      from: 'JASPER',
      to: targetManager,
      type: 'COMMAND',
      priority: 'HIGH',
      payload: {
        command,
        ...parameters,
      },
      requiresResponse: true,
      traceId: `trace_cmd_${Date.now()}`,
    };

    switch (targetManager) {
      case 'MARKETING_MANAGER': {
        const { MarketingManager } = await import('@/lib/agents/marketing/manager');
        const mgr = new MarketingManager();
        await mgr.initialize();

        const payload = buildMarketingPayload(command, parameters);
        message.payload = payload;

        const result = await withTimeout(
          mgr.execute(message),
          MANAGER_TIMEOUT_MS,
          `Marketing Manager (${command})`,
        );

        return { success: result.status === 'COMPLETED', managerReport: result };
      }

      case 'CONTENT_MANAGER': {
        const { ContentManager } = await import('@/lib/agents/content/manager');
        const mgr = new ContentManager();
        await mgr.initialize();

        const payload = buildContentPayload(command, parameters);
        message.payload = payload;

        const result = await withTimeout(
          mgr.execute(message),
          MANAGER_TIMEOUT_MS,
          `Content Manager (${command})`,
        );

        return { success: result.status === 'COMPLETED', managerReport: result };
      }

      case 'OUTREACH_MANAGER': {
        const { OutreachManager } = await import('@/lib/agents/outreach/manager');
        const mgr = new OutreachManager();
        await mgr.initialize();

        const payload = buildOutreachPayload(command, parameters);
        message.payload = payload;

        const result = await withTimeout(
          mgr.execute(message),
          MANAGER_TIMEOUT_MS,
          `Outreach Manager (${command})`,
        );

        return { success: result.status === 'COMPLETED', managerReport: result };
      }

      case 'INTELLIGENCE_MANAGER': {
        const { IntelligenceManager } = await import('@/lib/agents/intelligence/manager');
        const mgr = new IntelligenceManager();
        await mgr.initialize();

        const payload = buildIntelligencePayload(command, parameters);
        message.payload = payload;

        const result = await withTimeout(
          mgr.execute(message),
          MANAGER_TIMEOUT_MS,
          `Intelligence Manager (${command})`,
        );

        return { success: result.status === 'COMPLETED', managerReport: result };
      }

      default:
        logger.warn('[CommandDispatcher] Unknown target manager', {
          targetManager, command,
        });
        return {
          success: false,
          error: `No dispatcher configured for manager: ${targetManager}`,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[CommandDispatcher] Command execution failed',
      err instanceof Error ? err : undefined,
      { targetManager, command, error: errorMsg },
    );
    return { success: false, error: errorMsg };
  }
}

function buildMarketingPayload(
  command: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  switch (command) {
    case 'EXECUTE_SEO_STRATEGY':
      return {
        intent: 'SEO_REFRESH',
        topic: `SEO strategy execution — ${(parameters.actions as Array<{title: string}>)?.map(a => a.title).join(', ') ?? 'full SEO audit'}`,
        keywords: parameters.keywords,
        budget: parameters.budget,
        strategyId: parameters.strategyId,
        tier: parameters.tier,
      };
    case 'EXECUTE_SOCIAL_STRATEGY':
      return {
        intent: 'AWARENESS',
        topic: `Social media strategy execution — ${(parameters.actions as Array<{title: string}>)?.map(a => a.title).join(', ') ?? 'social campaign'}`,
        platforms: 'all',
        budget: parameters.budget,
        strategyId: parameters.strategyId,
        tier: parameters.tier,
      };
    case 'EXECUTE_PAID_STRATEGY':
      return {
        intent: 'LEAD_GENERATION',
        topic: `Paid advertising strategy — ${(parameters.actions as Array<{title: string}>)?.map(a => a.title).join(', ') ?? 'paid campaigns'}`,
        budget: parameters.budget,
        strategyId: parameters.strategyId,
        tier: parameters.tier,
      };
    default:
      return { command, ...parameters };
  }
}

function buildContentPayload(
  command: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  switch (command) {
    case 'EXECUTE_CONTENT_STRATEGY':
      return {
        contentType: 'blog_post',
        topic: `Content strategy execution — ${(parameters.actions as Array<{title: string}>)?.map(a => a.title).join(', ') ?? 'content production'}`,
        budget: parameters.budget,
        strategyId: parameters.strategyId,
        tier: parameters.tier,
      };
    default:
      return { command, ...parameters };
  }
}

function buildOutreachPayload(
  command: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  switch (command) {
    case 'EXECUTE_EMAIL_STRATEGY':
      return {
        channel: 'email',
        campaignName: `Email strategy — ${parameters.tier ?? 'standard'}`,
        actions: parameters.actions,
        budget: parameters.budget,
        strategyId: parameters.strategyId,
        tier: parameters.tier,
      };
    default:
      return { command, ...parameters };
  }
}

function buildIntelligencePayload(
  command: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  switch (command) {
    case 'EXECUTE_PARTNERSHIP_STRATEGY':
      return {
        researchType: 'partnerships',
        topic: `Partnership strategy — identify and reach out to potential partners`,
        actions: parameters.actions,
        strategyId: parameters.strategyId,
      };
    default:
      return { command, ...parameters };
  }
}
