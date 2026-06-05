'use client';

/**
 * Content Assistant — slide-in conversational panel for the content studio.
 *
 * A content-scoped creative director (NOT the global Jasper assistant). It lives
 * on every content-generator tab and talks the operator through what they want
 * to create — image, video, music, or text — proposing ideas and asking the
 * clarifying questions a client wouldn't think of, in the tenant's brand voice.
 *
 * v1 is conversation only. It POSTs the running message history + the current
 * tab to /api/content/assistant and appends the reply. Structured-field filling
 * and tool hand-off come in later increments.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, Send, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hey — I'm your creative director. Tell me what you're trying to make and I'll help you shape it. Even a rough idea works: who's it for, where will it live, what feeling should it leave behind?",
};

export function ContentAssistant() {
  const pathname = usePathname();
  const authFetch = useAuthFetch();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      // Drop the canned welcome before sending — it isn't real conversation.
      const history = nextMessages.filter((m) => m !== WELCOME);

      const res = await authFetch('/api/content/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, activeTab: pathname }),
      });

      const data = (await res.json()) as { success: boolean; reply?: string; error?: string };

      if (!res.ok || !data.success || !data.reply) {
        throw new Error(data.error ?? 'The assistant could not respond.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, authFetch, pathname]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  return (
    <>
      {/* Floating toggle — bottom-right of the content area, offset from Jasper's
          global bubble so the two never overlap. */}
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-24 z-40 h-12 gap-2 rounded-full shadow-lg"
          aria-label="Open the Content Assistant"
        >
          <Sparkles className="h-4 w-4" />
          Content Assistant
        </Button>
      )}

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
        aria-hidden={!open}
        role="complementary"
        aria-label="Content Assistant"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SectionTitle className="text-base">Content Assistant</SectionTitle>
              <SectionDescription className="text-xs">
                Your creative director — let&apos;s shape what you want to make.
              </SectionDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close the Content Assistant"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-elevated text-foreground',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm text-muted-foreground">
                Thinking&hellip;
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Describe what you want to create…"
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={loading || input.trim().length === 0}
              aria-label="Send message"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <Caption className="mt-2 flex items-center gap-1.5">
            <MessageSquarePlus className="h-3 w-3" />
            v1 conversation only — idea shaping. Tool hand-off is coming.
          </Caption>
        </div>
      </div>
    </>
  );
}

export default ContentAssistant;
