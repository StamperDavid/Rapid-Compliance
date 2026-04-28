'use client';

/**
 * Site-wide top banner that pitches the early-access list across every public
 * page. Stacks ABOVE the existing nav. Dismissible (state persisted in
 * localStorage) and self-suppresses on `/early-access` itself so we don't pitch
 * the page someone is already on.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'salesvelocity-early-access-banner-dismissed';

export default function EarlyAccessBanner() {
  const pathname = usePathname();
  // Mounted gate avoids a hydration mismatch — localStorage is client-only,
  // so the first render must match the SSR output (banner shown).
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // localStorage can throw in private-browsing / sandboxed iframes — fail open.
    }
  }, []);

  // Publish banner height as a CSS variable so the nav (and any other fixed
  // top-anchored element) can offset itself to sit immediately below.
  useEffect(() => {
    if (typeof document === 'undefined') {return;}
    const visible = !dismissed && pathname !== '/early-access';
    document.documentElement.style.setProperty(
      '--early-access-banner-h',
      visible ? '44px' : '0px'
    );
    return () => {
      document.documentElement.style.setProperty('--early-access-banner-h', '0px');
    };
  }, [dismissed, pathname]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, '1');
      }
    } catch {
      // Ignore storage failures — user just won't get persistence.
    }
  };

  // Don't pitch the page someone is already on.
  if (pathname === '/early-access') {
    return null;
  }

  if (mounted && dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        {/* Mobile copy (sm and below) */}
        <div className="flex items-center gap-2 text-sm font-medium sm:hidden flex-1 min-w-0">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Launching soon</span>
          <Link
            href="/early-access"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition flex-shrink-0"
          >
            Get early access
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Desktop copy */}
        <div className="hidden sm:flex items-center gap-3 text-sm md:text-base flex-1 min-w-0">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            <span className="font-semibold">SalesVelocity.ai is launching soon</span>
            <span className="opacity-90"> &mdash; Early access list members get skip-the-line priority onboarding when we open the doors.</span>
          </span>
          <Link
            href="/early-access"
            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition flex-shrink-0"
          >
            Reserve my spot
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/15 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
