'use client';

/**
 * MastodonComposer — Native Mastodon composer.
 *
 * - `post`: 500 char limit + countdown
 * - Visibility selector: Public / Unlisted / Followers / Direct
 *   (stored in metadata.visibility)
 */

import * as React from 'react';
import { Globe, LockOpen, Lock, Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_POST = 500;
const meta = PLATFORM_META.mastodon;

const VISIBILITY_OPTIONS: Array<{
  value: string;
  label: string;
  Icon: typeof Globe;
}> = [
  { value: 'public', label: 'Public', Icon: Globe },
  { value: 'unlisted', label: 'Unlisted', Icon: LockOpen },
  { value: 'followers', label: 'Followers only', Icon: Lock },
  { value: 'direct', label: 'Direct', Icon: Mail },
];

export function MastodonComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const countdownColor = useCharCountdownColor(value.content.length, MAX_POST);
  const visibility = value.metadata.visibility ?? 'public';

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setVisibility = (next: string) => {
    onChange({ ...value, metadata: { ...value.metadata, visibility: next } });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          maxLength={MAX_POST}
          disabled={disabled}
          className="resize-none pr-16"
          style={{ borderColor: meta.color }}
        />
        <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
          {MAX_POST - value.content.length}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="mastodon-visibility">
          Visibility
        </label>
        <select
          id="mastodon-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground mt-1">
          {visibility === 'public' && 'Visible everywhere — federated timeline + your profile.'}
          {visibility === 'unlisted' && 'Visible on your profile, hidden from federated timeline.'}
          {visibility === 'followers' && 'Only your followers can see this toot.'}
          {visibility === 'direct' && 'Only mentioned users see this toot.'}
        </div>
      </div>
    </div>
  );
}

export default MastodonComposer;
