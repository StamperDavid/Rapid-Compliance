'use client';

/**
 * ContactActivitySummary
 *
 * AI-forward CRM action (benchmark: Reevo "Summarize activity"). Renders a
 * "Summarize activity" button on a contact record. On click it POSTs to
 * /api/crm/contacts/[contactId]/summary, which calls the real LLM, and shows
 * the returned summary in a card panel. Plain-English empty + error states.
 */

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ContactActivitySummaryProps {
  contactId: string;
}

interface SummaryResponse {
  success: boolean;
  summary?: string;
  error?: string;
}

export function ContactActivitySummary({ contactId }: ContactActivitySummaryProps) {
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(`/api/crm/contacts/${contactId}/summary`, {
        method: 'POST',
      });

      const data = (await res.json()) as SummaryResponse;

      if (!res.ok || !data.success || !data.summary) {
        throw new Error(
          data.error ?? 'We could not generate a summary right now. Please try again.'
        );
      }

      setSummary(data.summary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while generating the summary. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Activity summary</CardTitle>
          <SectionDescription>
            Let AI read this contact&apos;s activity history and tell you where
            things stand.
          </SectionDescription>
        </div>
        <Button
          onClick={() => {
            void handleSummarize();
          }}
          disabled={loading}
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Summarizing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {summary ? 'Regenerate summary' : 'Summarize activity'}
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {summary ? (
        <div className="rounded-2xl border border-border-strong bg-card p-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {summary}
          </p>
        </div>
      ) : null}

      {!summary && !error && !loading ? (
        <div className="rounded-2xl border border-border-light bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No summary yet. Click &ldquo;Summarize activity&rdquo; to generate one
            from this contact&apos;s recent calls, emails, meetings, and notes.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default ContactActivitySummary;
