/**
 * Intelligence Discovery Tools — Tool subset for the Discovery Hub chat.
 *
 * Reuses 3 tools from JASPER_TOOLS (scrape_website, research_competitors,
 * scan_tech_stack) and adds 4 discovery-specific tools.
 *
 * @module orchestrator/intelligence-discovery-tools
 */

import type { ToolDefinition, ToolCall } from '@/lib/ai/openrouter-provider';
import {
  JASPER_TOOLS,
  executeToolCalls as executeJasperToolCalls,
  type ToolCallContext,
  type ToolResult,
} from './jasper-tools';
import {
  createOperation,
  getOperation,
  listFindings,
  logAction,
} from '@/lib/intelligence/discovery-service';
import {
  getSource,
  listSources,
  createSourceFromTemplate,
  getSourceTemplates,
} from '@/lib/intelligence/discovery-source-service';
import { logger } from '@/lib/logger/logger';

// ── Reused tools from Jasper ────────────────────────────────────────────────

const REUSED_TOOL_NAMES = [
  'scrape_website',
  'research_competitors',
  'scan_tech_stack',
] as const;

// ── New discovery-specific tools ────────────────────────────────────────────

const listSourcesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_discovery_sources',
    description:
      'List all configured discovery sources and available templates. Returns active sources and one-click templates (FMCSA, State Filings, SAM.gov, etc.).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

const configureSourceTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'configure_source',
    description:
      'Create a new discovery source from a template. Available templates: "tpl-fmcsa-new-dot" (FMCSA New DOT Numbers), "tpl-state-business-filings" (State Business Filings), "tpl-sam-gov" (SAM.gov Registrations). You can also provide a custom baseUrl override.',
    parameters: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'Template ID to create from (e.g. "tpl-fmcsa-new-dot")',
        },
        name: {
          type: 'string',
          description: 'Optional custom name override for the source',
        },
        baseUrl: {
          type: 'string',
          description: 'Optional custom base URL override',
        },
      },
      required: ['templateId'],
    },
  },
};

const startOperationTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'start_operation',
    description:
      'Start a new scraping operation against a configured discovery source. Returns the operation ID for tracking.',
    parameters: {
      type: 'object',
      properties: {
        sourceId: {
          type: 'string',
          description: 'The ID of the discovery source to scrape',
        },
      },
      required: ['sourceId'],
    },
  },
};

const getOperationStatusTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_operation_status',
    description:
      'Get the current status and statistics of a discovery operation including total found, enriched, failed counts.',
    parameters: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'The operation ID to check',
        },
      },
      required: ['operationId'],
    },
  },
};

const getFindingsSummaryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_findings_summary',
    description:
      'Get a summary of findings for an operation — top entities found, enrichment progress, contact info completeness.',
    parameters: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'The operation ID to get findings for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of findings to return (default 10)',
        },
      },
      required: ['operationId'],
    },
  },
};

// ── Build tool array ────────────────────────────────────────────────────────

function buildDiscoveryTools(): ToolDefinition[] {
  const reused = JASPER_TOOLS.filter((t) =>
    REUSED_TOOL_NAMES.includes(t.function.name as (typeof REUSED_TOOL_NAMES)[number])
  );
  return [
    ...reused,
    listSourcesTool,
    configureSourceTool,
    startOperationTool,
    getOperationStatusTool,
    getFindingsSummaryTool,
  ];
}

export const INTELLIGENCE_DISCOVERY_TOOLS: ToolDefinition[] = buildDiscoveryTools();

// ── Tool execution ──────────────────────────────────────────────────────────

export async function executeDiscoveryToolCalls(
  toolCalls: ToolCall[],
  context?: ToolCallContext & { userId?: string }
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const tc of toolCalls) {
    const args: Record<string, unknown> = tc.function.arguments
      ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
      : {};

    let content: string;

    switch (tc.function.name) {
      // ── Discovery-specific tools ────────────────────────────────────────

      case 'list_discovery_sources': {
        try {
          const sources = await listSources();
          const templates = getSourceTemplates();
          content = JSON.stringify({
            status: 'success',
            sources: sources.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              sourceType: s.sourceType,
              status: s.status,
              scheduleEnabled: s.schedule.enabled,
              scheduleFrequency: s.schedule.frequency,
            })),
            templates: templates.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
            })),
          });
        } catch (err: unknown) {
          logger.error('list_discovery_sources failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to list sources' });
        }
        results.push({ tool_call_id: tc.id, role: 'tool', content });
        break;
      }

      case 'configure_source': {
        try {
          const templateId = args.templateId as string;
          const userId = context?.userId ?? 'system';
          const overrides: Record<string, unknown> = {};
          if (args.name) { overrides.name = args.name; }
          if (args.baseUrl) { overrides.baseUrl = args.baseUrl; }

          const source = await createSourceFromTemplate(templateId, userId, overrides);
          if (!source) {
            content = JSON.stringify({
              status: 'error',
              message: `Template "${templateId}" not found. Available templates: tpl-fmcsa-new-dot, tpl-state-business-filings, tpl-sam-gov`,
            });
          } else {
            content = JSON.stringify({
              status: 'created',
              sourceId: source.id,
              name: source.name,
              message: `Source "${source.name}" created from template. Ready to start scraping.`,
            });
          }
        } catch (err: unknown) {
          logger.error('configure_source failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to configure source' });
        }
        results.push({ tool_call_id: tc.id, role: 'tool', content });
        break;
      }

      case 'start_operation': {
        try {
          const sourceId = args.sourceId as string;
          const source = await getSource(sourceId);
          if (!source) {
            content = JSON.stringify({ status: 'error', message: `Source "${sourceId}" not found` });
          } else {
            const userId = context?.userId ?? 'system';
            const operation = await createOperation({
              sourceId: source.id,
              sourceName: source.name,
              triggeredBy: 'jasper',
              config: {
                maxRecords: source.maxRecordsPerRun,
                enrichmentDepth: source.enrichmentDepth,
                enableMultiHop: true,
                secondarySources: source.enrichmentHints,
              },
              createdBy: userId,
            });

            await logAction({
              operationId: operation.id,
              actionType: 'scrape',
              sourceUrl: source.baseUrl,
              status: 'running',
              data: { summary: `Operation started for ${source.name}` },
            });

            content = JSON.stringify({
              status: 'started',
              operationId: operation.id,
              sourceName: source.name,
              message: `Operation started for "${source.name}". Scraping ${source.baseUrl}. Track progress in the Operation Log.`,
            });
          }
        } catch (err: unknown) {
          logger.error('start_operation failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to start operation' });
        }
        results.push({ tool_call_id: tc.id, role: 'tool', content });
        break;
      }

      case 'get_operation_status': {
        try {
          const operationId = args.operationId as string;
          const operation = await getOperation(operationId);
          if (!operation) {
            content = JSON.stringify({ status: 'error', message: `Operation "${operationId}" not found` });
          } else {
            content = JSON.stringify({
              status: 'success',
              operation: {
                id: operation.id,
                sourceName: operation.sourceName,
                status: operation.status,
                stats: operation.stats,
                startedAt: operation.startedAt,
                completedAt: operation.completedAt,
                error: operation.error,
              },
            });
          }
        } catch (err: unknown) {
          logger.error('get_operation_status failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to get operation status' });
        }
        results.push({ tool_call_id: tc.id, role: 'tool', content });
        break;
      }

      case 'get_findings_summary': {
        try {
          const operationId = args.operationId as string;
          const limit = typeof args.limit === 'number' ? args.limit : 10;
          const { findings, hasMore } = await listFindings({
            operationId,
            limit,
          });

          const summary = findings.map((f) => ({
            id: f.id,
            entityName: f.seedData.company_name ?? f.seedData.business_name ?? f.seedData.entity_name ?? 'Unknown',
            address: f.seedData.physical_address ?? f.seedData.principal_address ?? '',
            owner: f.seedData.owner_name ?? f.seedData.officer_name ?? '',
            enrichmentStatus: f.enrichmentStatus,
            hasPhone: f.enrichedData.phones.length > 0,
            hasEmail: f.enrichedData.emails.length > 0,
            hasSocial: Object.keys(f.enrichedData.socialMedia).length > 0,
            confidence: f.overallConfidence,
            approvalStatus: f.approvalStatus,
          }));

          content = JSON.stringify({
            status: 'success',
            totalReturned: findings.length,
            hasMore,
            findings: summary,
          });
        } catch (err: unknown) {
          logger.error('get_findings_summary failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to get findings summary' });
        }
        results.push({ tool_call_id: tc.id, role: 'tool', content });
        break;
      }

      // ── Reused tools — delegate to Jasper's executor ──────────────────

      default: {
        const delegated = await executeJasperToolCalls([tc], context);
        results.push(...delegated);
        break;
      }
    }
  }

  return results;
}
