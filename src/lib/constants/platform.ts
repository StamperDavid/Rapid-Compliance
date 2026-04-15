/**
 * Platform-level configuration and utilities
 * @module lib/constants/platform
 *
 * SalesVelocity.ai — Single-tenant platform (Penthouse Model)
 * There is NO multi-tenant/org layer. This file defines the platform root identity.
 */

/**
 * Platform root identifier used as the Firestore document root.
 * This is the single identity for the entire SalesVelocity.ai platform.
 */
export const PLATFORM_ID = 'rapid-compliance-root' as const;


/**
 * Platform AI assistant name.
 * Single-tenant — the assistant is always Jasper. No per-org customization.
 */
export const ASSISTANT_NAME = 'Jasper' as const;

/**
 * Platform company configuration
 */
export const COMPANY_CONFIG = {
  id: PLATFORM_ID,
  name: 'SalesVelocity.ai',
} as const;

// ============================================================================
// LEGACY_MISSION_EXECUTION_MODEL — temporary compatibility switch (M3)
// ============================================================================
//
// READ THIS WHOLE COMMENT BEFORE FLIPPING THE SWITCH OR DELETING IT.
//
// WHAT IT DOES
// ------------
// Controls how `POST /api/orchestrator/missions/[id]/plan/approve` runs the
// approved steps of a mission plan that the operator drafted via the M4
// `propose_mission_plan` Jasper tool.
//
//   true  (legacy)      — runs every approved step inline, sequentially,
//                         all the way to mission completion. The operator
//                         clicks "Approve plan" once and walks away. This
//                         was the M4 → M3 bridge — it shipped with M4 so
//                         M4 was testable end-to-end, but it does NOT pause
//                         between steps.
//
//   false (new path)    — runs ONLY the first proposed step, then parks
//                         that step in AWAITING_APPROVAL status and returns.
//                         Each subsequent step runs only after the operator
//                         clicks Approve on the previous step's result via
//                         POST /api/orchestrator/missions/[id]/steps/[stepId]/approve.
//                         This is the M3 per-step pause behavior.
//
// CURRENT DEFAULT
// ---------------
// `false` — new per-step pause path is the production behavior. The
// legacy bridge is kept around for one full release cycle so we have a
// rollback if M3 reveals bugs in production traffic.
//
// HOW TO ROLL BACK TO THE BRIDGE
// ------------------------------
// Set the constant below to `true` in this file (no env var, no DB config —
// keep the rollback path obvious so anyone debugging at 2am can find it
// in 30 seconds via a single search).
//
// HOW TO REMOVE THIS SWITCH PERMANENTLY (the goal)
// ------------------------------------------------
// Once M3 has run for ~2 weeks in production with no rollbacks needed:
//   1. grep the codebase for LEGACY_MISSION_EXECUTION_MODEL — every
//      reference must be removed in the same commit.
//   2. Delete the legacy branch in /plan/approve (the inline sequential
//      executeToolCall loop with the "M4 → M3 BRIDGE" comment block).
//   3. Delete this constant from this file.
//   4. Delete this whole comment block.
//   5. Update CONTINUATION_PROMPT.md and SSOT to note the bridge is gone.
//
// ALL FIVE STEPS IN ONE COMMIT — half-removed switches are worse than
// fully present switches because future readers won't know which branch
// is real.
//
// USED BY
// -------
// - src/app/api/orchestrator/missions/[missionId]/plan/approve/route.ts
//   (the only consumer — branches on this constant to pick old vs new
//   execution path)
//
// HISTORY
// -------
// Added 2026-04-15 as part of M3. Owner explicitly requested this switch
// with heavy notation so the migration could be rolled back cleanly. If
// you are reading this in 2027 and the switch is still here, ask why.
//
// ============================================================================
export const LEGACY_MISSION_EXECUTION_MODEL = false as const;
