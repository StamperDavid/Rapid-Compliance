'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /website/seo/ai-search -> /website/seo
 * The AI bot access controls and robots.txt configuration are already on the SEO page.
 * The standalone AI search health dashboard was redundant with those settings.
 */
export default function AISearchRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/website/seo');
  }, [router]);

  return null;
}
