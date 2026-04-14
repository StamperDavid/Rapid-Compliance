/**
 * Workflow Optimizer Regression Executor
 *
 * One action: compose_workflow (full workflow composition with nodes,
 * execution pattern, parallelization + critical path analysis, duration,
 * risk mitigation, success criteria, and rationale).
 *
 * Invariant severity:
 *   - nodesCountWithinRange, riskMitigationCountWithinRange,
 *     uniqueNodeIds, everyNodeHasInputsOutputsDepends,
 *     totalDurationIsPositiveInteger, criticalPathReferencesNodeIds are FAIL.
 *   - contextEchoedInRationale is WARN.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { __internal as workflowInternal } from '@/lib/agents/builder/workflow/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'WORKFLOW_OPTIMIZER';
const MAX_TOKENS = 10000;

const ConstraintsSchema = z
  .object({
    maxDurationSeconds: z.number().int().positive().optional(),
    requiredAgents: z.array(z.string()).optional(),
    excludedAgents: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    maxParallelism: z.number().int().min(1).max(20).optional(),
  })
  .optional();

const ComposeWorkflowPayloadSchema = z.object({
  action: z.literal('compose_workflow'),
  industryKey: z.string().optional(),
  goal: z.string().min(1),
  context: z.string().optional(),
  constraints: ConstraintsSchema,
  availableAgents: z.array(z.string()).optional(),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(ComposeWorkflowPayloadSchema);

interface ParsedComposeWorkflow {
  action: 'compose_workflow';
  industryKey: string | undefined;
  goal: string;
  context: string | undefined;
  constraints: z.infer<typeof ConstraintsSchema>;
  availableAgents: string[] | undefined;
}

function parsePayload(raw: Record<string, unknown>): ParsedComposeWorkflow {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[workflow-optimizer-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = workflowInternal.ComposeWorkflowRequestSchema.safeParse({
    action: data.action,
    goal: data.goal,
    context: data.context,
    constraints: data.constraints,
    availableAgents: data.availableAgents,
  });
  if (!innerResult.success) {
    throw new Error(
      `[workflow-optimizer-executor] invalid compose_workflow input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'compose_workflow',
    industryKey: data.industryKey,
    goal: innerResult.data.goal,
    context: innerResult.data.context,
    constraints: innerResult.data.constraints,
    availableAgents: innerResult.data.availableAgents,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nodesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `nodes_count_between_${min}_and_${max}`,
    description: `nodes array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const nodes = parsed.nodes;
      if (!Array.isArray(nodes)) {return { passed: false, message: 'nodes not an array' };}
      const ok = nodes.length >= min && nodes.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `nodes.length=${nodes.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function riskMitigationCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `risk_mitigation_count_between_${min}_and_${max}`,
    description: `riskMitigation array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const risks = parsed.riskMitigation;
      if (!Array.isArray(risks)) {return { passed: false, message: 'riskMitigation not an array' };}
      const ok = risks.length >= min && risks.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `riskMitigation.length=${risks.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function uniqueNodeIds(): InvariantCheck {
  return {
    id: 'unique_node_ids',
    description: 'every node id must be unique within the workflow',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const nodesRaw: unknown = parsed.nodes;
      if (!Array.isArray(nodesRaw)) {return { passed: false, message: 'nodes not an array' };}
      const nodes = nodesRaw as unknown[];
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const node: unknown = nodes[i];
        if (!isObject(node)) {
          return { passed: false, message: `nodes[${i}] not an object` };
        }
        const id = node.id;
        if (typeof id !== 'string') {
          return { passed: false, message: `nodes[${i}].id not a string` };
        }
        if (seen.has(id)) {
          duplicates.push(id);
        } else {
          seen.add(id);
        }
      }
      if (duplicates.length > 0) {
        return { passed: false, message: `duplicate node ids: ${duplicates.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

function everyNodeHasInputsOutputsDepends(): InvariantCheck {
  return {
    id: 'every_node_has_prose_fields',
    description: 'every node must have non-empty inputsDescription, outputsDescription, dependsOnDescription',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const nodesRaw: unknown = parsed.nodes;
      if (!Array.isArray(nodesRaw)) {return { passed: false, message: 'nodes not an array' };}
      const nodes = nodesRaw as unknown[];
      for (let i = 0; i < nodes.length; i += 1) {
        const node: unknown = nodes[i];
        if (!isObject(node)) {
          return { passed: false, message: `nodes[${i}] not an object` };
        }
        const inputs = node.inputsDescription;
        const outputs = node.outputsDescription;
        const deps = node.dependsOnDescription;
        if (typeof inputs !== 'string' || inputs.length < 10) {
          return { passed: false, message: `nodes[${i}].inputsDescription missing or under 10 chars` };
        }
        if (typeof outputs !== 'string' || outputs.length < 10) {
          return { passed: false, message: `nodes[${i}].outputsDescription missing or under 10 chars` };
        }
        if (typeof deps !== 'string' || deps.length < 4) {
          return { passed: false, message: `nodes[${i}].dependsOnDescription missing or under 4 chars` };
        }
      }
      return { passed: true };
    },
  };
}

function totalDurationIsPositiveInteger(): InvariantCheck {
  return {
    id: 'total_duration_positive_integer',
    description: 'estimatedTotalDurationSeconds must be a positive integer',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const total = parsed.estimatedTotalDurationSeconds;
      if (typeof total !== 'number' || !Number.isInteger(total) || total <= 0) {
        return {
          passed: false,
          message: `estimatedTotalDurationSeconds=${String(total)} is not a positive integer`,
        };
      }
      return { passed: true };
    },
  };
}

function criticalPathReferencesNodeIds(): InvariantCheck {
  return {
    id: 'critical_path_references_node_ids',
    description: 'criticalPathDescription must reference at least one node id from the nodes array',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const path = parsed.criticalPathDescription;
      if (typeof path !== 'string') {return { passed: false, message: 'criticalPathDescription not a string' };}
      const nodesRaw: unknown = parsed.nodes;
      if (!Array.isArray(nodesRaw)) {return { passed: false, message: 'nodes not an array' };}
      const nodes = nodesRaw as unknown[];
      const ids: string[] = [];
      for (const node of nodes) {
        if (isObject(node) && typeof node.id === 'string') {
          ids.push(node.id);
        }
      }
      const found = ids.some((id) => path.includes(id));
      return {
        passed: found,
        message: found ? undefined : `criticalPathDescription does not reference any of [${ids.join(', ')}]`,
      };
    },
  };
}

function contextEchoedInRationale(phrases: string[]): InvariantCheck {
  const cleaned = phrases
    .flatMap((p) => p.split(/\s+/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 4);
  return {
    id: 'context_echoed_in_rationale',
    description: `at least one distinctive word from the brief should appear in rationale`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const rationale = parsed.rationale;
      if (typeof rationale !== 'string') {return { passed: false, message: 'rationale not a string' };}
      const lower = rationale.toLowerCase();
      const found = cleaned.some((w) => lower.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no distinctive brief word found in rationale`,
      };
    },
  };
}

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'workflow_optimizer_saas_content_engine':
      return [
        nodesCountWithinRange(3, 12),
        riskMitigationCountWithinRange(2, 5),
        uniqueNodeIds(),
        everyNodeHasInputsOutputsDepends(),
        totalDurationIsPositiveInteger(),
        criticalPathReferencesNodeIds(),
        contextEchoedInRationale(['SaaS', 'content', 'weekly', 'LinkedIn', 'TikTok']),
      ];
    case 'workflow_optimizer_realestate_lead_engine':
      return [
        nodesCountWithinRange(3, 12),
        riskMitigationCountWithinRange(2, 5),
        uniqueNodeIds(),
        everyNodeHasInputsOutputsDepends(),
        totalDurationIsPositiveInteger(),
        criticalPathReferencesNodeIds(),
        contextEchoedInRationale(['luxury', 'real estate', 'editorial', 'neighborhood', 'lead']),
      ];
    case 'workflow_optimizer_ecommerce_product_launch':
      return [
        nodesCountWithinRange(3, 12),
        riskMitigationCountWithinRange(2, 5),
        uniqueNodeIds(),
        everyNodeHasInputsOutputsDepends(),
        totalDurationIsPositiveInteger(),
        criticalPathReferencesNodeIds(),
        contextEchoedInRationale(['DTC', 'lifestyle', 'product', 'launch', 'mobile']),
      ];
    default:
      return [];
  }
}

export async function workflowOptimizerExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? workflowInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[workflow-optimizer-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[workflow-optimizer-executor] GM systemPrompt too short`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;

  const req: Parameters<typeof workflowInternal.buildComposeWorkflowUserPrompt>[0] = {
    action: 'compose_workflow',
    goal: parsed.goal,
    context: parsed.context,
    constraints: parsed.constraints,
    availableAgents: parsed.availableAgents,
  };
  const userPrompt = workflowInternal.buildComposeWorkflowUserPrompt(req);
  const schema: ZodTypeAny = workflowInternal.ComposeWorkflowResultSchema;
  const invariants = invariantsForCase(args.caseDoc);

  const capture = await captureSingleShot({
    modelId: args.modelId,
    systemPrompt: resolvedSystemPrompt,
    userMessage: userPrompt,
    temperature: REGRESSION_TEMPERATURE,
    maxTokens: MAX_TOKENS,
    schema,
    invariants,
    stripJsonFences: true,
  });

  return {
    signature: capture.signature,
    rawRequestBody: capture.rawRequestBody,
    rawResponseBody: capture.rawResponseBody,
  };
}
