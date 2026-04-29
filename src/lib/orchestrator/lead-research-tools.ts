/**
 * Lead Research Tools — 8-tool subset for the Lead Research chat endpoint.
 *
 * Reuses 6 existing tools from jasper-tools.ts + 1 new tool
 * (update_icp_profile).
 */

import type { ToolDefinition, ToolCall } from '@/lib/ai/openrouter-provider';
import { JASPER_TOOLS, executeToolCalls as executeJasperToolCalls, type ToolCallContext, type ToolResult } from './jasper-tools';
import { updateIcpProfile, getActiveIcpProfile } from '@/lib/services/icp-profile-service';
import { logger } from '@/lib/logger/logger';
import type { SeniorityLevel } from '@/types/icp-profile';

// Tool names to pull from Jasper's full tool set
const REUSED_TOOL_NAMES = [
  'scan_leads',
  'enrich_lead',
  'score_leads',
  'scrape_website',
  'research_competitors',
  'scan_tech_stack',
] as const;

// ── New tool definitions ──────────────────────────────────────────────────

const updateIcpProfileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_icp_profile',
    description:
      'Create or update the active ICP (Ideal Customer Profile) based on criteria parsed from the user\'s natural language request. Updates industries, company size, locations, tech stack, funding stages, titles, seniority, and scoring weights.',
    parameters: {
      type: 'object',
      properties: {
        targetIndustries: {
          type: 'string',
          description: 'JSON array of target industry strings, e.g. ["SaaS", "Fintech"]',
        },
        excludedIndustries: {
          type: 'string',
          description: 'JSON array of excluded industry strings',
        },
        companySizeMin: {
          type: 'string',
          description: 'Minimum employee count',
        },
        companySizeMax: {
          type: 'string',
          description: 'Maximum employee count',
        },
        preferredLocations: {
          type: 'string',
          description: 'JSON array of preferred location strings, e.g. ["Austin, TX", "San Francisco, CA"]',
        },
        preferredTechStack: {
          type: 'string',
          description: 'JSON array of preferred technologies, e.g. ["React", "Stripe"]',
        },
        preferredFundingStages: {
          type: 'string',
          description: 'JSON array of funding stages, e.g. ["seed", "series-a"]',
        },
        targetTitles: {
          type: 'string',
          description: 'JSON array of target job titles, e.g. ["CTO", "VP Engineering"]',
        },
        targetSeniority: {
          type: 'string',
          description: 'JSON array of seniority levels: "c-level", "vp", "director", "manager", "individual"',
        },
        profileName: {
          type: 'string',
          description: 'Name for the ICP profile (required when creating new)',
        },
      },
      required: [],
    },
  },
};

// ── Build tool array ──────────────────────────────────────────────────────

function buildLeadResearchTools(): ToolDefinition[] {
  const reused = JASPER_TOOLS.filter(t =>
    REUSED_TOOL_NAMES.includes(t.function.name as typeof REUSED_TOOL_NAMES[number])
  );
  return [...reused, updateIcpProfileTool];
}

export const LEAD_RESEARCH_TOOLS: ToolDefinition[] = buildLeadResearchTools();

// ── Tool execution ──────────────────────────────────────────────────────

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') { return fallback; }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function executeLeadResearchToolCalls(
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
      // ── New tools ─────────────────────────────────────────────────────

      case 'update_icp_profile': {
        try {
          const activeProfile = await getActiveIcpProfile();
          const updates: Record<string, unknown> = {};

          if (args.targetIndustries) { updates.targetIndustries = safeJsonParse<string[]>(args.targetIndustries, []); }
          if (args.excludedIndustries) { updates.excludedIndustries = safeJsonParse<string[]>(args.excludedIndustries, []); }
          if (args.preferredLocations) { updates.preferredLocations = safeJsonParse<string[]>(args.preferredLocations, []); }
          if (args.preferredTechStack) { updates.preferredTechStack = safeJsonParse<string[]>(args.preferredTechStack, []); }
          if (args.preferredFundingStages) { updates.preferredFundingStages = safeJsonParse<string[]>(args.preferredFundingStages, []); }
          if (args.targetTitles) { updates.targetTitles = safeJsonParse<string[]>(args.targetTitles, []); }
          if (args.targetSeniority) { updates.targetSeniority = safeJsonParse<SeniorityLevel[]>(args.targetSeniority, []); }
          if (args.companySizeMin || args.companySizeMax) {
            updates.companySizeRange = {
              min: args.companySizeMin ? Number(args.companySizeMin) : (activeProfile?.companySizeRange?.min ?? 1),
              max: args.companySizeMax ? Number(args.companySizeMax) : (activeProfile?.companySizeRange?.max ?? 10000),
            };
          }

          if (activeProfile) {
            const updated = await updateIcpProfile(activeProfile.id, updates);
            content = JSON.stringify({
              status: 'updated',
              profileId: updated.id,
              profileName: updated.name,
              message: `ICP profile "${updated.name}" updated successfully.`,
            });
          } else {
            // Create new profile via the ICP service
            const { createIcpProfile } = await import('@/lib/services/icp-profile-service');
            const profileName = (args.profileName as string) || 'AI-Generated Profile';
            const created = await createIcpProfile({
              name: profileName,
              isActive: true,
              targetIndustries: safeJsonParse<string[]>(args.targetIndustries, []),
              excludedIndustries: safeJsonParse<string[]>(args.excludedIndustries, []),
              companySizeRange: {
                min: args.companySizeMin ? Number(args.companySizeMin) : 1,
                max: args.companySizeMax ? Number(args.companySizeMax) : 10000,
              },
              preferredLocations: safeJsonParse<string[]>(args.preferredLocations, []),
              preferredTechStack: safeJsonParse<string[]>(args.preferredTechStack, []),
              preferredFundingStages: safeJsonParse<string[]>(args.preferredFundingStages, []),
              targetTitles: safeJsonParse<string[]>(args.targetTitles, []),
              targetDepartments: [],
              targetSeniority: safeJsonParse<SeniorityLevel[]>(args.targetSeniority, []),
              weights: {
                industry: 5, companySize: 5, location: 3,
                techStack: 3, fundingStage: 2, title: 4, seniority: 4,
              },
              exampleCompanies: [],
              feedbackStats: { positiveCount: 0, negativeCount: 0 },
              createdBy: context?.userId ?? 'system',
            });
            content = JSON.stringify({
              status: 'created',
              profileId: created.id,
              profileName: created.name,
              message: `New ICP profile "${created.name}" created and set as active.`,
            });
          }
        } catch (err: unknown) {
          logger.error('update_icp_profile tool failed', err instanceof Error ? err : new Error(String(err)));
          content = JSON.stringify({ status: 'error', message: 'Failed to update ICP profile' });
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
