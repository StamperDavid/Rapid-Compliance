import { redirect } from 'next/navigation';

/**
 * Command Center Redirect
 * This route has been deprecated - redirects to the main admin hub
 * @deprecated Use /admin instead
 */
export default function CommandCenterPage() {
  redirect('/admin');
}
