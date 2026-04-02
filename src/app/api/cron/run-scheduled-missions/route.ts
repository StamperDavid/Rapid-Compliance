/**
 * Run Scheduled Missions — Cron Endpoint
 *
 * Queries Firestore for all active MissionSchedule documents whose nextRunAt
 * is at or before now, creates a queued mission for each one, then advances
 * the schedule via recordRun(). The mission is left in PENDING status so that
 * the next time the user opens Mission Control (or a background worker picks it
 * up) Jasper will execute the prompt.
 *
 * Recommended cron cadence: every 15 minutes.
 * Auth: CRON_SECRET bearer token validated by verifyCronAuth().
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { getSchedulesDue, recordRun } from '@/lib/orchestrator/mission-schedule-service';
import { createMission, type Mission } from '@/lib/orchestrator/mission-persistence';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/run-scheduled-missions
 *
 * For each due schedule: create a PENDING mission document and record the run.
 */
export async function GET(request: NextRequest) {
  const ROUTE = '/api/cron/run-scheduled-missions';

  try {
    const authError = verifyCronAuth(request, ROUTE);
    if (authError) { return authError; }

    logger.info('[ScheduledMissions] Cron started', { route: ROUTE });

    const dueSchedules = await getSchedulesDue();

    logger.info('[ScheduledMissions] Due schedules found', {
      count: dueSchedules.length,
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled missions due',
        queued: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results: Array<{ scheduleId: string; missionId: string; status: 'queued' | 'error' }> = [];

    for (const schedule of dueSchedules) {
      const missionId = `mission_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const mission: Mission = {
        missionId,
        conversationId: `cron_${schedule.id}`,
        status: 'PENDING',
        title: schedule.name,
        userPrompt: schedule.prompt,
        steps: [],
        createdAt: now,
        updatedAt: now,
      };

      try {
        await createMission(mission);
        const recorded = await recordRun(schedule.id, missionId);

        if (recorded) {
          results.push({ scheduleId: schedule.id, missionId, status: 'queued' });
          logger.info('[ScheduledMissions] Mission queued for schedule', {
            scheduleId: schedule.id,
            missionId,
            scheduleName: schedule.name,
          });
        } else {
          results.push({ scheduleId: schedule.id, missionId, status: 'error' });
          logger.warn('[ScheduledMissions] recordRun failed for schedule', {
            scheduleId: schedule.id,
            missionId,
          });
        }
      } catch (innerError) {
        results.push({ scheduleId: schedule.id, missionId, status: 'error' });
        logger.error(
          '[ScheduledMissions] Failed to queue mission for schedule',
          innerError instanceof Error ? innerError : new Error(String(innerError)),
          { scheduleId: schedule.id },
        );
      }
    }

    const queuedCount = results.filter((r) => r.status === 'queued').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    logger.info('[ScheduledMissions] Cron completed', {
      queued: queuedCount,
      errors: errorCount,
    });

    return NextResponse.json({
      success: true,
      message: `Queued ${queuedCount} scheduled mission(s)`,
      queued: queuedCount,
      errors: errorCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      '[ScheduledMissions] Cron failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return NextResponse.json(
      {
        error: 'Scheduled missions cron failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
