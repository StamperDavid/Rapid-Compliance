/**
 * useMissionStream — Real-time SSE streaming hook for Mission Control
 *
 * Uses fetch() with ReadableStream to consume SSE events from the
 * mission streaming endpoint. Supports auth headers (unlike EventSource).
 * Falls back to polling on connection failure.
 *
 * @module hooks/useMissionStream
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUnifiedAuth } from './useUnifiedAuth';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

interface UseMissionStreamResult {
  mission: Mission | null;
  isStreaming: boolean;
  error: string | null;
}

/** Parse a single SSE frame into event name + JSON data */
function parseSSE(raw: string): { event: string; data: string } | null {
  let event = '';
  let data = '';

  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) {
      event = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      data = line.slice(6).trim();
    }
  }

  if (!event || !data) {
    return null;
  }
  return { event, data };
}

export function useMissionStream(missionId: string | null): UseMissionStreamResult {
  const { getIdToken } = useUnifiedAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async (id: string) => {
    // Abort any existing connection
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/orchestrator/missions/${id}/stream`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        setError(`Stream failed: ${response.status}`);
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError('Stream body unavailable');
        setIsStreaming(false);
        return;
      }

      setIsStreaming(true);
      setError(null);

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by double newlines
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          if (!frame.trim()) { continue; }

          const parsed = parseSSE(frame);
          if (!parsed) { continue; }

          switch (parsed.event) {
            case 'mission_status': {
              const payload = JSON.parse(parsed.data) as {
                status: Mission['status'];
                completedAt?: string;
                stepCount?: number;
              };
              setMission((prev) => {
                if (!prev) {
                  // First event — create skeleton mission
                  return {
                    missionId: id,
                    conversationId: '',
                    status: payload.status,
                    title: '',
                    userPrompt: '',
                    steps: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    completedAt: payload.completedAt,
                  };
                }
                return {
                  ...prev,
                  status: payload.status,
                  completedAt: payload.completedAt ?? prev.completedAt,
                  updatedAt: new Date().toISOString(),
                };
              });
              break;
            }

            case 'step_added': {
              const payload = JSON.parse(parsed.data) as { step: MissionStep };
              setMission((prev) => {
                if (!prev) { return prev; }
                // Avoid duplicates
                const exists = prev.steps.some((s) => s.stepId === payload.step.stepId);
                if (exists) { return prev; }
                return {
                  ...prev,
                  steps: [...prev.steps, payload.step],
                  updatedAt: new Date().toISOString(),
                };
              });
              break;
            }

            case 'step_updated': {
              const payload = JSON.parse(parsed.data) as {
                stepId: string;
                updates: Partial<MissionStep>;
              };
              setMission((prev) => {
                if (!prev) { return prev; }
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepId === payload.stepId ? { ...s, ...payload.updates } : s
                  ),
                  updatedAt: new Date().toISOString(),
                };
              });
              break;
            }

            case 'heartbeat':
              // Connection alive — no action needed
              break;

            case 'error': {
              const payload = JSON.parse(parsed.data) as { message: string };
              setError(payload.message);
              break;
            }
          }
        }
      }

      // Stream ended cleanly (mission might be complete)
      setIsStreaming(false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Intentional disconnect
        return;
      }

      const msg = err instanceof Error ? err.message : 'Stream connection failed';
      setError(msg);
      setIsStreaming(false);

      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(() => {
        void connect(id);
      }, 3000);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (!missionId) {
      setMission(null);
      setIsStreaming(false);
      setError(null);
      return;
    }

    void connect(missionId);

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [missionId, connect]);

  return { mission, isStreaming, error };
}
