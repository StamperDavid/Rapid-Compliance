'use client';

/**
 * useLeadResearch — Central state for the Lead Research page.
 *
 * Manages: chat messages, active ICP profile, discovery batches/results,
 * URL sources, schedule config, field selections, and selected result IDs.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuthFetch } from './useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { IcpProfile } from '@/types/icp-profile';
import type { DiscoveryBatch, DiscoveryResult, DiscoveryResultStatus } from '@/types/discovery-batch';
import {
  DEFAULT_FIELD_SELECTION,
  type ResearchChatMessage,
  type UrlSource,
  type ResearchSchedule,
  type FieldSelection,
  type ResearchChatResponse,
} from '@/types/lead-research';

// ── Types ───────────────────────────────────────────────────────────────────

interface UseLeadResearchReturn {
  // Chat
  chatMessages: ResearchChatMessage[];
  chatLoading: boolean;
  sendMessage: (text: string) => Promise<void>;

  // ICP
  icpProfiles: IcpProfile[];
  activeIcpProfile: IcpProfile | null;
  icpLoading: boolean;
  refreshIcpProfiles: () => Promise<void>;

  // Discovery
  batches: DiscoveryBatch[];
  activeBatch: DiscoveryBatch | null;
  batchResults: DiscoveryResult[];
  batchesLoading: boolean;
  resultsLoading: boolean;
  selectedResultIds: Set<string>;
  resultStatusFilter: DiscoveryResultStatus | 'all';
  setResultStatusFilter: (f: DiscoveryResultStatus | 'all') => void;
  toggleResultSelection: (id: string) => void;
  selectAllResults: () => void;
  clearSelection: () => void;
  setActiveBatch: (batch: DiscoveryBatch | null) => void;
  refreshBatches: () => Promise<void>;
  loadBatchResults: (batchId: string, status?: string) => Promise<void>;
  approveResult: (resultId: string) => Promise<void>;
  rejectResult: (resultId: string, notes?: string) => Promise<void>;
  bulkApprove: () => Promise<void>;
  convertResults: (resultIds: string[]) => Promise<void>;

  // URL Sources
  urlSources: UrlSource[];
  urlSourcesLoading: boolean;
  addUrlSource: (url: string, label?: string) => Promise<void>;
  removeUrlSource: (id: string) => Promise<void>;
  refreshUrlSources: () => Promise<void>;

  // Schedule
  schedule: ResearchSchedule | null;
  scheduleLoading: boolean;
  updateSchedule: (updates: Partial<ResearchSchedule>) => Promise<void>;
  runScheduleNow: () => Promise<void>;

  // Field Selection
  fieldSelection: FieldSelection;
  toggleField: (field: keyof FieldSelection) => void;

  // CSV Export
  exportCsv: (batchId: string) => Promise<void>;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useLeadResearch(): UseLeadResearchReturn {
  const authFetch = useAuthFetch();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ResearchChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "I'm your Lead Research assistant. Tell me what kind of companies you're looking for and I'll find, score, and organize them for you.\n\nTry:\n- \"Find SaaS companies in Austin with 50-200 employees\"\n- \"Research HVAC companies in Texas\"\n- \"Update my ICP to focus on fintech startups\"",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // ICP state
  const [icpProfiles, setIcpProfiles] = useState<IcpProfile[]>([]);
  const [icpLoading, setIcpLoading] = useState(false);

  // Discovery state
  const [batches, setBatches] = useState<DiscoveryBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<DiscoveryBatch | null>(null);
  const [batchResults, setBatchResults] = useState<DiscoveryResult[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [resultStatusFilter, setResultStatusFilter] = useState<DiscoveryResultStatus | 'all'>('all');

  // URL Sources state
  const [urlSources, setUrlSources] = useState<UrlSource[]>([]);
  const [urlSourcesLoading, setUrlSourcesLoading] = useState(false);

  // Schedule state
  const [schedule, setSchedule] = useState<ResearchSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Field selection
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(DEFAULT_FIELD_SELECTION);

  // Ref for conversation history (avoid stale closures)
  const chatHistoryRef = useRef(chatMessages);
  chatHistoryRef.current = chatMessages;

  // ── ICP ─────────────────────────────────────────────────────────────────

  const refreshIcpProfiles = useCallback(async () => {
    setIcpLoading(true);
    try {
      const res = await authFetch('/api/leads/icp');
      if (!res.ok) { throw new Error(`ICP fetch failed: ${res.status}`); }
      const data = (await res.json()) as { profiles: IcpProfile[] };
      setIcpProfiles(data.profiles ?? []);
    } catch (err: unknown) {
      logger.error('Failed to load ICP profiles', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIcpLoading(false);
    }
  }, [authFetch]);

  const activeIcpProfile = icpProfiles.find(p => p.isActive) ?? null;

  // ── Discovery Batches ───────────────────────────────────────────────────

  const refreshBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await authFetch('/api/leads/discovery');
      if (!res.ok) { throw new Error(`Batches fetch failed: ${res.status}`); }
      const data = (await res.json()) as { batches: DiscoveryBatch[] };
      setBatches(data.batches ?? []);
    } catch (err: unknown) {
      logger.error('Failed to load batches', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setBatchesLoading(false);
    }
  }, [authFetch]);

  const loadBatchResults = useCallback(async (batchId: string, status?: string) => {
    setResultsLoading(true);
    try {
      const qs = status && status !== 'all' ? `?status=${status}` : '';
      const res = await authFetch(`/api/leads/discovery/${batchId}${qs}`);
      if (!res.ok) { throw new Error(`Results fetch failed: ${res.status}`); }
      const data = (await res.json()) as { batch: DiscoveryBatch; results: DiscoveryResult[] };
      setActiveBatch(data.batch);
      setBatchResults(data.results ?? []);
      setSelectedResultIds(new Set());
    } catch (err: unknown) {
      logger.error('Failed to load batch results', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setResultsLoading(false);
    }
  }, [authFetch]);

  const approveResult = useCallback(async (resultId: string) => {
    if (!activeBatch) { return; }
    try {
      await authFetch(`/api/leads/discovery/${activeBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', resultId }),
      });
      await loadBatchResults(activeBatch.id, resultStatusFilter === 'all' ? undefined : resultStatusFilter);
    } catch (err: unknown) {
      logger.error('Approve failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, activeBatch, loadBatchResults, resultStatusFilter]);

  const rejectResult = useCallback(async (resultId: string, notes?: string) => {
    if (!activeBatch) { return; }
    try {
      await authFetch(`/api/leads/discovery/${activeBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', resultId, notes }),
      });
      await loadBatchResults(activeBatch.id, resultStatusFilter === 'all' ? undefined : resultStatusFilter);
    } catch (err: unknown) {
      logger.error('Reject failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, activeBatch, loadBatchResults, resultStatusFilter]);

  const bulkApprove = useCallback(async () => {
    if (!activeBatch || selectedResultIds.size === 0) { return; }
    try {
      await authFetch(`/api/leads/discovery/${activeBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-approve', resultIds: Array.from(selectedResultIds) }),
      });
      await loadBatchResults(activeBatch.id, resultStatusFilter === 'all' ? undefined : resultStatusFilter);
    } catch (err: unknown) {
      logger.error('Bulk approve failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, activeBatch, selectedResultIds, loadBatchResults, resultStatusFilter]);

  const convertResults = useCallback(async (resultIds: string[]) => {
    if (!activeBatch || resultIds.length === 0) { return; }
    try {
      await authFetch(`/api/leads/discovery/${activeBatch.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultIds }),
      });
      await loadBatchResults(activeBatch.id, resultStatusFilter === 'all' ? undefined : resultStatusFilter);
    } catch (err: unknown) {
      logger.error('Convert failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, activeBatch, loadBatchResults, resultStatusFilter]);

  // ── Selection helpers ───────────────────────────────────────────────────

  const toggleResultSelection = useCallback((id: string) => {
    setSelectedResultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); }
      return next;
    });
  }, []);

  const selectAllResults = useCallback(() => {
    setSelectedResultIds(new Set(batchResults.map(r => r.id)));
  }, [batchResults]);

  const clearSelection = useCallback(() => {
    setSelectedResultIds(new Set());
  }, []);

  // ── Chat ────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ResearchChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const history = chatHistoryRef.current
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const res = await authFetch('/api/leads/research/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: history,
          icpProfileId: activeIcpProfile?.id,
        }),
      });

      if (!res.ok) { throw new Error(`Chat failed: ${res.status}`); }
      const data = (await res.json()) as ResearchChatResponse;

      const assistantMsg: ResearchChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        toolCalls: data.toolCalls,
        metadata: data.metadata,
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      // If a batch was created, refresh batches
      if (data.metadata?.batchId) {
        void refreshBatches();
      }
      // If ICP was updated, refresh profiles
      if (data.metadata?.icpProfileId) {
        void refreshIcpProfiles();
      }
    } catch (err: unknown) {
      logger.error('Chat error', err instanceof Error ? err : new Error(String(err)));
      const errorMsg: ResearchChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [authFetch, activeIcpProfile, refreshBatches, refreshIcpProfiles]);

  // ── URL Sources ─────────────────────────────────────────────────────────

  const refreshUrlSources = useCallback(async () => {
    setUrlSourcesLoading(true);
    try {
      const res = await authFetch('/api/leads/research/url-sources');
      if (!res.ok) { throw new Error(`URL sources fetch failed: ${res.status}`); }
      const data = (await res.json()) as { sources: UrlSource[] };
      setUrlSources(data.sources ?? []);
    } catch (err: unknown) {
      logger.error('Failed to load URL sources', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUrlSourcesLoading(false);
    }
  }, [authFetch]);

  const addUrlSource = useCallback(async (url: string, label?: string) => {
    try {
      const res = await authFetch('/api/leads/research/url-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, label }),
      });
      if (!res.ok) { throw new Error(`Add URL source failed: ${res.status}`); }
      await refreshUrlSources();
    } catch (err: unknown) {
      logger.error('Failed to add URL source', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, refreshUrlSources]);

  const removeUrlSource = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/leads/research/url-sources?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) { throw new Error(`Remove URL source failed: ${res.status}`); }
      await refreshUrlSources();
    } catch (err: unknown) {
      logger.error('Failed to remove URL source', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, refreshUrlSources]);

  // ── Schedule ────────────────────────────────────────────────────────────

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await authFetch('/api/leads/research/schedule');
      if (!res.ok && res.status !== 404) { throw new Error(`Schedule fetch failed: ${res.status}`); }
      if (res.ok) {
        const data = (await res.json()) as { schedule: ResearchSchedule };
        setSchedule(data.schedule ?? null);
      }
    } catch (err: unknown) {
      logger.error('Failed to load schedule', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setScheduleLoading(false);
    }
  }, [authFetch]);

  const updateSchedule = useCallback(async (updates: Partial<ResearchSchedule>) => {
    try {
      const res = await authFetch('/api/leads/research/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { throw new Error(`Schedule update failed: ${res.status}`); }
      const data = (await res.json()) as { schedule: ResearchSchedule };
      setSchedule(data.schedule);
    } catch (err: unknown) {
      logger.error('Failed to update schedule', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch]);

  const runScheduleNow = useCallback(async () => {
    try {
      const res = await authFetch('/api/leads/research/schedule/run', {
        method: 'POST',
      });
      if (!res.ok) { throw new Error(`Schedule run failed: ${res.status}`); }
      void refreshBatches();
    } catch (err: unknown) {
      logger.error('Failed to run schedule', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, refreshBatches]);

  // ── Field Selection ─────────────────────────────────────────────────────

  const toggleField = useCallback((field: keyof FieldSelection) => {
    setFieldSelection(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // ── CSV Export ──────────────────────────────────────────────────────────

  const exportCsv = useCallback(async (batchId: string) => {
    try {
      const selectedFields = Object.entries(fieldSelection)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(',');
      const statusParam = resultStatusFilter !== 'all' ? `&status=${resultStatusFilter}` : '';
      const res = await authFetch(
        `/api/leads/research/export?batchId=${batchId}&fields=${selectedFields}${statusParam}`
      );
      if (!res.ok) { throw new Error(`CSV export failed: ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead-research-${batchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      logger.error('CSV export failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [authFetch, fieldSelection, resultStatusFilter]);

  // ── Initial load ──────────────────────────────────────────────────────

  useEffect(() => {
    void refreshIcpProfiles();
    void refreshBatches();
    void refreshUrlSources();
    void loadSchedule();
  }, [refreshIcpProfiles, refreshBatches, refreshUrlSources, loadSchedule]);

  return {
    chatMessages,
    chatLoading,
    sendMessage,
    icpProfiles,
    activeIcpProfile,
    icpLoading,
    refreshIcpProfiles,
    batches,
    activeBatch,
    batchResults,
    batchesLoading,
    resultsLoading,
    selectedResultIds,
    resultStatusFilter,
    setResultStatusFilter,
    toggleResultSelection,
    selectAllResults,
    clearSelection,
    setActiveBatch,
    refreshBatches,
    loadBatchResults,
    approveResult,
    rejectResult,
    bulkApprove,
    convertResults,
    urlSources,
    urlSourcesLoading,
    addUrlSource,
    removeUrlSource,
    refreshUrlSources,
    schedule,
    scheduleLoading,
    updateSchedule,
    runScheduleNow,
    fieldSelection,
    toggleField,
    exportCsv,
  };
}
