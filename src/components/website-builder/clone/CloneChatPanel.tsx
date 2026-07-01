/**
 * CloneChatPanel
 *
 * The "Website Agent — Clone mode" chat. A scrollable message list + an input.
 * Posts to `POST /api/website/clone/chat` with the running history and appends
 * the reply. Conversation lives entirely in local state. (Grading of cloned
 * pages happens in Mission Control, not here — this panel is chat only.)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTitle, SectionDescription } from '@/components/ui/typography';
import { logger } from '@/lib/logger/logger';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CloneChatResponse {
  success: boolean;
  reply: string;
  message?: string;
}

function isChatResponse(value: unknown): value is CloneChatResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { reply?: unknown }).reply === 'string'
  );
}

export function CloneChatPanel() {
  const authFetch = useAuthFetch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (text === '' || sending) {
      return;
    }
    setError('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setSending(true);

    try {
      const res = await authFetch('/api/website/clone/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok || !isChatResponse(json) || !json.success) {
        const detail =
          isChatResponse(json) && typeof json.message === 'string'
            ? json.message
            : `The agent could not reply (${res.status}).`;
        throw new Error(detail);
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: json.reply },
      ]);
    } catch (err) {
      logger.error(
        '[CloneChatPanel] Chat failed',
        err instanceof Error ? err : new Error(String(err)),
      );
      setError(err instanceof Error ? err.message : 'The agent could not reply.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-border-strong bg-card">
      <div className="border-b border-border-light px-4 py-3">
        <CardTitle>Website Agent — Clone mode</CardTitle>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !sending ? (
          <div className="flex h-full items-center justify-center text-center">
            <SectionDescription>
              Ask me to re-clone a page, fix a section, or explain a difference.
            </SectionDescription>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-elevated text-foreground'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface-elevated px-3 py-2 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error !== '' && (
        <div className="px-4">
          <SectionDescription className="text-destructive">{error}</SectionDescription>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-border-light px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the agent…"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={sending || draft.trim() === ''}>
          Send
        </Button>
      </form>
    </div>
  );
}

export default CloneChatPanel;
