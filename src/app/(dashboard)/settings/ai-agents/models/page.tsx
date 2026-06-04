'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PageTitle, SectionDescription, SectionTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface AgentModelInfo {
  id: string;
  name: string;
  tier: string;
  kind: 'manager' | 'specialist';
  currentModel: string;
  version: number | null;
  hasGoldenMaster: boolean;
}

interface AgentModelVersion {
  version: number;
  model: string;
  isActive: boolean;
  createdAt: string;
  notes?: string;
}

export default function AgentModelsPage() {
  const authFetch = useAuthFetch();
  const [agents, setAgents] = useState<AgentModelInfo[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkModel, setBulkModel] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentModelVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/agent-models');
      const data = await res.json() as { agents?: AgentModelInfo[]; availableModels?: string[]; error?: string };
      if (!res.ok || !data.agents) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to load agents' });
        return;
      }
      setAgents(data.agents);
      setAvailableModels(data.availableModels ?? []);
      const sel: Record<string, string> = {};
      data.agents.forEach((a) => { sel[a.id] = a.currentModel; });
      setSelections(sel);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load agents' });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  const postChange = useCallback(async (agentId: string, model: string): Promise<boolean> => {
    const res = await authFetch('/api/admin/agent-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change', agentId, model }),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      setMessage({ type: 'error', text: `${agentId}: ${data.error ?? 'failed'}` });
      return false;
    }
    return true;
  }, [authFetch]);

  const changeModel = useCallback(async (agentId: string) => {
    const model = selections[agentId];
    if (!model) { return; }
    setSavingId(agentId);
    setMessage(null);
    if (await postChange(agentId, model)) {
      setMessage({ type: 'success', text: `Model changed for ${agentId}. A new version was saved — roll back from History if it behaves worse.` });
      await load();
    }
    setSavingId(null);
  }, [selections, postChange, load]);

  const applyToAll = useCallback(async () => {
    if (!bulkModel) { return; }
    const targets = agents.filter((a) => a.hasGoldenMaster && a.currentModel !== bulkModel);
    if (targets.length === 0) {
      setMessage({ type: 'success', text: 'All agents already on that model.' });
      return;
    }
    setBulkBusy(true);
    setMessage(null);
    let ok = 0;
    for (const a of targets) {
      if (await postChange(a.id, bulkModel)) { ok += 1; }
    }
    setMessage({ type: ok === targets.length ? 'success' : 'error', text: `Set ${ok}/${targets.length} agents to ${bulkModel}. Each change is a new version you can roll back.` });
    setBulkBusy(false);
    await load();
  }, [bulkModel, agents, postChange, load]);

  const openHistory = useCallback(async (agentId: string) => {
    if (historyFor === agentId) { setHistoryFor(null); return; }
    setHistoryFor(agentId);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const res = await authFetch(`/api/admin/agent-models?agentId=${encodeURIComponent(agentId)}&history=1`);
      const data = await res.json() as { versions?: AgentModelVersion[] };
      setHistory(data.versions ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [authFetch, historyFor]);

  const rollback = useCallback(async (agentId: string, version: number) => {
    setSavingId(agentId);
    setMessage(null);
    try {
      const res = await authFetch('/api/admin/agent-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', agentId, version }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setMessage({ type: 'error', text: data.error ?? 'Rollback failed' });
        return;
      }
      setMessage({ type: 'success', text: `Rolled ${agentId} back to v${version}.` });
      setHistoryFor(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Rollback failed' });
    } finally {
      setSavingId(null);
    }
  }, [authFetch, load]);

  return (
    <div className="p-8 space-y-6 overflow-y-auto">
      <div className="max-w-5xl">
        <Link href="/settings/ai-agents" className="inline-flex items-center gap-2 text-sm font-medium text-primary no-underline mb-6">
          ← Back to AI Agent
        </Link>
        <PageTitle className="mt-4">Model Management</PageTitle>
        <SectionDescription className="mt-1">
          Choose which AI model each agent uses. Changing a model creates a new version you can roll back to if the new model behaves worse.
        </SectionDescription>

        {message && (
          <div className={`mt-4 rounded-lg p-3 text-sm border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-red-500/10 border-red-500/30 text-red-600'}`}>
            {message.text}
          </div>
        )}

        {!loading && agents.length > 0 && (
          <div className="mt-6 bg-card border border-border-strong rounded-2xl p-5">
            <SectionTitle>Set all agents at once</SectionTitle>
            <SectionDescription className="mt-1">Useful when a model is deprecated — move every agent to a new model in one click. Each agent still gets its own rollback version.</SectionDescription>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={bulkModel}
                onChange={(e) => setBulkModel(e.target.value)}
                disabled={bulkBusy}
                className="bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
              >
                <option value="">Choose a model…</option>
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <Button variant="default" disabled={!bulkModel || bulkBusy} onClick={() => void applyToAll()}>
                {bulkBusy ? 'Applying…' : 'Apply to all agents'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-muted-foreground">Loading agents…</p>
        ) : (
          <div className="mt-6 space-y-3">
            {agents.map((agent) => {
              const changed = (selections[agent.id] ?? agent.currentModel) !== agent.currentModel;
              return (
                <div key={agent.id} className="bg-card border border-border-strong rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{agent.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-muted-foreground">{agent.kind}</span>
                        {agent.version !== null && <span className="text-xs text-muted-foreground">v{agent.version}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {agent.id}{!agent.hasGoldenMaster && ' · no profile yet (cannot change)'}
                      </div>
                    </div>
                    <select
                      value={selections[agent.id] ?? agent.currentModel}
                      onChange={(e) => setSelections((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                      disabled={!agent.hasGoldenMaster || savingId === agent.id}
                      className="bg-background border border-border-strong rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-50"
                    >
                      {!availableModels.includes(agent.currentModel) && (
                        <option value={agent.currentModel}>{agent.currentModel} (current)</option>
                      )}
                      {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <Button
                      variant="default"
                      disabled={!changed || !agent.hasGoldenMaster || savingId === agent.id}
                      onClick={() => void changeModel(agent.id)}
                    >
                      {savingId === agent.id ? 'Saving…' : 'Apply'}
                    </Button>
                    <Button variant="outline" disabled={!agent.hasGoldenMaster} onClick={() => void openHistory(agent.id)}>
                      {historyFor === agent.id ? 'Hide history' : 'History'}
                    </Button>
                  </div>

                  {historyFor === agent.id && (
                    <div className="mt-4 border-t border-border pt-4">
                      {historyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading history…</p>
                      ) : (
                        <div className="space-y-2">
                          {history.length === 0 && <p className="text-sm text-muted-foreground">No version history.</p>}
                          {history.map((v) => (
                            <div key={v.version} className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground w-10">v{v.version}</span>
                              <span className="font-mono text-foreground flex-1">{v.model}</span>
                              {v.isActive ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-600">active</span>
                              ) : (
                                <Button variant="outline" size="sm" disabled={savingId === agent.id} onClick={() => void rollback(agent.id, v.version)}>
                                  Roll back to v{v.version}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
