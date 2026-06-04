/**
 * Master kill-switch for autonomous automation execution — scheduled/triggered
 * workflows and email sequences.
 *
 * WHY THIS EXISTS: those engines were silently non-functional for a long time
 * (they used the client Firebase SDK on the server, so every read came back
 * empty and nothing ran). They are being converted to the Admin SDK so they
 * actually work — which means the moment they work they could fire a BACKLOG
 * of dormant automations (real emails, real record changes) all at once.
 *
 * This gate keeps autonomous execution OFF until an operator explicitly turns
 * it on AFTER previewing what is queued. The cron entry points check this and
 * no-op when it is off.
 *
 * Default: OFF. To enable, set the environment variable AUTOMATIONS_ENABLED=true.
 */
export function areAutomationsEnabled(): boolean {
  return process.env.AUTOMATIONS_ENABLED === 'true';
}
