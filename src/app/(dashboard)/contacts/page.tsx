'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /contacts -> /entities/contacts
 * The generic entity page handles contact display with full CRUD.
 */
export default function ContactsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/entities/contacts');
  }, [router]);

  return null;
}
