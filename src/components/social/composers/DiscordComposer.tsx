'use client';

/**
 * DiscordComposer — Native Discord composer.
 *
 * - `message`: 2000 char limit (Discord's hard ceiling) with countdown.
 * - Channel picker: dropdown sourced from `/api/social/discord/channels`.
 *   The channel id is stored in metadata.channelId (and channel name in
 *   metadata.channelName for display). The /api route is built in a
 *   follow-up session — this composer just consumes its shape.
 */

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_MESSAGE = 2000;
const meta = PLATFORM_META.discord;

interface DiscordChannelOption {
  id: string;
  name: string;
  /** Discord channel type (0=text, 5=announcement, 15=forum). */
  type: number;
}

interface ChannelsApiResponse {
  channels?: DiscordChannelOption[];
  error?: string;
}

export function DiscordComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const countdownColor = useCharCountdownColor(value.content.length, MAX_MESSAGE);

  const [channels, setChannels] = React.useState<DiscordChannelOption[]>([]);
  const [channelsLoading, setChannelsLoading] = React.useState(true);
  const [channelsError, setChannelsError] = React.useState<string | null>(null);

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    onChange({
      ...value,
      metadata: {
        ...value.metadata,
        channelId,
        channelName: channel?.name ?? '',
      },
    });
  };

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setChannelsLoading(true);
      setChannelsError(null);
      try {
        const res = await authFetch('/api/social/discord/channels');
        if (!res.ok) {
          if (!cancelled) {
            setChannelsError(`Could not load channels (HTTP ${res.status})`);
            setChannels([]);
          }
          return;
        }
        const data = (await res.json()) as ChannelsApiResponse;
        if (cancelled) { return; }
        setChannels(Array.isArray(data.channels) ? data.channels : []);
      } catch {
        if (!cancelled) {
          setChannelsError('Could not load channels — check your connection.');
          setChannels([]);
        }
      } finally {
        if (!cancelled) { setChannelsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  const selectedChannelId = value.metadata.channelId ?? '';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="discord-channel">
          Channel <span className="text-destructive">*</span>
        </label>
        <select
          id="discord-channel"
          value={selectedChannelId}
          onChange={(e) => handleChannelChange(e.target.value)}
          disabled={disabled || channelsLoading}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ borderColor: meta.color }}
        >
          <option value="">
            {channelsLoading ? 'Loading channels…' : 'Select a channel'}
          </option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
              {c.type === 5 ? ' (announcements)' : c.type === 15 ? ' (forum)' : ''}
            </option>
          ))}
        </select>
        {channelsError && (
          <p className="mt-1 text-xs text-destructive">{channelsError}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="discord-message">
          Message
        </label>
        <div className="relative mt-1">
          <Textarea
            id="discord-message"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to share with the community? (2000 chars max — Markdown supported)"
            rows={8}
            maxLength={MAX_MESSAGE}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
            {MAX_MESSAGE - value.content.length}
          </div>
        </div>
      </div>

    </div>
  );
}

export default DiscordComposer;
