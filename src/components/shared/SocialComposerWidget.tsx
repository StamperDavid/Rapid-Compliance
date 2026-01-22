'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SocialComposerWidgetProps {
  compact?: boolean;
}

export function SocialComposerWidget({ compact = false }: SocialComposerWidgetProps) {
  const [tweetContent, setTweetContent] = useState('');
  const [linkedInContent, setLinkedInContent] = useState('');

  if (compact) {
    return (
      <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Social Composer</h3>
          <Link href="/admin/social" className="text-sm text-[var(--color-primary)] hover:underline">
            Full Editor
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">X</span>
              <span className="text-sm text-[var(--color-text-secondary)]">Twitter/X</span>
            </div>
            <textarea
              value={tweetContent}
              onChange={(e) => setTweetContent(e.target.value)}
              placeholder="Quick tweet..."
              maxLength={280}
              className="w-full h-20 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] resize-none text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-xs ${tweetContent.length > 260 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'}`}>
                {tweetContent.length}/280
              </span>
              <button
                disabled={!tweetContent.trim()}
                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg text-[#0a66c2]">in</span>
              <span className="text-sm text-[var(--color-text-secondary)]">LinkedIn</span>
            </div>
            <textarea
              value={linkedInContent}
              onChange={(e) => setLinkedInContent(e.target.value)}
              placeholder="Share an update..."
              maxLength={700}
              className="w-full h-20 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] resize-none text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-xs ${linkedInContent.length > 650 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'}`}>
                {linkedInContent.length}/700
              </span>
              <button
                disabled={!linkedInContent.trim()}
                className="px-3 py-1.5 bg-[#0a66c2] text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Social Composer</h3>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Compose and schedule posts across multiple platforms.
      </p>
    </div>
  );
}
