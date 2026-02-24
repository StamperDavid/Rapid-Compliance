/**
 * Mission SSE Streaming Endpoint — Real-time mission observation
 *
 * GET /api/orchestrator/missions/[missionId]/stream
 *
 * Uses Firestore Admin SDK onSnapshot() to push mission changes
 * as Server-Sent Events. Replaces 5s polling with sub-second updates.
 *
 * Events:
 *   step_added     — A new step was appended
 *   step_updated   — An existing step changed status/result
 *   mission_status — Mission-level status change
 *   heartbeat      — Keep-alive (every 15s)
 *
 * @module api/orchestrator/missions/[missionId]/stream
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max (Vercel Pro)

function missionsCollectionPath(): string {
  return getSubCollection('missions');
}

/** Encode a single SSE event */
function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { missionId } = await params;

  if (!missionId) {
    return NextResponse.json(
      { success: false, error: 'missionId is required' },
      { status: 400 }
    );
  }

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore not available' },
      { status: 503 }
    );
  }

  const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);

  // Verify mission exists before opening stream
  const initialDoc = await docRef.get();
  if (!initialDoc.exists) {
    return NextResponse.json(
      { success: false, error: 'Mission not found' },
      { status: 404 }
    );
  }

  let previousSteps: MissionStep[] = (initialDoc.data() as Mission).steps ?? [];
  let previousStatus = (initialDoc.data() as Mission).status;
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const enqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Stream already closed
        }
      };

      // Send initial state
      enqueue(sseEvent('mission_status', {
        status: previousStatus,
        stepCount: previousSteps.length,
      }));

      // Send all existing steps as initial data
      for (const step of previousSteps) {
        enqueue(sseEvent('step_added', { step }));
      }

      // Listen for real-time changes
      unsubscribe = docRef.onSnapshot(
        (snapshot) => {
          if (!snapshot.exists) {
            enqueue(sseEvent('mission_status', { status: 'DELETED' }));
            return;
          }

          const mission = snapshot.data() as Mission;
          const currentSteps = mission.steps ?? [];

          // Detect status change
          if (mission.status !== previousStatus) {
            enqueue(sseEvent('mission_status', {
              status: mission.status,
              completedAt: mission.completedAt,
            }));
            previousStatus = mission.status;
          }

          // Detect new steps (appended beyond previous length)
          if (currentSteps.length > previousSteps.length) {
            for (let i = previousSteps.length; i < currentSteps.length; i++) {
              enqueue(sseEvent('step_added', { step: currentSteps[i] }));
            }
          }

          // Detect updated steps (status/result changes on existing steps)
          const minLen = Math.min(previousSteps.length, currentSteps.length);
          for (let i = 0; i < minLen; i++) {
            const prev = previousSteps[i];
            const curr = currentSteps[i];
            if (
              prev.status !== curr.status ||
              prev.summary !== curr.summary ||
              prev.error !== curr.error ||
              prev.toolArgs !== curr.toolArgs ||
              prev.toolResult !== curr.toolResult ||
              prev.durationMs !== curr.durationMs
            ) {
              enqueue(sseEvent('step_updated', {
                stepId: curr.stepId,
                updates: {
                  status: curr.status,
                  completedAt: curr.completedAt,
                  durationMs: curr.durationMs,
                  summary: curr.summary,
                  error: curr.error,
                  toolArgs: curr.toolArgs,
                  toolResult: curr.toolResult,
                },
              }));
            }
          }

          previousSteps = currentSteps;
        },
        (error) => {
          logger.error('[MissionStream] onSnapshot error', error instanceof Error ? error : undefined, {
            missionId,
          });
          enqueue(sseEvent('error', { message: 'Snapshot listener failed' }));
        }
      );

      // Heartbeat every 15s
      heartbeatTimer = setInterval(() => {
        enqueue(sseEvent('heartbeat', { ts: Date.now() }));
      }, 15_000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },

    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
