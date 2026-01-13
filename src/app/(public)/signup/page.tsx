'use client';

/**
 * Signup Page - Redirects to new onboarding flow
 *
 * The old plan-first signup flow has been replaced with an industry-first
 * onboarding flow. This page redirects users to the new flow for backwards
 * compatibility with existing bookmarks/links.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new industry-first onboarding flow
    router.replace('/onboarding/industry');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
        <p className="text-slate-400">Redirecting to onboarding...</p>
      </div>
    </div>
  );
}
