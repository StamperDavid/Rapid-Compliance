'use client';

/**
 * ShotDocGradePanel — the grading COLUMN that sits to the right of the Shot Doc.
 *
 * Lets the operator grade how the AI laid out THIS production sheet and explain the
 * grade in plain language, so the Shot Plan Planner (SHOT_PLAN_PLANNER) learns their
 * layout preferences. It reuses the exact, proven Mission Control training pipeline:
 *
 *   grade + explanation
 *     → POST /api/training/grade-specialist (targets SHOT_PLAN_PLANNER)
 *     → Prompt Engineer proposes ONE surgical prompt edit (or asks for more detail)
 *     → operator reviews it in the same 3-box PromptRevisionPopup (Keep / Agent's / Mine)
 *     → POST /api/training/feedback/[id]/approve|reject
 *     → approved → new GM version deployed; the next shot doc uses it.
 *
 * Standing Rule #2 holds for free: nothing changes unless the operator submits a grade
 * AND approves the proposed edit — this panel only ever calls the audited pipeline.
 *
 * Design system: Button/typography primitives, Tailwind color tokens, plain English.
 */

import { useState } from 'react';
import { Star, Loader2, AlertCircle, CheckCircle2, GraduationCap, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Caption, CardTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import {
  PromptRevisionPopup,
  type PromptRevisionPopupProps,
} from '@/components/training/PromptRevisionPopup';
import type { ShotPlan } from '@/types/shot-plan';

const SPECIALIST_ID = 'SHOT_PLAN_PLANNER';
const SPECIALIST_NAME = 'Shot Plan Planner';

/** The Prompt Engineer's proposed surgical edit (matches the Phase 3 backend). */
interface ProposedEdit {
  status: 'EDIT_PROPOSED';
  targetSection: { headingOrLocation: string; reasoning: string };
  currentText: string;
  proposedText: string;
  rationale: string;
  confidence: number;
  conflictsWithOtherSections: string[];
  preservesBrandDna: true;
}

interface Proposal {
  feedbackId: string;
  rawEdit: ProposedEdit;
  beforeSection: string;
  afterSection: string;
  changeDescription: string;
  fullRevisedPrompt: string;
}

interface GradeResponse {
  success: boolean;
  error?: string;
  result?: {
    status: 'EDIT_PROPOSED' | 'CLARIFICATION_NEEDED';
    feedbackId: string;
    proposedEdit?: ProposedEdit;
    targetSpecialistCurrentPrompt?: string;
    clarification?: { questions?: string[]; conflictsDetected?: string[]; rationale?: string };
  };
}

type Message = { kind: 'info' | 'success' | 'warn' | 'error'; text: string } | null;

/** Plain-English label under the stars for the current rating. */
function ratingHint(score: number): string {
  if (score <= 2) { return 'This layout is wrong'; }
  if (score <= 4) { return 'Good, but needs changes'; }
  return 'Love this layout';
}

/** Map a 1–5 rating to the backend grade enum (semantically faithful). */
function gradeFor(score: number): 'reject' | 'request_revision' | 'approve_with_notes' {
  if (score <= 2) { return 'reject'; }
  if (score <= 4) { return 'request_revision'; }
  return 'approve_with_notes';
}

/** The page STRUCTURE the planner produced, as readable rows of side-by-side blocks. */
function describeLayout(plan: ShotPlan): string {
  const rows = plan.layout?.rows ?? [];
  if (rows.length === 0) {
    return '  (the planner did not author an explicit layout — the default page was used)';
  }
  return rows
    .map((r, i) => `  Row ${i + 1}: ${r.blocks.map((b) => b.type).join(' | ')}`)
    .join('\n');
}

/**
 * The excerpt the Prompt Engineer reads. Unlike the Mission Control widget (which lacks
 * the raw output), we hand it the ACTUAL layout being graded so the proposed edit is
 * grounded in this specific page, not just the operator's words.
 */
function buildExcerpt(plan: ShotPlan, score: number, explanation: string): string {
  const cast = plan.sharedChoices?.cast?.length ?? 0;
  const objects = plan.sharedChoices?.objects?.length ?? 0;
  const style = plan.sharedChoices?.artStyle ?? plan.sharedChoices?.lookBible?.artStyle ?? '(unspecified)';
  return [
    `[Shot Doc page layout graded ${score}/5]`,
    `Video: "${plan.title || 'Untitled'}" — cast members: ${cast}, objects: ${objects}, ` +
      `shots: ${plan.shots?.length ?? 0}, art style: ${style}.`,
    '',
    'The page STRUCTURE the planner produced (top→bottom rows; each row is blocks side by side):',
    describeLayout(plan),
    '',
    `What the operator wants changed about HOW THIS PAGE IS LAID OUT: ${explanation}`,
  ].join('\n');
}

export function ShotDocGradePanel({ plan }: { plan: ShotPlan }): React.JSX.Element {
  const authFetch = useAuthFetch();
  const projectId = useVideoPipelineStore((s) => s.projectId);

  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const canSubmit = score > 0 && explanation.trim().length >= 5 && !submitting;

  const handleSubmit = (): void => {
    void (async () => {
      setSubmitting(true);
      setMessage(null);
      try {
        const res = await authFetch('/api/training/grade-specialist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetSpecialistId: SPECIALIST_ID,
            targetSpecialistName: SPECIALIST_NAME,
            sourceReportTaskId: projectId ?? plan.id ?? 'shot-doc',
            sourceReportExcerpt: buildExcerpt(plan, score, explanation.trim()),
            grade: gradeFor(score),
            explanation: explanation.trim(),
          }),
        });
        const json = (await res.json()) as GradeResponse;

        if (!res.ok || !json.success) {
          setMessage({
            kind: 'error',
            text: `We saved your grade, but the training step couldn't run: ${json.error ?? `HTTP ${res.status}`}`,
          });
          return;
        }

        const result = json.result;
        if (result?.status === 'CLARIFICATION_NEEDED') {
          const c = result.clarification ?? {};
          const qs = c.questions ?? [];
          const parts = ['Your grade was saved. The agent needs a little more detail before it can change anything.'];
          if (c.rationale) { parts.push(`Why: ${c.rationale}`); }
          if (qs.length > 0) { parts.push(`It's asking: ${qs.map((q, i) => `(${i + 1}) ${q}`).join(' ')}`); }
          setMessage({ kind: 'warn', text: parts.join(' ') });
          return;
        }

        if (result?.status !== 'EDIT_PROPOSED' || !result.proposedEdit) {
          setMessage({
            kind: 'warn',
            text: "Your grade was saved, but the agent didn't propose a change this time.",
          });
          return;
        }

        const edit = result.proposedEdit;
        const currentPrompt = result.targetSpecialistCurrentPrompt ?? '';
        const fullRevisedPrompt = currentPrompt.includes(edit.currentText)
          ? currentPrompt.replace(edit.currentText, edit.proposedText)
          : `${currentPrompt}\n\n[Proposed rewrite at ${edit.targetSection.headingOrLocation}]\n${edit.proposedText}`;

        setProposal({
          feedbackId: result.feedbackId,
          rawEdit: edit,
          beforeSection: edit.currentText,
          afterSection: edit.proposedText,
          changeDescription: edit.rationale,
          fullRevisedPrompt,
        });
      } catch (err) {
        setMessage({
          kind: 'error',
          text: `Something went wrong submitting your grade: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const handleApprove: PromptRevisionPopupProps['onApprove'] = (_full, _desc, source, newProposedText) => {
    void (async () => {
      if (!proposal) { return; }
      setIsApplying(true);
      try {
        const approvedEdit = {
          ...proposal.rawEdit,
          proposedText: newProposedText ?? proposal.rawEdit.proposedText,
        };
        const res = await authFetch(`/api/training/feedback/${proposal.feedbackId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvedEdit }),
        });
        void source;
        if (res.ok) {
          setMessage({
            kind: 'success',
            text: 'Done — the agent learned from this. Your change is live for the next shot doc you make.',
          });
          setScore(0);
          setExplanation('');
        } else {
          setMessage({ kind: 'error', text: "We couldn't apply that change. Please try again." });
        }
      } catch (err) {
        setMessage({
          kind: 'error',
          text: `Couldn't apply the change: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setIsApplying(false);
        setProposal(null);
      }
    })();
  };

  const handleReject: PromptRevisionPopupProps['onReject'] = () => {
    void (async () => {
      if (!proposal) { return; }
      try {
        await authFetch(`/api/training/feedback/${proposal.feedbackId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Operator kept the current prompt from the Shot Doc grade panel.' }),
        });
        setMessage({ kind: 'info', text: 'No problem — nothing changed. The agent keeps doing what it does now.' });
      } finally {
        setProposal(null);
      }
    })();
  };

  return (
    <>
      <aside className="w-full xl:w-[340px] xl:shrink-0 xl:sticky xl:top-6">
        <div className="bg-card border border-border-strong rounded-2xl p-5 space-y-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden /> Grade this layout
            </CardTitle>
            <SectionDescription>
              Tell the agent how it laid out this page. It learns from every grade, so the next
              shot doc is closer to how you like it.
            </SectionDescription>
          </div>

          {/* Star rating */}
          <div className="space-y-1.5">
            <Caption className="font-medium text-muted-foreground">Your rating</Caption>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => {
                const lit = (hover || score) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setScore(n)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Star className={`h-7 w-7 ${lit ? 'fill-primary text-primary' : ''}`} aria-hidden />
                  </button>
                );
              })}
            </div>
            <Caption>{score > 0 ? ratingHint(score) : 'Pick 1–5 stars.'}</Caption>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <Caption className="font-medium text-muted-foreground">
              What should it do differently — or keep doing?
            </Caption>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={5}
              placeholder="e.g. This is a product video with no people, but the page still leads with a character block. Lead with the product instead and make it big."
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
            />
            <Caption>Be specific — the more concrete you are, the better it learns.</Caption>
          </div>

          <Button className="w-full gap-1.5" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Teaching the agent…</>
            ) : (
              <><Sparkles className="h-4 w-4" aria-hidden /> Submit grade</>
            )}
          </Button>

          {message && (
            <div
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                message.kind === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : message.kind === 'success'
                    ? 'bg-primary/10 text-primary'
                    : message.kind === 'warn'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-surface-elevated text-foreground'
              }`}
            >
              {message.kind === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : message.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>
      </aside>

      {proposal !== null && (
        <PromptRevisionPopup
          isOpen
          onClose={() => setProposal(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          agentType={SPECIALIST_NAME}
          beforeSection={proposal.beforeSection}
          afterSection={proposal.afterSection}
          changeDescription={proposal.changeDescription}
          fullRevisedPrompt={proposal.fullRevisedPrompt}
          isApplying={isApplying}
        />
      )}
    </>
  );
}
