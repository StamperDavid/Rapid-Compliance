'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect: /scraper → /leads/research
 * Scraper is now part of the consolidated Lead Research page.
 */
export default function ScraperRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/leads/research'); }, [router]);
  return null;
}
