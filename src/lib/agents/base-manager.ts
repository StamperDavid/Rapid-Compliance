// STATUS: FOUNDATION - Base class for all manager agents
// Managers coordinate specialists and handle delegation
// Phase 2: Manager Authority Upgrade — reviewOutput, mutations, cross-department requests

import type {
  AgentMessage,
  AgentReport,
  ManagerConfig,
  Signal,
  DelegationRule,
  AgentStatus
} from './types';
import { BaseSpecialist } from './base-specialist';
import { getMemoryVault, type MemoryEntry } from './shared/memory-vault';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { isManagerPaused } from '@/lib/orchestration/swarm-control';
import { recordExecution } from './shared/performance-tracker';
import { logger } from '@/lib/logger/logger';
import { getActiveManagerGMByIndustry } from '@/lib/training/manager-golden-master-service';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { ModelName } from '@/types/ai-models';

// ============================================================================
// TYPES FOR MANAGER AUTHORITY
// ============================================================================

/**
 * Review result from a Manager's quality gate
 */
export interface ReviewResult {
  approved: boolean;
  feedback: string[];
  severity: 'PASS' | 'MINOR' | 'MAJOR' | 'BLOCK';
  qualityScore: number; // 0-100, quality assessment of the specialist output
}

/**
 * A mutation directive read from MemoryVault
 */
export interface MutationDirective {
  type: string;
  targetDomain: string;
  parameters: Record<string, unknown>;
  reason: string;
  confidence: number;
  sourceAgent: string;
}

/**
 * Result of applying a mutation
 */
export interface MutationApplicationResult {
  mutationType: string;
  applied: boolean;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  error?: string;
}

/**
 * A cross-department request from one Manager to another
 */
export interface CrossDepartmentRequest {
  fromManager: string;
  toManager: string;
  requestType: string;
  description: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  payload: Record<string, unknown>;
  deadline?: Date;
}

// ============================================================================
// BASE MANAGER
// ============================================================================

export abstract class BaseManager extends BaseSpecialist {
  protected specialists: Map<string, BaseSpecialist> = new Map();
  protected delegationRules: DelegationRule[];
  protected managerConfig: ManagerConfig;

  /** Queue of incoming cross-department requests for next cycle */
  protected incomingRequests: CrossDepartmentRequest[] = [];

  /** Maximum retry count for quality gate failures */
  private static readonly MAX_REVIEW_RETRIES = 2;

  constructor(config: ManagerConfig) {
    super(config);
    this.managerConfig = config;
    this.delegationRules = config.delegationRules;
  }

  // ==========================================================================
  // SWARM CONTROL — Per-Manager Pause Check
  // ==========================================================================

  /**
   * Check if this manager is paused (either globally or individually).
   * Returns a BLOCKED report if paused, or null if execution should proceed.
   *
   * Concrete managers should call this at the start of their execute() method:
   * ```
   * const pauseReport = await this.checkManagerPaused(message.id);
   * if (pauseReport) { return pauseReport; }
   * ```
   */
  protected async checkManagerPaused(taskId: string): Promise<AgentReport | null> {
    const paused = await isManagerPaused(this.identity.id);
    if (paused) {
      this.log('WARN', `Execution blocked — manager ${this.identity.id} is paused`);
      return this.createReport(
        taskId,
        'BLOCKED',
        {
          reason: 'MANAGER_PAUSED',
          managerId: this.identity.id,
          message: `Manager ${this.identity.name} is paused via swarm control`,
        },
        [`Manager ${this.identity.id} is paused — execution blocked`]
      );
    }
    return null;
  }

  /**
   * Register a specialist under this manager
   */
  registerSpecialist(specialist: BaseSpecialist): void {
    const identity = specialist.getIdentity();
    this.specialists.set(identity.id, specialist);
    this.log('INFO', `Registered specialist: ${identity.name} (${identity.status})`);
  }

  /**
   * Get all registered specialists and their statuses
   */
  getSpecialistStatuses(): Array<{ id: string; name: string; status: AgentStatus }> {
    return Array.from(this.specialists.values()).map(s => {
      const identity = s.getIdentity();
      return { id: identity.id, name: identity.name, status: identity.status };
    });
  }

  /**
   * Count how many specialists are actually functional
   */
  getFunctionalSpecialistCount(): { total: number; functional: number; ghosts: number; shells: number } {
    const statuses = this.getSpecialistStatuses();
    return {
      total: statuses.length,
      functional: statuses.filter(s => s.status === 'FUNCTIONAL' || s.status === 'TESTED').length,
      ghosts: statuses.filter(s => s.status === 'GHOST').length,
      shells: statuses.filter(s => s.status === 'SHELL').length,
    };
  }

  /**
   * Determine which specialist should handle a message
   */
  protected findDelegationTarget(message: AgentMessage): string | null {
    const payloadStr = JSON.stringify(message.payload).toLowerCase();

    for (const rule of this.delegationRules.sort((a, b) => b.priority - a.priority)) {
      for (const keyword of rule.triggerKeywords) {
        if (payloadStr.includes(keyword.toLowerCase())) {
          return rule.delegateTo;
        }
      }
    }

    return null;
  }

  /**
   * Delegate a task to a specialist
   */
  protected async delegateToSpecialist(
    specialistId: string,
    message: AgentMessage
  ): Promise<AgentReport> {
    const specialist = this.specialists.get(specialistId);

    if (!specialist) {
      return this.createReport(
        message.id,
        'FAILED',
        null,
        [`Specialist ${specialistId} not registered`]
      );
    }

    if (specialist.isGhost()) {
      return this.createReport(
        message.id,
        'BLOCKED',
        { reason: 'SPECIALIST_NOT_BUILT' },
        [`Specialist ${specialistId} is a GHOST - not yet implemented`]
      );
    }

    if (specialist.isShell()) {
      return this.createReport(
        message.id,
        'BLOCKED',
        { reason: 'SPECIALIST_IS_SHELL' },
        [`Specialist ${specialistId} is a SHELL - has no real logic`]
      );
    }

    return specialist.execute(message);
  }

  /**
   * Broadcast a signal to all specialists
   */
  protected async broadcastToSpecialists(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    for (const [id, specialist] of this.specialists) {
      if (specialist.isFunctional()) {
        const report = await specialist.handleSignal(signal);
        reports.push(report);
      } else {
        reports.push(this.createReport(
          signal.id,
          'BLOCKED',
          { specialistId: id, reason: `Status: ${specialist.getStatus()}` }
        ));
      }
    }

    return reports;
  }

  /**
   * Get honest assessment of this manager's capabilities
   */
  getCapabilityReport(): {
    manager: string;
    status: AgentStatus;
    specialists: Array<{ id: string; status: AgentStatus; hasRealLogic: boolean }>;
    actuallyWorks: boolean;
    blockedBy: string[];
  } {
    const specialistReports = Array.from(this.specialists.values()).map(s => ({
      id: s.getIdentity().id,
      status: s.getStatus(),
      hasRealLogic: s.isFunctional() ? s.hasRealLogic() : false,
    }));

    const blockedBy = specialistReports
      .filter(s => s.status === 'GHOST' || s.status === 'SHELL')
      .map(s => s.id);

    return {
      manager: this.identity.id,
      status: this.identity.status,
      specialists: specialistReports,
      actuallyWorks: blockedBy.length === 0 && this.hasRealLogic(),
      blockedBy,
    };
  }

  // ==========================================================================
  // PHASE 2a: REVIEW BEFORE EXECUTE (Quality Gate)
  // ==========================================================================

  /** Default industry key used when loading a manager's Golden Master. */
  protected static readonly DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

  /** Per-report review cache so retries + escalation reuse the same LLM result. */
  private reviewResultCache: WeakMap<AgentReport, ReviewResult> = new WeakMap();

  /**
   * Review specialist output before it leaves the department.
   *
   * Loads the manager's Golden Master from Firestore and asks the LLM to
   * grade the specialist's output against the department-specific review
   * criteria in the GM's systemPrompt. Brand DNA is baked into that prompt
   * at seed time per the standing rule — no runtime merge.
   *
   * Caching: results are memoized per AgentReport object so the same report
   * is not re-reviewed across retries and the escalation record path. When
   * delegateWithReview passes the SAME report object into this method a
   * second time, we return the cached result without another LLM call.
   *
   * Failure modes:
   * - No GM seeded yet (Phase 1 before manager GMs exist) → safe pass-through
   *   (approved=true) so the system still works before Phase 2 seeds. Logged
   *   once per run so operators know the review gate is dormant.
   * - Corrupt GM (no usable systemPrompt) → safe pass-through with WARN log.
   * - LLM call throws → return BLOCK with the error in feedback. The retry
   *   loop will attempt 2 more times, then escalate to Jasper. A broken
   *   reviewer IS a production incident worth surfacing loudly.
   * - LLM response unparseable → BLOCK with raw content in feedback.
   */
  protected async reviewOutput(report: AgentReport): Promise<ReviewResult> {
    const cached = this.reviewResultCache.get(report);
    if (cached) { return cached; }

    const result = await this.performLlmReview(report);
    this.reviewResultCache.set(report, result);
    return result;
  }

  /**
   * Raw LLM review implementation. Separate from `reviewOutput` so the
   * caching layer can wrap a single method. Do not call directly — always
   * go through `reviewOutput` so retries don't double-bill the LLM.
   */
  private async performLlmReview(report: AgentReport): Promise<ReviewResult> {
    // 1. Load the manager's GM
    const gm = await getActiveManagerGMByIndustry(
      this.identity.id,
      BaseManager.DEFAULT_INDUSTRY_KEY,
    );

    if (!gm) {
      // No GM seeded yet — Phase 1 pass-through. This is expected until
      // Phase 2 of the manager rebuild seeds the 10 manager GMs.
      this.log(
        'INFO',
        `No active Manager GM for ${this.identity.id}:${BaseManager.DEFAULT_INDUSTRY_KEY} — review gate dormant (pass-through)`,
      );
      return { approved: true, feedback: [], severity: 'PASS', qualityScore: 100 };
    }

    // 2. Extract the review criteria prompt from the GM
    const config = gm.config as Partial<{
      systemPrompt: string;
      model: ModelName;
      temperature: number;
      maxTokens: number;
    }>;
    const reviewPrompt = config.systemPrompt ?? gm.systemPromptSnapshot ?? '';
    if (reviewPrompt.length < 100) {
      this.log(
        'WARN',
        `Manager GM ${gm.id} has no usable systemPrompt (length=${reviewPrompt.length}) — pass-through`,
      );
      return { approved: true, feedback: [], severity: 'PASS', qualityScore: 100 };
    }

    // 3. Build the user prompt containing the specialist output to review
    const userPrompt = this.buildReviewUserPrompt(report);

    // 4. Call OpenRouter
    try {
      const provider = new OpenRouterProvider(PLATFORM_ID);
      const response = await provider.chat({
        model: config.model ?? 'claude-sonnet-4.6',
        messages: [
          { role: 'system', content: reviewPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature ?? 0.3,
        maxTokens: config.maxTokens ?? 1500,
      });

      if (response.finishReason === 'length') {
        return {
          approved: false,
          feedback: [
            `Manager review truncated at maxTokens=${config.maxTokens ?? 1500}. Raise maxTokens in the GM or shorten the specialist output being reviewed.`,
          ],
          severity: 'BLOCK',
          qualityScore: 0,
        };
      }

      const raw = (response.content ?? '').trim();
      if (raw.length === 0) {
        return {
          approved: false,
          feedback: ['Manager review returned empty response'],
          severity: 'BLOCK',
          qualityScore: 0,
        };
      }

      return this.parseReviewResponse(raw);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Manager review LLM call failed: ${errMsg}`);
      return {
        approved: false,
        feedback: [`Manager review LLM error: ${errMsg}`],
        severity: 'BLOCK',
        qualityScore: 0,
      };
    }
  }

  /**
   * Build the user prompt for the review LLM call. Includes the specialist
   * identity, the task ID, the output data, and the instructions to return
   * a strict JSON review verdict.
   */
  private buildReviewUserPrompt(report: AgentReport): string {
    const dataBlock = (() => {
      try {
        return JSON.stringify(report.data, null, 2);
      } catch {
        return String(report.data);
      }
    })();

    const truncated = dataBlock.length > 12000
      ? `${dataBlock.slice(0, 12000)}\n...[truncated, ${dataBlock.length - 12000} more chars]`
      : dataBlock;

    return [
      'You are reviewing a specialist output from your department.',
      '',
      `SPECIALIST: ${report.agentId}`,
      `TASK ID: ${report.taskId}`,
      `STATUS: ${report.status}`,
      '',
      '--- SPECIALIST OUTPUT (JSON) ---',
      truncated,
      '--- END OUTPUT ---',
      '',
      'Grade this output against your review criteria in the system prompt above. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no prose outside the JSON:',
      '',
      '{',
      '  "approved": <boolean — true if the output meets the bar, false if it needs revision>,',
      '  "severity": "<PASS | MINOR | MAJOR | BLOCK — PASS on approval; MINOR for cosmetic issues; MAJOR for substantive gaps; BLOCK for Brand DNA violations or unsafe output>",',
      '  "qualityScore": <integer 0-100 — your overall confidence the output is shippable>,',
      '  "feedback": [<0-5 specific actionable feedback items as strings — empty array if approved; each item 10-500 chars and phrased as a direct instruction to the specialist for how to improve on retry>]',
      '}',
      '',
      'Hard rules:',
      '- approved must match severity: approved=true requires severity=PASS; approved=false requires severity in [MINOR, MAJOR, BLOCK].',
      '- feedback items must be ACTIONABLE instructions, not just descriptions of the problem. "Add specific platform names and time ranges" is actionable; "too vague" is not.',
      '- If the output clearly meets the bar, approve it with an empty feedback array. Do not invent minor nitpicks just to justify rejection.',
      '- If the output contains forbidden Brand DNA phrases or violates department rules, severity MUST be BLOCK.',
    ].join('\n');
  }

  /**
   * Parse the LLM review response into a ReviewResult. Strict validation on
   * severity, qualityScore, and feedback shape. Falls back to a BLOCK result
   * if parsing fails so a malformed review is never silently treated as PASS.
   */
  private parseReviewResponse(raw: string): ReviewResult {
    const stripped = raw
      .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
      .replace(/\n?\s*```[\s\S]*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      return {
        approved: false,
        feedback: [`Review response was not valid JSON: ${raw.slice(0, 300)}`],
        severity: 'BLOCK',
        qualityScore: 0,
      };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return {
        approved: false,
        feedback: ['Review response was not a JSON object'],
        severity: 'BLOCK',
        qualityScore: 0,
      };
    }

    const obj = parsed as Record<string, unknown>;
    const approved = obj.approved === true;
    const severityRaw = typeof obj.severity === 'string' ? obj.severity.toUpperCase() : '';
    const severity: ReviewResult['severity'] =
      severityRaw === 'PASS' || severityRaw === 'MINOR' || severityRaw === 'MAJOR' || severityRaw === 'BLOCK'
        ? severityRaw
        : 'BLOCK';
    const qualityScoreRaw = typeof obj.qualityScore === 'number' ? obj.qualityScore : 0;
    const qualityScore = Math.max(0, Math.min(100, Math.round(qualityScoreRaw)));
    const feedback = Array.isArray(obj.feedback)
      ? obj.feedback.filter((f): f is string => typeof f === 'string' && f.length > 0).slice(0, 5)
      : [];

    // Coherence check: approved=true requires severity=PASS
    if (approved && severity !== 'PASS') {
      return {
        approved: false,
        feedback: [`Review response is incoherent: approved=true but severity=${severity}. Treating as BLOCK.`],
        severity: 'BLOCK',
        qualityScore,
      };
    }

    return { approved, feedback, severity, qualityScore };
  }

  /**
   * Delegate to specialist with quality gate.
   * If output fails review → retry with feedback (max 2 retries).
   * If still failing → escalate to Jasper.
   */
  protected async delegateWithReview(
    specialistId: string,
    message: AgentMessage
  ): Promise<AgentReport> {
    let lastReport: AgentReport | null = null;
    let lastReview: ReviewResult | null = null;
    let retries = 0;
    const startTime = Date.now();

    while (retries <= BaseManager.MAX_REVIEW_RETRIES) {
      // If retrying, inject review feedback into the message
      const currentMessage: AgentMessage = retries === 0
        ? message
        : {
            ...message,
            id: `${message.id}_retry_${retries}`,
            payload: {
              ...(typeof message.payload === 'object' && message.payload !== null
                ? message.payload as Record<string, unknown>
                : {}),
              _reviewFeedback: lastReview?.feedback ?? [],
              _retryAttempt: retries,
            },
          };

      const report = await this.delegateToSpecialist(specialistId, currentMessage);

      // If specialist failed outright, record and return
      if (report.status === 'FAILED' || report.status === 'BLOCKED') {
        this.recordPerformanceEntry(
          report,
          { approved: false, feedback: ['Specialist failed outright'], severity: 'BLOCK', qualityScore: 0 },
          retries,
          startTime,
          report.status === 'FAILED' ? 'outright_failure' : 'blocked',
        );
        return report;
      }

      // Run quality gate (cached per report — safe to call multiple times)
      const review = await this.reviewOutput(report);

      if (review.approved) {
        this.recordPerformanceEntry(report, review, retries, startTime);
        return report;
      }

      this.log(
        'WARN',
        `Quality gate ${review.severity}: ${review.feedback.join(', ')} (attempt ${retries + 1})`,
      );
      lastReport = report;
      lastReview = review;
      retries++;
    }

    // Max retries exhausted — escalate to Jasper
    this.log('WARN', `Escalating to Jasper after ${BaseManager.MAX_REVIEW_RETRIES} failed reviews`);

    if (lastReport && lastReview) {
      this.recordPerformanceEntry(lastReport, lastReview, retries, startTime, 'quality_gate_escalation');
    }

    const escalationFeedback = lastReview?.feedback ?? [];
    const escalationReport = this.createReport(
      message.id,
      'BLOCKED',
      {
        reason: 'QUALITY_GATE_ESCALATION',
        specialistId,
        lastReviewFeedback: escalationFeedback,
        requiresHumanReview: true,
      },
      ['Output failed quality review after maximum retries — escalated to Jasper'],
    );

    // Write escalation to MemoryVault for Jasper to pick up
    try {
      const vault = getMemoryVault();
      vault.write(
        'CROSS_AGENT',
        `escalation_${message.id}`,
        {
          fromAgent: this.identity.id,
          toAgent: 'JASPER',
          messageType: 'NOTIFICATION' as const,
          subject: `Quality gate escalation from ${this.identity.name}`,
          body: {
            specialistId,
            originalTask: message.payload,
            reviewFeedback: escalationFeedback,
            retryCount: BaseManager.MAX_REVIEW_RETRIES,
          },
          requiresResponse: true,
          responded: false,
        },
        this.identity.id,
        { priority: 'HIGH', tags: ['escalation', 'quality-gate'] },
      );
    } catch (error) {
      this.log(
        'ERROR',
        `Failed to write escalation to MemoryVault: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return escalationReport;
  }

  /**
   * Record a performance entry for a specialist execution.
   * Non-blocking — failures are logged but never propagated.
   */
  private recordPerformanceEntry(
    report: AgentReport,
    review: ReviewResult,
    retryCount: number,
    startTime: number,
    failureMode?: string
  ): void {
    recordExecution(report, review, {
      agentType: 'swarm_specialist',
      responseTimeMs: Date.now() - startTime,
      retryCount,
      failureMode,
    }).catch((error: unknown) => {
      logger.warn('[BaseManager] Failed to record performance entry', {
        agentId: report.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // ==========================================================================
  // PHASE 2b: READ AND APPLY MUTATIONS
  // ==========================================================================

  /**
   * Get the mutation types this Manager is responsible for.
   * Override in concrete Managers to declare which mutation directives they handle.
   *
   * Example overrides:
   * - Marketing: ['CONTENT_MIX_SHIFT', 'TONE_ADJUSTMENT', 'POSTING_CADENCE', 'FORMAT_PIVOT', 'HASHTAG_STRATEGY', 'TOPIC_KILL']
   * - Outreach: ['EMAIL_SUBJECT_STRATEGY', 'SEND_TIME_OPTIMIZATION', 'CHANNEL_PREFERENCE']
   * - Revenue: ['QUALIFICATION_THRESHOLD', 'OUTREACH_FRAMEWORK_PREFERENCE']
   */
  protected getManagedMutationTypes(): string[] {
    return [];
  }

  /**
   * Apply a single mutation directive to specialist parameters.
   * Override in concrete Managers to implement domain-specific mutation logic.
   *
   * Default implementation logs and returns unapplied.
   */
  protected applyMutation(_directive: MutationDirective): MutationApplicationResult {
    return {
      mutationType: _directive.type,
      applied: false,
      beforeState: {},
      afterState: {},
      error: 'No mutation handler implemented for this manager',
    };
  }

  /**
   * Read pending mutation directives from MemoryVault and apply them.
   * Called at the start of each operations cycle.
   *
   * Mutations are applied to specialist parameters (content mix ratios,
   * cadence settings, etc.), NOT to LLM system prompts.
   *
   * All mutations are logged with before/after states for auditability.
   */
  async readAndApplyMutations(): Promise<MutationApplicationResult[]> {
    const managedTypes = this.getManagedMutationTypes();
    if (managedTypes.length === 0) {
      return [];
    }

    const results: MutationApplicationResult[] = [];

    try {
      const vault = getMemoryVault();

      // Query for mutation directives tagged for this manager's domain
      const entries = await vault.query(this.identity.id, {
        category: 'STRATEGY',
        tags: ['mutation-directive'],
        sortBy: 'priority',
        sortOrder: 'desc',
      });

      // Filter to only mutations this manager handles
      const relevantMutations = entries.filter(entry => {
        const value = entry.value as Record<string, unknown>;
        const mutationType = value.type as string | undefined;
        return mutationType && managedTypes.includes(mutationType);
      });

      if (relevantMutations.length === 0) {
        this.log('INFO', 'No pending mutations found');
        return [];
      }

      this.log('INFO', `Found ${relevantMutations.length} pending mutations`);

      for (const entry of relevantMutations) {
        const value = entry.value as Record<string, unknown>;
        const directive: MutationDirective = {
          type: String(value.type ?? ''),
          targetDomain: String(value.targetDomain ?? this.identity.id),
          parameters: (value.parameters as Record<string, unknown>) ?? {},
          reason: String(value.reason ?? ''),
          confidence: Number(value.confidence ?? 0),
          sourceAgent: String(value.sourceAgent ?? entry.createdBy),
        };

        // Apply the mutation
        const result = this.applyMutation(directive);
        results.push(result);

        // Log the mutation application to MemoryVault for auditability
        vault.write(
          'WORKFLOW',
          `mutation_log_${entry.id}_${Date.now()}`,
          {
            mutationType: directive.type,
            managerId: this.identity.id,
            applied: result.applied,
            beforeState: result.beforeState,
            afterState: result.afterState,
            error: result.error,
            sourceDirectiveId: entry.id,
            appliedAt: new Date().toISOString(),
          },
          this.identity.id,
          { priority: 'MEDIUM', tags: ['mutation-log', directive.type.toLowerCase()] }
        );

        // Mark the original directive as processed
        this.markMutationProcessed(entry);
      }

      this.log('INFO', `Applied ${results.filter(r => r.applied).length}/${results.length} mutations`);
    } catch (error) {
      this.log('ERROR', `Failed to read/apply mutations: ${error instanceof Error ? error.message : String(error)}`);
    }

    return results;
  }

  /**
   * Mark a mutation directive as processed in MemoryVault
   */
  private markMutationProcessed(entry: MemoryEntry): void {
    try {
      const vault = getMemoryVault();
      const currentValue = entry.value as Record<string, unknown>;
      vault.write(
        entry.category,
        entry.key,
        {
          ...currentValue,
          processed: true,
          processedBy: this.identity.id,
          processedAt: new Date().toISOString(),
        },
        this.identity.id,
        { tags: [...entry.tags, 'processed'] }
      );
    } catch (error) {
      this.log('ERROR', `Failed to mark mutation as processed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ==========================================================================
  // PHASE 2c: CROSS-DEPARTMENT REQUEST PROTOCOL
  // ==========================================================================

  /**
   * Send a structured request to another Manager via SignalBus DIRECT signal.
   *
   * The receiving Manager picks this up in its next cycle and adds it to its
   * incomingRequests queue.
   *
   * Examples:
   * - Revenue Director → Content Manager: "Generate a proposal deck for prospect X"
   * - Marketing Manager → Content Manager: "Produce 3 social posts about trending topic Y"
   * - Reputation Manager → Marketing Manager: "Distribute this 5-star review as social proof"
   */
  protected async requestFromManager(
    request: CrossDepartmentRequest
  ): Promise<{ sent: boolean; signalId?: string; error?: string }> {
    try {
      const signalBus = getSignalBus();

      const message: AgentMessage = {
        id: `xdept_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        from: this.identity.id,
        to: request.toManager,
        type: 'COMMAND',
        priority: request.urgency,
        payload: {
          requestType: request.requestType,
          description: request.description,
          fromManager: request.fromManager,
          deadline: request.deadline?.toISOString(),
          ...request.payload,
        },
        requiresResponse: false,
        traceId: `xdept_trace_${Date.now()}`,
      };

      const signal = signalBus.createSignal(
        'DIRECT',
        this.identity.id,
        request.toManager,
        message
      );

      await signalBus.send(signal);

      // Also persist to MemoryVault for audit trail and async pickup
      const vault = getMemoryVault();
      vault.write(
        'CROSS_AGENT',
        `xdept_${signal.id}`,
        {
          fromAgent: request.fromManager,
          toAgent: request.toManager,
          messageType: 'REQUEST' as const,
          subject: request.requestType,
          body: request.payload,
          requiresResponse: true,
          responded: false,
          responseDeadline: request.deadline,
        },
        this.identity.id,
        {
          priority: request.urgency === 'CRITICAL' ? 'CRITICAL' : request.urgency === 'HIGH' ? 'HIGH' : 'MEDIUM',
          tags: ['cross-department', request.requestType.toLowerCase()],
        }
      );

      this.log('INFO', `Cross-department request sent: ${request.requestType} → ${request.toManager}`);

      return { sent: true, signalId: signal.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Failed to send cross-department request: ${errorMsg}`);
      return { sent: false, error: errorMsg };
    }
  }

  /**
   * Read incoming cross-department requests from MemoryVault.
   * Called at the start of each operations cycle.
   */
  async readIncomingRequests(): Promise<CrossDepartmentRequest[]> {
    try {
      const vault = getMemoryVault();
      const messages = await vault.getMessagesForAgent(this.identity.id, {
        unrespondedOnly: true,
      });

      const requests: CrossDepartmentRequest[] = messages
        .filter(m => m.value.messageType === 'REQUEST')
        .map(m => ({
          fromManager: m.value.fromAgent,
          toManager: m.value.toAgent,
          requestType: m.value.subject,
          description: String(m.value.body.description ?? m.value.subject),
          urgency: this.mapPriorityToUrgency(m.priority),
          payload: m.value.body,
          deadline: m.value.responseDeadline ? new Date(String(m.value.responseDeadline)) : undefined,
        }));

      this.incomingRequests = requests;

      if (requests.length > 0) {
        this.log('INFO', `Received ${requests.length} cross-department requests`);
      }

      return requests;
    } catch (error) {
      this.log('ERROR', `Failed to read incoming requests: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Map MemoryPriority to urgency level
   */
  private mapPriorityToUrgency(priority: string): CrossDepartmentRequest['urgency'] {
    switch (priority) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'HIGH';
      case 'LOW': return 'LOW';
      default: return 'NORMAL';
    }
  }

  /**
   * Get the current count of pending incoming requests
   */
  getIncomingRequestCount(): number {
    return this.incomingRequests.length;
  }
}
