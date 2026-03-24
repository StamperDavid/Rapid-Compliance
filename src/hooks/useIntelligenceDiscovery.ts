/**
 * Intelligence Discovery Hook — Central state for the Discovery Hub
 *
 * Manages operations, findings, actions, selection, and chat state.
 * All API calls use useAuthFetch for Bearer token injection.
 *
 * @module hooks/useIntelligenceDiscovery
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthFetch } from './useAuthFetch';
import type {
  DiscoveryOperation,
  DiscoveryFinding,
  DiscoveryAction,
  DiscoverySource,
  EnrichmentStatus,
  ApprovalStatus,
} from '@/types/intelligence-discovery';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveryChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SourceTemplate {
  id: string;
  name: string;
  description: string;
  sourceType: string;
}

export interface UseIntelligenceDiscoveryReturn {
  // Sources
  sources: DiscoverySource[];
  templates: SourceTemplate[];
  sourcesLoading: boolean;
  createSourceFromTemplate: (templateId: string) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  updateSource: (sourceId: string, updates: Record<string, unknown>) => Promise<void>;
  configSource: DiscoverySource | null;
  setConfigSource: (source: DiscoverySource | null) => void;

  // Operations
  operations: DiscoveryOperation[];
  activeOperation: DiscoveryOperation | null;
  operationsLoading: boolean;
  selectOperation: (op: DiscoveryOperation | null) => void;
  startOperation: (sourceId: string) => Promise<void>;

  // Findings
  findings: DiscoveryFinding[];
  findingsLoading: boolean;
  findingsHasMore: boolean;
  enrichmentFilter: EnrichmentStatus | 'all';
  approvalFilter: ApprovalStatus | 'all';
  setEnrichmentFilter: (f: EnrichmentStatus | 'all') => void;
  setApprovalFilter: (f: ApprovalStatus | 'all') => void;
  loadMoreFindings: () => Promise<void>;

  // Selection
  selectedFindingIds: Set<string>;
  toggleFindingSelection: (id: string) => void;
  selectAllFindings: () => void;
  clearSelection: () => void;

  // Approval
  approveFinding: (id: string) => Promise<void>;
  rejectFinding: (id: string, notes?: string) => Promise<void>;
  bulkApprove: () => Promise<void>;
  bulkReject: (notes?: string) => Promise<void>;

  // Enrichment
  enrichFinding: (id: string) => Promise<void>;

  // Conversion + Export
  convertToLeads: () => Promise<void>;
  exportCSV: () => void;
  converting: boolean;
  exporting: boolean;

  // Actions (audit log)
  actions: DiscoveryAction[];
  actionsLoading: boolean;
  selectedAction: DiscoveryAction | null;
  setSelectedAction: (action: DiscoveryAction | null) => void;

  // Chat
  chatMessages: DiscoveryChatMessage[];
  chatLoading: boolean;
  sendChatMessage: (text: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

const API_BASE = '/api/intelligence/discovery';

export function useIntelligenceDiscovery(): UseIntelligenceDiscoveryReturn {
  const authFetch = useAuthFetch();

  // ── Sources ───────────────────────────────────────────────────────────
  const [sources, setSources] = useState<DiscoverySource[]>([]);
  const [templates, setTemplates] = useState<SourceTemplate[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [configSource, setConfigSource] = useState<DiscoverySource | null>(null);

  // ── Operations ────────────────────────────────────────────────────────
  const [operations, setOperations] = useState<DiscoveryOperation[]>([]);
  const [activeOperation, setActiveOperation] = useState<DiscoveryOperation | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(true);

  // ── Findings ──────────────────────────────────────────────────────────
  const [findings, setFindings] = useState<DiscoveryFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [findingsHasMore, setFindingsHasMore] = useState(false);
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentStatus | 'all'>('all');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | 'all'>('all');

  // ── Selection ─────────────────────────────────────────────────────────
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  // ── Actions ───────────────────────────────────────────────────────────
  const [actions, setActions] = useState<DiscoveryAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DiscoveryAction | null>(null);

  // ── Chat ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<DiscoveryChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // ── Conversion + Export ─────────────────────────────────────────────
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Polling ref ───────────────────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ====================================================================
  // LOADERS
  // ====================================================================

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/sources`);
      if (res.ok) {
        const data = await res.json() as { sources: DiscoverySource[]; templates: SourceTemplate[] };
        setSources(data.sources);
        setTemplates(data.templates);
      }
    } finally {
      setSourcesLoading(false);
    }
  }, [authFetch]);

  const loadOperations = useCallback(async () => {
    setOperationsLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/operations?limit=20`);
      if (res.ok) {
        const data = await res.json() as { operations: DiscoveryOperation[] };
        setOperations(data.operations);
      }
    } finally {
      setOperationsLoading(false);
    }
  }, [authFetch]);

  const loadFindings = useCallback(async (operationId: string, append = false) => {
    setFindingsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (enrichmentFilter !== 'all') { params.set('enrichmentStatus', enrichmentFilter); }
      if (approvalFilter !== 'all') { params.set('approvalStatus', approvalFilter); }
      if (append && findings.length > 0) {
        params.set('startAfter', findings[findings.length - 1].id);
      }

      const res = await authFetch(`${API_BASE}/operations/${operationId}/findings?${params}`);
      if (res.ok) {
        const data = await res.json() as { findings: DiscoveryFinding[]; hasMore: boolean };
        setFindings(append ? [...findings, ...data.findings] : data.findings);
        setFindingsHasMore(data.hasMore);
      }
    } finally {
      setFindingsLoading(false);
    }
  }, [authFetch, enrichmentFilter, approvalFilter, findings]);

  const loadActions = useCallback(async (operationId: string, since?: string) => {
    setActionsLoading(true);
    try {
      const params = new URLSearchParams({ operationId, limit: '50' });
      if (since) { params.set('since', since); }

      const res = await authFetch(`${API_BASE}/actions?${params}`);
      if (res.ok) {
        const data = await res.json() as { actions: DiscoveryAction[] };
        if (since) {
          // Delta — prepend new actions
          setActions((prev) => [...data.actions, ...prev]);
        } else {
          setActions(data.actions);
        }
      }
    } finally {
      setActionsLoading(false);
    }
  }, [authFetch]);

  // ====================================================================
  // EFFECTS
  // ====================================================================

  // Load sources and operations on mount
  useEffect(() => {
    void loadSources();
    void loadOperations();
  }, [loadSources, loadOperations]);

  // Load findings when active operation changes or filters change
  useEffect(() => {
    if (activeOperation) {
      void loadFindings(activeOperation.id);
      void loadActions(activeOperation.id);
      setSelectedFindingIds(new Set());
    } else {
      setFindings([]);
      setActions([]);
    }
  }, [activeOperation?.id, enrichmentFilter, approvalFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll actions while operation is running
  useEffect(() => {
    if (activeOperation?.status === 'running' || activeOperation?.status === 'queued') {
      pollingRef.current = setInterval(() => {
        const latestAction = actions[0]?.startedAt;
        void loadActions(activeOperation.id, latestAction);
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeOperation?.id, activeOperation?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====================================================================
  // SOURCE ACTIONS
  // ====================================================================

  const createSourceFromTemplate = useCallback(async (templateId: string) => {
    const res = await authFetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    });
    if (res.ok) {
      await loadSources();
    }
  }, [authFetch, loadSources]);

  const deleteSourceFn = useCallback(async (sourceId: string) => {
    const res = await authFetch(`${API_BASE}/sources/${sourceId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadSources();
    }
  }, [authFetch, loadSources]);

  const updateSourceFn = useCallback(async (sourceId: string, updates: Record<string, unknown>) => {
    const res = await authFetch(`${API_BASE}/sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await loadSources();
    }
  }, [authFetch, loadSources]);

  // ====================================================================
  // OPERATION ACTIONS
  // ====================================================================

  const selectOperation = useCallback((op: DiscoveryOperation | null) => {
    setActiveOperation(op);
  }, []);

  const startOperation = useCallback(async (sourceId: string) => {
    const res = await authFetch(`${API_BASE}/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    });
    if (res.ok) {
      const data = await res.json() as { operation: DiscoveryOperation };
      setActiveOperation(data.operation);
      await loadOperations();
    }
  }, [authFetch, loadOperations]);

  // ====================================================================
  // FINDING SELECTION
  // ====================================================================

  const toggleFindingSelection = useCallback((id: string) => {
    setSelectedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const selectAllFindings = useCallback(() => {
    setSelectedFindingIds(new Set(findings.map((f) => f.id)));
  }, [findings]);

  const clearSelection = useCallback(() => {
    setSelectedFindingIds(new Set());
  }, []);

  // ====================================================================
  // APPROVAL ACTIONS
  // ====================================================================

  const approveFinding = useCallback(async (id: string) => {
    const res = await authFetch(`${API_BASE}/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    if (res.ok) {
      setFindings((prev) => prev.map((f) => f.id === id ? { ...f, approvalStatus: 'approved' as const } : f));
    }
  }, [authFetch]);

  const rejectFinding = useCallback(async (id: string, notes?: string) => {
    const res = await authFetch(`${API_BASE}/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: 'rejected', rejectionNotes: notes }),
    });
    if (res.ok) {
      setFindings((prev) => prev.map((f) => f.id === id ? { ...f, approvalStatus: 'rejected' as const } : f));
    }
  }, [authFetch]);

  const bulkApprove = useCallback(async () => {
    const ids = Array.from(selectedFindingIds);
    if (ids.length === 0) { return; }

    // Approve one at a time (bulk endpoint can be added later)
    await Promise.all(ids.map((id) => approveFinding(id)));
    setSelectedFindingIds(new Set());
  }, [selectedFindingIds, approveFinding]);

  const bulkReject = useCallback(async (notes?: string) => {
    const ids = Array.from(selectedFindingIds);
    if (ids.length === 0) { return; }

    await Promise.all(ids.map((id) => rejectFinding(id, notes)));
    setSelectedFindingIds(new Set());
  }, [selectedFindingIds, rejectFinding]);

  // ====================================================================
  // ENRICHMENT
  // ====================================================================

  const enrichFinding = useCallback(async (id: string) => {
    const res = await authFetch(`${API_BASE}/findings/${id}/enrich`, { method: 'POST' });
    if (res.ok) {
      setFindings((prev) => prev.map((f) => f.id === id ? { ...f, enrichmentStatus: 'in_progress' as const } : f));
    }
  }, [authFetch]);

  // ====================================================================
  // CONVERSION + EXPORT
  // ====================================================================

  const convertToLeads = useCallback(async () => {
    const approvedIds = Array.from(selectedFindingIds).filter((id) => {
      const finding = findings.find((f) => f.id === id);
      return finding?.approvalStatus === 'approved';
    });

    if (approvedIds.length === 0) { return; }

    setConverting(true);
    try {
      const res = await authFetch(`${API_BASE}/findings/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingIds: approvedIds }),
      });

      if (res.ok) {
        const data = await res.json() as {
          converted: number;
          results: Array<{ findingId: string; leadId: string | null; success: boolean }>;
        };

        // Update local findings to reflect converted status
        setFindings((prev) =>
          prev.map((f) => {
            const result = data.results.find((r) => r.findingId === f.id);
            if (result?.success) {
              return { ...f, approvalStatus: 'converted' as const, leadId: result.leadId };
            }
            return f;
          })
        );

        setSelectedFindingIds(new Set());
      }
    } finally {
      setConverting(false);
    }
  }, [authFetch, selectedFindingIds, findings]);

  const exportCSV = useCallback(() => {
    if (!activeOperation) { return; }

    setExporting(true);

    const params = new URLSearchParams({ operationId: activeOperation.id });
    if (approvalFilter !== 'all') { params.set('approvalStatus', approvalFilter); }

    void authFetch(`${API_BASE}/findings/export?${params}`)
      .then(async (res) => {
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `discovery-findings-${activeOperation.id.slice(0, 8)}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      })
      .finally(() => { setExporting(false); });
  }, [authFetch, activeOperation, approvalFilter]);

  // ====================================================================
  // CHAT — wired to /api/intelligence/discovery/chat
  // ====================================================================

  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const sendChatMessage = useCallback(async (text: string) => {
    const userMsg: DiscoveryChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await authFetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: chatHistoryRef.current.slice(-20),
          activeOperationId: activeOperation?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json() as {
          message: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
          metadata?: Record<string, unknown>;
        };

        const assistantMsg: DiscoveryChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);

        // Update conversation history for context
        chatHistoryRef.current.push({ role: 'user', content: text });
        chatHistoryRef.current.push({ role: 'assistant', content: data.message });

        // If tools created a source or operation, refresh lists
        if (data.metadata?.sourceId) {
          void loadSources();
        }
        if (data.metadata?.operationId) {
          void loadOperations();
        }
      } else {
        const assistantMsg: DiscoveryChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const assistantMsg: DiscoveryChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Connection error. Please check your network and try again.',
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [authFetch, activeOperation?.id, loadSources, loadOperations]);

  // ====================================================================
  // PAGINATION
  // ====================================================================

  const loadMoreFindings = useCallback(async () => {
    if (activeOperation && findingsHasMore) {
      await loadFindings(activeOperation.id, true);
    }
  }, [activeOperation, findingsHasMore, loadFindings]);

  // ====================================================================
  // RETURN
  // ====================================================================

  return {
    sources,
    templates,
    sourcesLoading,
    createSourceFromTemplate,
    deleteSource: deleteSourceFn,
    updateSource: updateSourceFn,
    configSource,
    setConfigSource,

    operations,
    activeOperation,
    operationsLoading,
    selectOperation,
    startOperation,

    findings,
    findingsLoading,
    findingsHasMore,
    enrichmentFilter,
    approvalFilter,
    setEnrichmentFilter,
    setApprovalFilter,
    loadMoreFindings,

    selectedFindingIds,
    toggleFindingSelection,
    selectAllFindings,
    clearSelection,

    approveFinding,
    rejectFinding,
    bulkApprove,
    bulkReject,

    enrichFinding,

    convertToLeads,
    exportCSV,
    converting,
    exporting,

    actions,
    actionsLoading,
    selectedAction,
    setSelectedAction,

    chatMessages,
    chatLoading,
    sendChatMessage,
  };
}
