'use client';

/**
 * ContactNextBestAction
 *
 * Contact-level "Next Best Action" panel for the contact detail page.
 * Fetches AI recommendations from the real next-best-action engine via
 * GET /api/crm/contacts/[contactId]/recommendations and renders them with
 * loading, empty and error states written in plain English.
 *
 * Drop into the contact detail page with:
 *   <ContactNextBestAction contactId={contactId} />
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import {
  SectionTitle,
  SectionDescription,
  CardTitle,
  Caption,
} from '@/components/ui/typography';

interface ContactNextBestActionProps {
  contactId: string;
}

interface Recommendation {
  id: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  confidence: number;
  title: string;
  description: string;
  reasoning: string[];
  suggestedTimeline: string;
  sourceDealName: string;
}

interface RecommendationsResponse {
  success: boolean;
  recommendations?: Recommendation[];
  error?: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

const PRIORITY_STYLES: Record<Recommendation['priority'], string> = {
  High: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

export default function ContactNextBestAction({
  contactId,
}: ContactNextBestActionProps) {
  const authFetch = useAuthFetch();
  const [state, setState] = useState<LoadState>('loading');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadRecommendations = useCallback(async () => {
    setState('loading');
    setErrorMessage('');

    try {
      const response = await authFetch(
        `/api/crm/contacts/${contactId}/recommendations`
      );
      const data = (await response.json()) as RecommendationsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? 'We could not load recommendations right now.'
        );
      }

      setRecommendations(data.recommendations ?? []);
      setState('loaded');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading recommendations.'
      );
      setState('error');
    }
  }, [authFetch, contactId]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <SectionTitle>Next Best Action</SectionTitle>
        <SectionDescription>
          AI suggestions for how to move this relationship forward, based on this
          contact&apos;s deals and recent activity.
        </SectionDescription>
      </div>

      {state === 'loading' && (
        <p className="text-sm text-muted-foreground">
          Analyzing this contact&apos;s deals and activity&hellip;
        </p>
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadRecommendations();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state === 'loaded' && recommendations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          There are no recommended actions yet. Once this contact has an active
          deal with some activity, suggestions will appear here.
        </p>
      )}

      {state === 'loaded' && recommendations.length > 0 && (
        <ul className="space-y-3">
          {recommendations.map((rec) => (
            <li
              key={rec.id}
              className="bg-background border border-border-strong rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{rec.title}</CardTitle>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[rec.priority]}`}
                >
                  {rec.priority} priority
                </span>
              </div>

              <p className="text-sm text-muted-foreground">{rec.description}</p>

              {rec.reasoning.length > 0 && (
                <div className="space-y-1">
                  <Caption className="text-muted-foreground">Why</Caption>
                  <ul className="list-disc list-inside space-y-0.5">
                    {rec.reasoning.map((reason, index) => (
                      <li
                        key={`${rec.id}-reason-${index}`}
                        className="text-sm text-muted-foreground"
                      >
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                <Caption className="text-muted-foreground">
                  Suggested timing: {rec.suggestedTimeline}
                </Caption>
                <Caption className="text-muted-foreground">
                  From deal: {rec.sourceDealName}
                </Caption>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
