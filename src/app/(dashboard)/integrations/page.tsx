'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /integrations -> /settings/integrations
 * The settings version has proper per-provider OAuth components.
 */
export default function IntegrationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/integrations');
  }, [router]);

  return null;
}
