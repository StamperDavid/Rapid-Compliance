'use client';

/**
 * ContactDraftEmail
 *
 * AI-forward CRM action (benchmark: Reevo). A "Draft email" button on a contact
 * record that asks the real email-writer engine for a personalized draft, shows
 * it in editable fields, and lets the operator send it via the live email send
 * endpoint — all without leaving the contact record.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Caption } from '@/components/ui/typography';
import { Mail, Sparkles, Loader2 } from 'lucide-react';

interface ContactDraftEmailProps {
  contactId: string;
  contactEmail?: string;
  contactName?: string;
}

interface DraftResponse {
  success: boolean;
  subject?: string;
  body?: string;
  error?: string;
}

interface SendResponse {
  success: boolean;
  error?: string;
}

/** Get the Authorization header with the current user's Firebase ID token. */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getCurrentUser } = await import('@/lib/auth/auth-service');
  const user = getCurrentUser();
  if (!user) {
    throw new Error('You need to be signed in to do that.');
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/** Convert plain-text body to a minimal HTML body for the send endpoint. */
function bodyToHtml(text: string): string {
  const paragraphs = text
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${paragraphs}</div>`;
}

export function ContactDraftEmail({
  contactId,
  contactEmail,
  contactName,
}: ContactDraftEmailProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [isDrafting, setIsDrafting] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const hasEmail = typeof contactEmail === 'string' && contactEmail.trim() !== '';

  const draftEmail = React.useCallback(async () => {
    setIsDrafting(true);
    setError(null);
    setSent(false);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/crm/contacts/${encodeURIComponent(contactId)}/draft-email`,
        { method: 'POST', headers }
      );
      const data = (await response.json()) as DraftResponse;
      if (!response.ok || !data.success) {
        setError(data.error ?? 'The AI could not draft an email. Please try again.');
        return;
      }
      setSubject(data.subject ?? '');
      setBody(data.body ?? '');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while drafting. Please try again.'
      );
    } finally {
      setIsDrafting(false);
    }
  }, [contactId]);

  const handleOpen = React.useCallback(() => {
    setOpen(true);
    setSubject('');
    setBody('');
    setError(null);
    setSent(false);
    void draftEmail();
  }, [draftEmail]);

  const handleSend = React.useCallback(async () => {
    if (!hasEmail) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactEmail,
          subject,
          text: body,
          html: bodyToHtml(body),
          metadata: { contactId },
        }),
      });
      const data = (await response.json()) as SendResponse;
      if (!response.ok || !data.success) {
        setError(data.error ?? 'The email could not be sent. Please try again.');
        return;
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while sending. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  }, [hasEmail, contactEmail, subject, body, contactId]);

  const sendDisabled =
    !hasEmail || isSending || isDrafting || subject.trim() === '' || body.trim() === '';

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Sparkles className="mr-2 h-4 w-4" />
        Draft email
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draft an email with AI</DialogTitle>
            <DialogDescription>
              {typeof contactName === 'string' && contactName.trim() !== ''
                ? `A personalized draft for ${contactName}. Review and edit it before sending.`
                : 'A personalized draft for this contact. Review and edit it before sending.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!hasEmail && (
              <div className="rounded-lg border border-border-strong bg-surface-elevated p-3">
                <Caption className="text-muted-foreground">
                  This contact has no email address on file, so the draft can be edited
                  but not sent. Add an email address to the contact to send it.
                </Caption>
              </div>
            )}

            {isDrafting ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Writing a draft based on this contact&apos;s history&hellip;</span>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Caption className="text-muted-foreground">Subject</Caption>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>
                <div className="space-y-1.5">
                  <Caption className="text-muted-foreground">Message</Caption>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Email body"
                    rows={12}
                  />
                </div>
              </>
            )}

            {error !== null && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <Caption className="text-destructive">{error}</Caption>
              </div>
            )}

            {sent && (
              <div className="rounded-lg border border-success/40 bg-success/10 p-3">
                <Caption className="text-success">
                  Your email is on its way to {contactEmail}.
                </Caption>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => void draftEmail()}
              disabled={isDrafting || isSending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Redraft
            </Button>
            <Button onClick={() => void handleSend()} disabled={sendDisabled}>
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
