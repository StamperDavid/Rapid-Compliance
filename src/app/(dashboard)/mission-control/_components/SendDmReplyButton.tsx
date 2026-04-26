'use client';

/**
 * SendDmReplyButton
 *
 * Inline "Send reply" affordance for inbound-DM-reply missions. Renders
 * only when:
 *   - the mission's `sourceEvent.kind === 'inbound_x_dm'`
 *   - the step is a COMPLETED `delegate_to_marketing` whose toolResult
 *     parses to `{ composedReply: { replyText, ... } }`
 *
 * Click → POST /api/orchestrator/missions/[id]/send-dm-reply, which
 * dispatches the reply via the X DM API and marks the source
 * inboundSocialEvents doc processed.
 *
 * After a successful send, the button shows the X DM message id and
 * disables itself so the operator does not double-send. Reload the
 * mission to see the updated state.
 */

import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger/logger';

const FILE = 'mission-control/SendDmReplyButton.tsx';

interface SendDmReplyButtonProps {
  missionId: string;
  /** Pre-computed reply text from the step's composedReply, for display + override */
  composedReply: string;
  /** Sender handle (display only) */
  senderHandle?: string;
}

interface SendResponse {
  success: boolean;
  messageId?: string;
  replyText?: string;
  error?: string;
}

export function SendDmReplyButton({
  missionId,
  composedReply,
  senderHandle,
}: SendDmReplyButtonProps): React.JSX.Element {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(composedReply);
  const [sending, setSending] = useState(false);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);

  const handleSend = async (): Promise<void> => {
    setSending(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { toast.error('Authentication required'); return; }

      const body: { replyText?: string } = {};
      if (editing && draft.trim() !== composedReply.trim()) {
        body.replyText = draft.trim();
      }

      const resp = await fetch(`/api/orchestrator/missions/${encodeURIComponent(missionId)}/send-dm-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as SendResponse;

      if (resp.ok && json.success) {
        setSentMessageId(json.messageId ?? '(no id returned)');
        toast.success(senderHandle
          ? `Reply sent to ${senderHandle}`
          : 'Reply sent on X');
      } else {
        toast.error(json.error ?? 'Failed to send reply');
      }
    } catch (err) {
      logger.error('SendDmReplyButton send failed', err instanceof Error ? err : new Error(String(err)), { file: FILE, missionId });
      toast.error('Network error while sending reply');
    } finally {
      setSending(false);
    }
  };

  if (sentMessageId !== null) {
    return (
      <div className="mt-3 p-3 rounded-md border border-border-light bg-surface-elevated text-xs">
        <span className="font-semibold text-foreground">Reply sent.</span>{' '}
        <span className="text-muted-foreground">X DM event id: {sentMessageId}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Composed reply{senderHandle ? ` to ${senderHandle}` : ''}
      </div>
      {editing ? (
        <textarea
          className="w-full rounded-md border border-border-light bg-card px-3 py-2 text-sm text-foreground"
          rows={3}
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
        />
      ) : (
        <div className="rounded-md border border-border-light bg-surface-elevated px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
          {composedReply}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => { void handleSend(); }}
          disabled={sending || (editing && draft.trim().length === 0) || (editing && draft.length > 500)}
        >
          {sending ? 'Sending…' : 'Send reply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (editing) { setDraft(composedReply); }
            setEditing((prev) => !prev);
          }}
          disabled={sending}
        >
          {editing ? 'Cancel edit' : 'Edit before sending'}
        </Button>
        {editing && (
          <span className="text-xs text-muted-foreground">{draft.length} / 500</span>
        )}
      </div>
    </div>
  );
}
