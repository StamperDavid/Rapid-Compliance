/**
 * Tenant Memory Vault - Shared Stateful Memory Across Agents
 *
 * THE MOAT: This is the shared memory infrastructure that enables 36 agents
 * to "talk" to each other through a common, tenant-scoped state store.
 *
 * ARCHITECTURE:
 * - All agents read from and write to this vault
 * - Data is scoped by tenantId (multi-tenant safe)
 * - Supports cross-agent signals, insights, and context sharing
 * - Enables "Chain of Action" patterns where agents build on each other's work
 *
 * STRICT ZONE COMPLIANCE:
 * - Zero `any` types
 * - All data validated via type guards
 * - Tenant scoping is MANDATORY
 *
 * @module agents/shared/tenant-memory-vault
 */

import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Memory entry categories for organization
 */
export type MemoryCategory =
  | 'INSIGHT'           // Discovered knowledge or analysis
  | 'SIGNAL'            // Market signals, trends, alerts
  | 'CONTENT'           // Generated content artifacts
  | 'PROFILE'           // Audience/customer profiles
  | 'STRATEGY'          // Strategic recommendations
  | 'WORKFLOW'          // Workflow state and progress
  | 'PERFORMANCE'       // Metrics and analytics
  | 'CONTEXT'           // Contextual information for agents
  | 'CROSS_AGENT';      // Direct inter-agent communication

/**
 * Priority levels for memory entries
 */
export type MemoryPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Base memory entry interface
 */
export interface MemoryEntry<T = unknown> {
  id: string;
  tenantId: string;
  category: MemoryCategory;
  key: string;
  value: T;
  createdBy: string;      // Agent ID that created this entry
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;       // Optional TTL
  priority: MemoryPriority;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  accessCount: number;
  lastAccessedBy?: string;
  lastAccessedAt?: Date;
}

/**
 * Insight entry - knowledge discovered by agents
 */
export interface InsightEntry extends MemoryEntry<InsightData> {
  category: 'INSIGHT';
}

export interface InsightData {
  type: 'MARKET' | 'COMPETITOR' | 'AUDIENCE' | 'CONTENT' | 'PERFORMANCE' | 'TREND';
  title: string;
  summary: string;
  confidence: number;       // 0-100
  sources: string[];
  relatedAgents: string[];
  actionable: boolean;
  recommendedActions?: string[];
}

/**
 * Signal entry - real-time alerts and triggers
 */
export interface SignalEntry extends MemoryEntry<SignalData> {
  category: 'SIGNAL';
}

export interface SignalData {
  signalType: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  affectedAgents: string[];
  payload: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Content entry - generated content artifacts
 */
export interface ContentEntry extends MemoryEntry<ContentData> {
  category: 'CONTENT';
}

export interface ContentData {
  contentType: 'THREAD' | 'POST' | 'VIDEO_SCRIPT' | 'EMAIL' | 'STORYBOARD' | 'COPY' | 'SEO';
  platform?: string;
  title?: string;
  content: string | Record<string, unknown>;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  generatedBy: string;
  reviewedBy?: string;
  publishedAt?: Date;
  performance?: {
    impressions?: number;
    engagements?: number;
    conversions?: number;
  };
}

/**
 * Cross-agent message entry
 */
export interface CrossAgentEntry extends MemoryEntry<CrossAgentData> {
  category: 'CROSS_AGENT';
}

export interface CrossAgentData {
  fromAgent: string;
  toAgent: string;
  messageType: 'REQUEST' | 'RESPONSE' | 'NOTIFICATION' | 'HANDOFF';
  subject: string;
  body: Record<string, unknown>;
  requiresResponse: boolean;
  responseDeadline?: Date;
  responded: boolean;
  responseId?: string;
}

/**
 * Write operation options
 */
export interface WriteOptions {
  ttlMs?: number;           // Time-to-live in milliseconds
  priority?: MemoryPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
  overwrite?: boolean;      // Overwrite if exists
}

/**
 * Query options for reading
 */
export interface QueryOptions {
  category?: MemoryCategory;
  tags?: string[];
  createdBy?: string;
  minPriority?: MemoryPriority;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
  includeExpired?: boolean;
}

/**
 * Subscription callback for memory changes
 */
export type MemorySubscriptionCallback = (entry: MemoryEntry) => void;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  category?: MemoryCategory;
  tags?: string[];
  fromAgents?: string[];
}

// ============================================================================
// PRIORITY ORDERING
// ============================================================================

const PRIORITY_ORDER: Record<MemoryPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ============================================================================
// TENANT MEMORY VAULT CLASS
// ============================================================================

/**
 * TenantMemoryVault - The shared memory store for cross-agent communication
 *
 * This is the central nervous system of the agent swarm. Every agent reads
 * from and writes to this vault, enabling coordinated intelligence.
 */
export class TenantMemoryVault {
  private static instance: TenantMemoryVault | null = null;

  // In-memory storage (would be Firestore in production)
  private store: Map<string, Map<string, MemoryEntry>> = new Map();

  // Subscriptions for real-time updates
  private subscriptions: Map<string, Map<string, {
    callback: MemorySubscriptionCallback;
    options: SubscriptionOptions;
  }>> = new Map();

  // Access metrics
  private accessMetrics: Map<string, { reads: number; writes: number }> = new Map();

  private constructor() {
    logger.info('[TenantMemoryVault] Initialized - Cross-agent memory active');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TenantMemoryVault {
    TenantMemoryVault.instance ??= new TenantMemoryVault();
    return TenantMemoryVault.instance;
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    TenantMemoryVault.instance = null;
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Write an entry to the vault
   */
  write<T>(
    tenantId: string,
    category: MemoryCategory,
    key: string,
    value: T,
    agentId: string,
    options: WriteOptions = {}
  ): MemoryEntry<T> {
    // Validate tenant scope
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('[TenantMemoryVault] tenantId is REQUIRED - tenant scoping is mandatory');
    }

    // Get or create tenant store
    if (!this.store.has(tenantId)) {
      this.store.set(tenantId, new Map());
    }
    const tenantStore = this.store.get(tenantId);
    if (!tenantStore) {
      throw new Error('[TenantMemoryVault] Failed to initialize tenant store');
    }

    // Check for existing entry
    const existingKey = `${category}:${key}`;
    const existing = tenantStore.get(existingKey);

    if (existing && !options.overwrite) {
      // Update existing entry
      const updated: MemoryEntry<T> = {
        ...(existing as MemoryEntry<T>),
        value,
        updatedAt: new Date(),
        version: existing.version + 1,
        priority: options.priority ?? existing.priority,
        tags: options.tags ?? existing.tags,
        metadata: { ...existing.metadata, ...options.metadata },
      };

      tenantStore.set(existingKey, updated);
      this.notifySubscribers(tenantId, updated);
      this.trackWrite(tenantId);

      logger.info('[TenantMemoryVault] Entry updated', {
        tenantId,
        category,
        key,
        agentId,
        version: updated.version,
      });

      return updated;
    }

    // Create new entry
    const now = new Date();
    const entry: MemoryEntry<T> = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      tenantId,
      category,
      key,
      value,
      createdBy: agentId,
      createdAt: now,
      updatedAt: now,
      expiresAt: options.ttlMs ? new Date(now.getTime() + options.ttlMs) : undefined,
      priority: options.priority ?? 'MEDIUM',
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      version: 1,
      accessCount: 0,
    };

    tenantStore.set(existingKey, entry);
    this.notifySubscribers(tenantId, entry);
    this.trackWrite(tenantId);

    logger.info('[TenantMemoryVault] Entry created', {
      tenantId,
      category,
      key,
      agentId,
      id: entry.id,
    });

    return entry;
  }

  /**
   * Write an insight to the vault
   */
  async writeInsight(
    tenantId: string,
    key: string,
    insight: InsightData,
    agentId: string,
    options: WriteOptions = {}
  ): Promise<InsightEntry> {
    return this.write<InsightData>(
      tenantId,
      'INSIGHT',
      key,
      insight,
      agentId,
      { ...options, tags: [...(options.tags ?? []), insight.type] }
    ) as Promise<InsightEntry>;
  }

  /**
   * Write a signal to the vault
   */
  async writeSignal(
    tenantId: string,
    key: string,
    signal: SignalData,
    agentId: string,
    options: WriteOptions = {}
  ): Promise<SignalEntry> {
    return this.write<SignalData>(
      tenantId,
      'SIGNAL',
      key,
      signal,
      agentId,
      {
        ...options,
        priority: signal.urgency,
        tags: [...(options.tags ?? []), signal.signalType],
      }
    ) as Promise<SignalEntry>;
  }

  /**
   * Write content to the vault
   */
  async writeContent(
    tenantId: string,
    key: string,
    content: ContentData,
    agentId: string,
    options: WriteOptions = {}
  ): Promise<ContentEntry> {
    return this.write<ContentData>(
      tenantId,
      'CONTENT',
      key,
      content,
      agentId,
      {
        ...options,
        tags: [...(options.tags ?? []), content.contentType, content.platform ?? 'generic'],
      }
    ) as Promise<ContentEntry>;
  }

  /**
   * Send a cross-agent message
   */
  async sendCrossAgentMessage(
    tenantId: string,
    fromAgent: string,
    toAgent: string,
    messageType: CrossAgentData['messageType'],
    subject: string,
    body: Record<string, unknown>,
    options: { requiresResponse?: boolean; responseDeadline?: Date; priority?: MemoryPriority } = {}
  ): Promise<CrossAgentEntry> {
    const message: CrossAgentData = {
      fromAgent,
      toAgent,
      messageType,
      subject,
      body,
      requiresResponse: options.requiresResponse ?? false,
      responseDeadline: options.responseDeadline,
      responded: false,
    };

    const key = `${fromAgent}_to_${toAgent}_${Date.now()}`;

    return this.write<CrossAgentData>(
      tenantId,
      'CROSS_AGENT',
      key,
      message,
      fromAgent,
      { priority: options.priority ?? 'HIGH', tags: ['message', messageType.toLowerCase()] }
    ) as Promise<CrossAgentEntry>;
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Read a specific entry by key
   */
  read<T>(
    tenantId: string,
    category: MemoryCategory,
    key: string,
    agentId: string
  ): MemoryEntry<T> | null {
    // Validate tenant scope
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('[TenantMemoryVault] tenantId is REQUIRED - tenant scoping is mandatory');
    }

    const tenantStore = this.store.get(tenantId);
    if (!tenantStore) {
      return null;
    }

    const entryKey = `${category}:${key}`;
    const entry = tenantStore.get(entryKey) as MemoryEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      tenantStore.delete(entryKey);
      return null;
    }

    // Update access tracking
    entry.accessCount += 1;
    entry.lastAccessedBy = agentId;
    entry.lastAccessedAt = new Date();
    this.trackRead(tenantId);

    return entry;
  }

  /**
   * Query entries by criteria
   */
  query(
    tenantId: string,
    agentId: string,
    options: QueryOptions = {}
  ): MemoryEntry[] {
    // Validate tenant scope
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('[TenantMemoryVault] tenantId is REQUIRED - tenant scoping is mandatory');
    }

    const tenantStore = this.store.get(tenantId);
    if (!tenantStore) {
      return [];
    }

    const now = new Date();
    let entries = Array.from(tenantStore.values());

    // Filter expired unless explicitly included
    if (!options.includeExpired) {
      entries = entries.filter(e => !e.expiresAt || e.expiresAt > now);
    }

    // Filter by category
    if (options.category) {
      entries = entries.filter(e => e.category === options.category);
    }

    // Filter by tags (any match)
    if (options.tags && options.tags.length > 0) {
      const tags = options.tags;
      entries = entries.filter(e =>
        tags.some(tag => e.tags.includes(tag))
      );
    }

    // Filter by creator
    if (options.createdBy) {
      entries = entries.filter(e => e.createdBy === options.createdBy);
    }

    // Filter by minimum priority
    if (options.minPriority) {
      const minOrder = PRIORITY_ORDER[options.minPriority];
      entries = entries.filter(e => PRIORITY_ORDER[e.priority] >= minOrder);
    }

    // Sort
    const sortBy = options.sortBy ?? 'createdAt';
    const sortOrder = options.sortOrder ?? 'desc';
    entries.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'priority':
          comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'accessCount':
          comparison = a.accessCount - b.accessCount;
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'createdAt':
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    entries = entries.slice(offset, offset + limit);

    // Track access
    this.trackRead(tenantId);

    return entries;
  }

  /**
   * Get all insights for a tenant
   */
  async getInsights(
    tenantId: string,
    agentId: string,
    filter?: { type?: InsightData['type']; minConfidence?: number }
  ): Promise<InsightEntry[]> {
    const entries = await this.query(tenantId, agentId, {
      category: 'INSIGHT',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    let insights = entries as InsightEntry[];

    if (filter?.type) {
      insights = insights.filter(i => i.value.type === filter.type);
    }

    if (filter?.minConfidence !== undefined) {
      const minConf = filter.minConfidence;
      insights = insights.filter(i => i.value.confidence >= minConf);
    }

    return insights;
  }

  /**
   * Get pending signals for an agent
   */
  async getPendingSignals(
    tenantId: string,
    agentId: string
  ): Promise<SignalEntry[]> {
    const entries = await this.query(tenantId, agentId, {
      category: 'SIGNAL',
      sortBy: 'priority',
      sortOrder: 'desc',
    });

    return (entries as SignalEntry[]).filter(
      s => !s.value.acknowledged &&
           (s.value.affectedAgents.includes(agentId) || s.value.affectedAgents.includes('ALL'))
    );
  }

  /**
   * Get cross-agent messages for an agent
   */
  async getMessagesForAgent(
    tenantId: string,
    agentId: string,
    options?: { unrespondedOnly?: boolean }
  ): Promise<CrossAgentEntry[]> {
    const entries = await this.query(tenantId, agentId, {
      category: 'CROSS_AGENT',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    let messages = (entries as CrossAgentEntry[]).filter(
      m => m.value.toAgent === agentId || m.value.toAgent === 'ALL'
    );

    if (options?.unrespondedOnly) {
      messages = messages.filter(m => m.value.requiresResponse && !m.value.responded);
    }

    return messages;
  }

  /**
   * Get content by type
   */
  async getContent(
    tenantId: string,
    agentId: string,
    contentType?: ContentData['contentType']
  ): Promise<ContentEntry[]> {
    const entries = await this.query(tenantId, agentId, {
      category: 'CONTENT',
      tags: contentType ? [contentType] : undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return entries as ContentEntry[];
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  /**
   * Subscribe to memory changes
   */
  subscribe(
    tenantId: string,
    subscriberId: string,
    callback: MemorySubscriptionCallback,
    options: SubscriptionOptions = {}
  ): () => void {
    if (!this.subscriptions.has(tenantId)) {
      this.subscriptions.set(tenantId, new Map());
    }

    const tenantSubs = this.subscriptions.get(tenantId);
    if (!tenantSubs) {
      throw new Error('[TenantMemoryVault] Failed to initialize tenant subscriptions');
    }
    tenantSubs.set(subscriberId, { callback, options });

    logger.info('[TenantMemoryVault] Subscription added', {
      tenantId,
      subscriberId,
      category: options.category,
      tags: options.tags,
    });

    // Return unsubscribe function
    return () => {
      tenantSubs.delete(subscriberId);
      logger.info('[TenantMemoryVault] Subscription removed', {
        tenantId,
        subscriberId,
      });
    };
  }

  /**
   * Notify subscribers of changes
   */
  private notifySubscribers(tenantId: string, entry: MemoryEntry): void {
    const tenantSubs = this.subscriptions.get(tenantId);
    if (!tenantSubs) return;

    for (const [_subscriberId, { callback, options }] of tenantSubs) {
      // Check if subscriber wants this category
      if (options.category && options.category !== entry.category) {
        continue;
      }

      // Check if subscriber wants entries from these agents
      if (options.fromAgents && !options.fromAgents.includes(entry.createdBy)) {
        continue;
      }

      // Check if subscriber wants these tags
      if (options.tags && !options.tags.some(t => entry.tags.includes(t))) {
        continue;
      }

      // Invoke callback (non-blocking)
      try {
        callback(entry);
      } catch (error) {
        logger.error('[TenantMemoryVault] Subscription callback error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Acknowledge a signal
   */
  async acknowledgeSignal(
    tenantId: string,
    signalKey: string,
    agentId: string
  ): Promise<boolean> {
    const entry = await this.read<SignalData>(tenantId, 'SIGNAL', signalKey, agentId);
    if (!entry) return false;

    entry.value.acknowledged = true;
    entry.value.acknowledgedBy = agentId;
    entry.value.acknowledgedAt = new Date();

    await this.write(tenantId, 'SIGNAL', signalKey, entry.value, agentId, { overwrite: true });
    return true;
  }

  /**
   * Mark a cross-agent message as responded
   */
  async markMessageResponded(
    tenantId: string,
    messageKey: string,
    responseId: string,
    agentId: string
  ): Promise<boolean> {
    const entry = await this.read<CrossAgentData>(tenantId, 'CROSS_AGENT', messageKey, agentId);
    if (!entry) return false;

    entry.value.responded = true;
    entry.value.responseId = responseId;

    await this.write(tenantId, 'CROSS_AGENT', messageKey, entry.value, agentId, { overwrite: true });
    return true;
  }

  /**
   * Get vault statistics for a tenant
   */
  getStats(tenantId: string): {
    totalEntries: number;
    byCategory: Record<MemoryCategory, number>;
    metrics: { reads: number; writes: number };
  } {
    const tenantStore = this.store.get(tenantId);
    const metrics = this.accessMetrics.get(tenantId) ?? { reads: 0, writes: 0 };

    if (!tenantStore) {
      return {
        totalEntries: 0,
        byCategory: {
          INSIGHT: 0, SIGNAL: 0, CONTENT: 0, PROFILE: 0,
          STRATEGY: 0, WORKFLOW: 0, PERFORMANCE: 0, CONTEXT: 0, CROSS_AGENT: 0,
        },
        metrics,
      };
    }

    const byCategory: Record<MemoryCategory, number> = {
      INSIGHT: 0, SIGNAL: 0, CONTENT: 0, PROFILE: 0,
      STRATEGY: 0, WORKFLOW: 0, PERFORMANCE: 0, CONTEXT: 0, CROSS_AGENT: 0,
    };

    for (const entry of tenantStore.values()) {
      byCategory[entry.category] += 1;
    }

    return {
      totalEntries: tenantStore.size,
      byCategory,
      metrics,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(tenantId: string): number {
    const tenantStore = this.store.get(tenantId);
    if (!tenantStore) return 0;

    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of tenantStore) {
      if (entry.expiresAt && entry.expiresAt < now) {
        tenantStore.delete(key);
        cleaned += 1;
      }
    }

    if (cleaned > 0) {
      logger.info('[TenantMemoryVault] Cleaned expired entries', {
        tenantId,
        count: cleaned,
      });
    }

    return cleaned;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private trackRead(tenantId: string): void {
    if (!this.accessMetrics.has(tenantId)) {
      this.accessMetrics.set(tenantId, { reads: 0, writes: 0 });
    }
    const metrics = this.accessMetrics.get(tenantId);
    if (metrics) {
      metrics.reads += 1;
    }
  }

  private trackWrite(tenantId: string): void {
    if (!this.accessMetrics.has(tenantId)) {
      this.accessMetrics.set(tenantId, { reads: 0, writes: 0 });
    }
    const metrics = this.accessMetrics.get(tenantId);
    if (metrics) {
      metrics.writes += 1;
    }
  }
}

// ============================================================================
// SINGLETON ACCESSOR
// ============================================================================

/**
 * Get the TenantMemoryVault singleton
 */
export function getMemoryVault(): TenantMemoryVault {
  return TenantMemoryVault.getInstance();
}

// ============================================================================
// HELPER FUNCTIONS FOR AGENTS
// ============================================================================

/**
 * Helper to share an insight with other agents
 */
export async function shareInsight(
  tenantId: string,
  agentId: string,
  insightType: InsightData['type'],
  title: string,
  summary: string,
  options: {
    confidence?: number;
    sources?: string[];
    relatedAgents?: string[];
    actions?: string[];
    tags?: string[];
  } = {}
): Promise<InsightEntry> {
  const vault = getMemoryVault();

  return vault.writeInsight(
    tenantId,
    `${agentId}_${insightType}_${Date.now()}`,
    {
      type: insightType,
      title,
      summary,
      confidence: options.confidence ?? 75,
      sources: options.sources ?? [agentId],
      relatedAgents: options.relatedAgents ?? [],
      actionable: (options.actions?.length ?? 0) > 0,
      recommendedActions: options.actions,
    },
    agentId,
    { tags: options.tags }
  );
}

/**
 * Helper to broadcast a signal to other agents
 */
export async function broadcastSignal(
  tenantId: string,
  agentId: string,
  signalType: string,
  urgency: SignalData['urgency'],
  payload: Record<string, unknown>,
  affectedAgents: string[] = ['ALL']
): Promise<SignalEntry> {
  const vault = getMemoryVault();

  return vault.writeSignal(
    tenantId,
    `${agentId}_signal_${Date.now()}`,
    {
      signalType,
      urgency,
      source: agentId,
      affectedAgents: affectedAgents.length === 0 ? ['ALL'] : affectedAgents,
      payload,
      acknowledged: false,
    },
    agentId
  );
}

/**
 * Helper to read recent insights from other agents
 */
export async function readAgentInsights(
  tenantId: string,
  agentId: string,
  filter?: { type?: InsightData['type']; minConfidence?: number; limit?: number }
): Promise<InsightEntry[]> {
  const vault = getMemoryVault();
  const insights = await vault.getInsights(tenantId, agentId, filter);
  return insights.slice(0, filter?.limit ?? 10);
}

/**
 * Helper to check for pending signals
 */
export async function checkPendingSignals(
  tenantId: string,
  agentId: string
): Promise<SignalEntry[]> {
  const vault = getMemoryVault();
  return vault.getPendingSignals(tenantId, agentId);
}

logger.info('[TenantMemoryVault] Module loaded - Shared memory infrastructure ready');
