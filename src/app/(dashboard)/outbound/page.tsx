'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /outbound -> /email-writer
 * The outbound hub was a broken nav shell linking to non-existent routes.
 * The email writer + sequences are accessible via the Email Studio tabs.
 */
export default function OutboundRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/email-writer');
  }, [router]);

  return null;
}
