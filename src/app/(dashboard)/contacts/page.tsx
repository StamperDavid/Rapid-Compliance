'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /contacts -> /crm?view=contacts
 * The CRM page has a unified contacts tab with the same functionality.
 */
export default function ContactsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/crm?view=contacts');
  }, [router]);

  return null;
}
