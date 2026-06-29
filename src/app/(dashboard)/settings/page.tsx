import { redirect } from 'next/navigation';

/**
 * Retired Jun 29 2026: the old Settings landing page (a card grid that just
 * duplicated links now living in the main navigation menu) is gone. Every former
 * settings sub-page is reachable directly from the nav. This forwards to the
 * dashboard so any older "Settings" link doesn't dead-end.
 */
export default function SettingsRedirect(): never {
  redirect('/dashboard');
}
