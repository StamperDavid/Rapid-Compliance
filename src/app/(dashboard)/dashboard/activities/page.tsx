import { redirect } from 'next/navigation';

/**
 * Consolidated Jun 29 2026: there is now ONE Activities page — the fuller
 * /activities (filter tabs, "load more" paging, clickable entity links, retry).
 * This former thinner copy was deleted; it forwards to /activities so the
 * Dashboard "Activities" tab and any old links still land on the real page.
 */
export default function DashboardActivitiesRedirect(): never {
  redirect('/activities');
}
