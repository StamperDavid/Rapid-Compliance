import { redirect } from 'next/navigation';

/**
 * Consolidated Jun 29 2026: there is now ONE Tasks page — the CRM /tasks surface
 * (reminder queues: overdue / due today / upcoming, plus create / complete /
 * reassign / delete). This former flat team-task list was deleted; it forwards to
 * /tasks so the Team "Tasks" tab and any old links still land on the real page.
 */
export default function TeamTasksRedirect(): never {
  redirect('/tasks');
}
