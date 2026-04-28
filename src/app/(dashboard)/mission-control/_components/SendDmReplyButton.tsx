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

/** 200 success shape */
interface SendSuccessResponse {
  success: true;
  messageId?: string;
  replyText?: string;
}

/** 409 already_sent shape returned by the idempotency guard */
interface AlreadySentResponse {
  ok: false;
  reason: 'already_sent';
  sentAt: string;
  messageId: string | null;
}

/** Generic failure shape */
interface SendFailureResponse {
  success?: false;
  error?: string;
}

type SendResponse = SendSuccessResponse | AlreadySentResponse | SendFailureResponse;

export function SendDmReplyButton({
  missionId,
  composedReply,
  senderHandle,
}: SendDmReplyButtonProps): React.JSX.Element {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(composedReply);
  // sending=true disables the button immediately on first click, preventing
  // a double-click race from reaching the server twice.
  const [sending, setSending] = useState(false);
  // Set to the messageId string on a successful send — triggers the "Sent" UI.
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  // Set when the server's idempotency guard returns 409 already_sent.
  const [alreadySentAt, setAlreadySentAt] = useState<string | null>(null);

  const handleSend = async (): Promise<void> => {
    // Disable immediately — React state update is synchronous before the
    // first await, so a second click while the first fetch is in-flight
    // will see sending=true and be blocked by the disabled prop.
    setSending(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error('Authentication required');
        setSending(false);
        return;
      }

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

      if (resp.ok && 'success' in json && json.success === true) {
        // Successful send — lock the button forever.
        setSentMessageId(json.messageId ?? '(no id returned)');
        toast.success(senderHandle
          ? `Reply sent to ${senderHandle}`
          : 'Reply sent');
        // Leave sending=true — the sentMessageId branch replaces the button anyway.
        return;
      }

      if (resp.status === 409 && 'reason' in json && json.reason === 'already_sent') {
        // Server idempotency guard fired — show a permanent "Already sent" notice.
        setAlreadySentAt(json.sentAt);
        toast.error('This reply was already sent — duplicate blocked.');
        // Leave sending=true so button stays disabled permanently.
        return;
      }

      // All other failures — re-enable so the operator can retry.
      const errorMsg = 'error' in json ? json.error : undefined;
      toast.error(errorMsg ?? 'Failed to send reply');
      setSending(false);
    } catch (err) {
      logger.error('SendDmReplyButton send failed', err instanceof Error ? err : new Error(String(err)), { file: FILE, missionId });
      toast.error('Network error while sending reply');
      setSending(false);
    }
  };

  // ── Terminal states (button replaced entirely) ────────────────────────────

  if (sentMessageId !== null) {
    return (
      <div className="mt-3 p-3 rounded-md border border-border-light bg-surface-elevated text-xs">
        <span className="font-semibold text-foreground">Reply sent.</span>{' '}
        <span className="text-muted-foreground">DM message id: {sentMessageId}</span>
      </div>
    );
  }

  if (alreadySentAt !== null) {
    const formatted = (() => {
      try { return new Date(alreadySentAt).toLocaleString(); } catch { return alreadySentAt; }
    })();
    return (
      <div className="mt-3 p-3 rounded-md border border-amber-300 bg-amber-50 text-xs">
        <span className="font-semibold text-amber-800">Already sent</span>{' '}
        <span className="text-amber-700">at {formatted}.</span>
      </div>
    );
  }

  // ── Interactive state ─────────────────────────────────────────────────────

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
