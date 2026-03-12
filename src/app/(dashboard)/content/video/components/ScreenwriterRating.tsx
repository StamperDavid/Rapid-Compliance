'use client';

import { useState, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Star, Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

interface ScreenwriterRatingProps {
  projectId: string | null;
  projectDescription: string;
  sceneCount: number;
  videoType: string;
}

interface CriteriaScores {
  userIntent: number;
  characterConsistency: number;
  visualDescriptions: number;
  narrationHandling: number;
  sceneStructure: number;
}

const CRITERIA_LABELS: Record<keyof CriteriaScores, { label: string; hint: string }> = {
  userIntent: {
    label: 'Followed Your Prompt',
    hint: 'Did it create what you asked for?',
  },
  characterConsistency: {
    label: 'Character Consistency',
    hint: 'Same character across scenes?',
  },
  visualDescriptions: {
    label: 'Visual Descriptions',
    hint: 'Rich, specific scene directions?',
  },
  narrationHandling: {
    label: 'Narration Handling',
    hint: 'Voiceover, not character speech?',
  },
  sceneStructure: {
    label: 'Scene Structure',
    hint: 'Right scene count and pacing?',
  },
};

// ============================================================================
// Star Rating Component
// ============================================================================

function StarRating({
  value,
  onChange,
  size = 'lg',
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`${starSize} transition-colors ${
              star <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-zinc-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScreenwriterRating({
  projectId,
  projectDescription,
  sceneCount,
  videoType,
}: ScreenwriterRatingProps) {
  const authFetch = useAuthFetch();

  const [overallRating, setOverallRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [criteriaScores, setCriteriaScores] = useState<CriteriaScores>({
    userIntent: 0,
    characterConsistency: 0,
    visualDescriptions: 0,
    narrationHandling: 0,
    sceneStructure: 0,
  });
  const [showCriteria, setShowCriteria] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const updateCriteria = useCallback((key: keyof CriteriaScores, value: number) => {
    setCriteriaScores((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (overallRating === 0 || !feedback.trim()) { return; }

    setSubmitting(true);
    try {
      // Build criteria — only include non-zero scores
      const filledCriteria: Record<string, number> = {};
      const criteriaKeys = Object.keys(criteriaScores) as Array<keyof CriteriaScores>;
      for (const key of criteriaKeys) {
        const val = criteriaScores[key];
        if (val > 0) { filledCriteria[key] = val; }
      }

      const response = await authFetch('/api/video/screenwriter-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? 'unknown',
          rating: overallRating,
          feedback: feedback.trim(),
          criteriaScores: Object.keys(filledCriteria).length > 0 ? filledCriteria : undefined,
          projectContext: {
            description: projectDescription,
            sceneCount,
            videoType,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { success: boolean; flagged?: boolean };
        setSubmitted(true);
        setFlagged(data.flagged ?? false);
      }
    } catch {
      // Non-critical — feedback submission failed silently
    } finally {
      setSubmitting(false);
    }
  }, [overallRating, feedback, criteriaScores, projectId, projectDescription, sceneCount, videoType, authFetch]);

  // Already submitted
  if (submitted) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-center justify-center">
            {flagged ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-amber-300 text-sm">
                  Feedback recorded. Screenwriter flagged for training review.
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-300 text-sm">
                  Feedback sent to the training center. Thanks!
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Star className="w-5 h-5 text-amber-500" />
          Rate the Screenwriter
        </CardTitle>
        <CardDescription>
          How did the AI screenwriter perform? Your feedback trains the agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Rating */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 w-24 shrink-0">Overall:</span>
          <StarRating value={overallRating} onChange={setOverallRating} />
          {overallRating > 0 && (
            <span className="text-xs text-zinc-500">
              {overallRating === 1 && 'Terrible'}
              {overallRating === 2 && 'Poor'}
              {overallRating === 3 && 'Okay'}
              {overallRating === 4 && 'Good'}
              {overallRating === 5 && 'Excellent'}
            </span>
          )}
        </div>

        {/* Expandable Criteria */}
        <button
          type="button"
          onClick={() => setShowCriteria(!showCriteria)}
          className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
        >
          {showCriteria ? 'Hide detailed scores' : 'Score specific criteria (optional)'}
        </button>

        {showCriteria && (
          <div className="space-y-2 pl-2 border-l-2 border-zinc-700/50">
            {(Object.entries(CRITERIA_LABELS) as Array<[keyof CriteriaScores, { label: string; hint: string }]>).map(
              ([key, { label, hint }]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <div className="text-xs text-zinc-300">{label}</div>
                    <div className="text-[10px] text-zinc-500">{hint}</div>
                  </div>
                  <StarRating
                    value={criteriaScores[key]}
                    onChange={(v) => updateCriteria(key, v)}
                    size="sm"
                  />
                </div>
              )
            )}
          </div>
        )}

        {/* Feedback Text */}
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What went wrong or right? e.g., 'Wrong character — I asked for a man but got a woman' or 'Great pacing but scene 3 had no character reference'"
          className="w-full h-20 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
          maxLength={2000}
        />

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={() => { void handleSubmit(); }}
            disabled={overallRating === 0 || !feedback.trim() || submitting}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
            size="sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? 'Submitting...' : 'Send to Training Center'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
