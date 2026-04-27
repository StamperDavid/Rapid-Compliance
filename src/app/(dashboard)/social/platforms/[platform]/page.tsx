'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { PLATFORM_META } from '@/lib/social/platform-config';
import PlatformDashboard from '@/components/social/PlatformDashboard';
import type { SocialPlatform } from '@/types/social';

export default function PlatformPage() {
  const params = useParams();
  const router = useRouter();
  const platform = params.platform as string;

  const meta = PLATFORM_META[platform as SocialPlatform];

  if (!meta) {
    return (
      <div className="p-8">
        <PageTitle>Platform not found</PageTitle>
        <SectionDescription>
          &ldquo;{platform}&rdquo; is not a supported platform.{' '}
          <button
            onClick={() => router.push('/social')}
            className="text-primary underline"
          >
            Back to Social Hub
          </button>
        </SectionDescription>
      </div>
    );
  }

  return <PlatformDashboard platform={platform as SocialPlatform} />;
}
