'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /leads -> /entities/leads
 * The generic entity page handles lead display with full CRUD.
 */
export default function LeadsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/entities/leads');
  }, [router]);

  return null;
}
