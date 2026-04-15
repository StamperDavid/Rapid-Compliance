/**
 * Swarm Training Page
 *
 * Route: /settings/ai-agents/swarm-training
 *
 * Phase 3 frontend for the grade-to-prompt-edit pipeline. Lets the
 * operator grade any specialist output, run it through the Prompt
 * Engineer, review the surgical edit proposal in a 3-panel modal
 * (Current | Proposed | Rationale + Approve/Reject), and approve or
 * reject it. On approval, a new Golden Master version is deployed
 * atomically and the cache invalidates — the next specialist call
 * runs on the new prompt.
 *
 * This page is SEPARATE from the legacy Training Center page
 * (/settings/ai-agents/training). That page handles the Jasper and
 * chat-widget Training Lab GMs. This page handles the rebuilt
 * specialist swarm (36 real agents in specialistGoldenMasters).
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageTitle, SectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import type { TrainingFeedback } from '@/types/training';

// ============================================================================
// TYPES (mirror server response shapes)
// ============================================================================

interface EditProposed {
  status: 'EDIT_PROPOSED';
  targetSection: { headingOrLocation: string; reasoning: string };
  currentText: string;
  proposedText: string;
  rationale: string;
  confidence: number;
  conflictsWithOtherSections: string[];
  preservesBrandDna: true;
}

interface ClarificationNeeded {
  status: 'CLARIFICATION_NEEDED';
  questions: string[];
  conflictsDetected: string[];
  rationale: string;
}

interface SubmitGradeSuccess {
  status: 'EDIT_PROPOSED';
  feedbackId: string;
  proposedEdit: EditProposed;
  targetSpecialistId: string;
  targetSpecialistCurrentPrompt: string;
}

interface SubmitGradeClarification {
  status: 'CLARIFICATION_NEEDED';
  feedbackId: string;
  clarification: ClarificationNeeded;
}

type SubmitGradeApiResult = SubmitGradeSuccess | SubmitGradeClarification;

// ============================================================================
// KNOWN SPECIALISTS (for the dropdown — matches the 36 rebuilt specialists)
// ============================================================================

const SPECIALIST_OPTIONS: Array<{ id: string; name: string }> = [
  { id: 'COPYWRITER', name: 'Copywriter' },
  { id: 'VIDEO_SPECIALIST', name: 'Video Specialist' },
  { id: 'CALENDAR_COORDINATOR', name: 'Calendar Coordinator' },
  { id: 'ASSET_GENERATOR', name: 'Asset Generator' },
  { id: 'SEO_EXPERT', name: 'SEO Expert' },
  { id: 'LINKEDIN_EXPERT', name: 'LinkedIn Expert' },
  { id: 'TIKTOK_EXPERT', name: 'TikTok Expert' },
  { id: 'TWITTER_X_EXPERT', name: 'Twitter/X Expert' },
  { id: 'FACEBOOK_ADS_EXPERT', name: 'Facebook Ads Expert' },
  { id: 'GROWTH_ANALYST', name: 'Growth Analyst' },
  { id: 'UX_UI_ARCHITECT', name: 'UX/UI Architect' },
  { id: 'FUNNEL_ENGINEER', name: 'Funnel Engineer' },
  { id: 'WORKFLOW_OPTIMIZER', name: 'Workflow Optimizer' },
  { id: 'EMAIL_SPECIALIST', name: 'Email Specialist' },
  { id: 'SMS_SPECIALIST', name: 'SMS Specialist' },
  { id: 'SCRAPER_SPECIALIST', name: 'Scraper Specialist' },
  { id: 'COMPETITOR_RESEARCHER', name: 'Competitor Researcher' },
  { id: 'TECHNOGRAPHIC_SCOUT', name: 'Technographic Scout' },
  { id: 'SENTIMENT_ANALYST', name: 'Sentiment Analyst' },
  { id: 'TREND_SCOUT', name: 'Trend Scout' },
  { id: 'AI_CHAT_SALES_AGENT', name: 'Alex (Sales Chat)' },
  { id: 'LEAD_QUALIFIER', name: 'Lead Qualifier' },
  { id: 'OUTREACH_SPECIALIST', name: 'Outreach Specialist' },
  { id: 'MERCHANDISER', name: 'Merchandiser' },
  { id: 'DEAL_CLOSER', name: 'Deal Closer' },
  { id: 'OBJ_HANDLER', name: 'Objection Handler' },
  { id: 'REVIEW_SPECIALIST', name: 'Review Specialist' },
  { id: 'GMB_SPECIALIST', name: 'GMB Specialist' },
  { id: 'REVIEW_MANAGER', name: 'Review Manager' },
  { id: 'CASE_STUDY', name: 'Case Study Specialist' },
  { id: 'COPY_STRATEGIST', name: 'Copy Strategist' },
  { id: 'UX_UI_STRATEGIST', name: 'UX/UI Strategist' },
  { id: 'FUNNEL_STRATEGIST', name: 'Funnel Strategist' },
  { id: 'GROWTH_STRATEGIST', name: 'Growth Strategist' },
];

// ============================================================================
// PAGE
// ============================================================================

export default function SwarmTrainingPage() {
  const authFetch = useAuthFetch();
  const toast = useToast();

  // Pending reviews list
  const [pendingRecords, setPendingRecords] = useState<TrainingFeedback[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Grade form
  const [targetSpecialistId, setTargetSpecialistId] = useState<string>('');
  const [sourceReportTaskId, setSourceReportTaskId] = useState<string>('');
  const [sourceReportExcerpt, setSourceReportExcerpt] = useState<string>('');
  const [grade, setGrade] = useState<'reject' | 'request_revision' | 'approve_with_notes'>('reject');
  const [explanation, setExplanation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<'edit' | 'clarification' | null>(null);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [activeEdit, setActiveEdit] = useState<EditProposed | null>(null);
  const [activeClarification, setActiveClarification] = useState<ClarificationNeeded | null>(null);
  const [editedProposedText, setEditedProposedText] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [modalBusy, setModalBusy] = useState(false);

  // Load pending reviews
  const loadPending = useCallback(async (): Promise<void> => {
    setLoadingPending(true);
    try {
      const res = await authFetch('/api/training/grade-specialist?status=pending_review&limit=100');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { success: boolean; records: TrainingFeedback[] };
      setPendingRecords(body.records);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[SwarmTraining] Failed to load pending records', error instanceof Error ? error : new Error(msg));
      toast.error(`Failed to load pending records: ${msg}`);
    } finally {
      setLoadingPending(false);
    }
  }, [authFetch, toast]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  // Submit grade
  const handleSubmitGrade = useCallback(async (): Promise<void> => {
    if (!targetSpecialistId || !explanation || !sourceReportExcerpt) {
      toast.error('Specialist, explanation, and output excerpt are all required');
      return;
    }

    const specialist = SPECIALIST_OPTIONS.find((s) => s.id === targetSpecialistId);
    if (!specialist) {
      toast.error('Invalid specialist selection');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/training/grade-specialist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSpecialistId,
          targetSpecialistName: specialist.name,
          sourceReportTaskId: sourceReportTaskId || `manual_grade_${Date.now()}`,
          sourceReportExcerpt,
          grade,
          explanation,
        }),
      });

      const body = (await res.json()) as { success: boolean; error?: string; result?: SubmitGradeApiResult };
      if (!res.ok || !body.success || !body.result) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const result = body.result;
      setActiveFeedbackId(result.feedbackId);

      if (result.status === 'EDIT_PROPOSED') {
        setActiveEdit(result.proposedEdit);
        setEditedProposedText(result.proposedEdit.proposedText);
        setActiveClarification(null);
        setModalKind('edit');
      } else {
        setActiveClarification(result.clarification);
        setActiveEdit(null);
        setModalKind('clarification');
      }

      setModalOpen(true);
      toast.success('Prompt Engineer produced a response — review it now');
      void loadPending();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[SwarmTraining] Submit grade failed', error instanceof Error ? error : new Error(msg));
      toast.error(`Submit failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [targetSpecialistId, sourceReportTaskId, sourceReportExcerpt, grade, explanation, authFetch, toast, loadPending]);

  const resetForm = (): void => {
    setTargetSpecialistId('');
    setSourceReportTaskId('');
    setSourceReportExcerpt('');
    setGrade('reject');
    setExplanation('');
  };

  const closeModal = (): void => {
    setModalOpen(false);
    setModalKind(null);
    setActiveFeedbackId(null);
    setActiveEdit(null);
    setActiveClarification(null);
    setEditedProposedText('');
    setRejectReason('');
  };

  // Approve edit
  const handleApprove = useCallback(async (): Promise<void> => {
    if (!activeFeedbackId || !activeEdit) { return; }
    setModalBusy(true);
    try {
      const finalEdit: EditProposed = {
        ...activeEdit,
        proposedText: editedProposedText,
      };
      const res = await authFetch(`/api/training/feedback/${activeFeedbackId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedEdit: finalEdit }),
      });
      const body = (await res.json()) as { success: boolean; error?: string; result?: { status: string; newVersion?: number; newGMDocId?: string } };
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        `Deployed new Golden Master version: ${body.result?.newGMDocId ?? 'v?'} (v${body.result?.newVersion ?? '?'})`,
      );
      closeModal();
      resetForm();
      void loadPending();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[SwarmTraining] Approve failed', error instanceof Error ? error : new Error(msg));
      toast.error(`Approve failed: ${msg}`);
    } finally {
      setModalBusy(false);
    }
  }, [activeFeedbackId, activeEdit, editedProposedText, authFetch, toast, loadPending]);

  // Reject edit
  const handleReject = useCallback(async (): Promise<void> => {
    if (!activeFeedbackId) { return; }
    if (rejectReason.trim().length < 5) {
      toast.error('Please explain why you are rejecting the proposed edit (min 5 chars)');
      return;
    }
    setModalBusy(true);
    try {
      const res = await authFetch(`/api/training/feedback/${activeFeedbackId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success('Proposed edit rejected. Specialist Golden Master unchanged.');
      closeModal();
      resetForm();
      void loadPending();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[SwarmTraining] Reject failed', error instanceof Error ? error : new Error(msg));
      toast.error(`Reject failed: ${msg}`);
    } finally {
      setModalBusy(false);
    }
  }, [activeFeedbackId, rejectReason, authFetch, toast, loadPending]);

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <PageTitle>Swarm Training</PageTitle>
        <SectionDescription>
          Grade any specialist output. The Prompt Engineer will propose a surgical edit to the specialist&apos;s
          Golden Master prompt. You approve or reject the proposal — if approved, the new prompt version
          deploys immediately and the specialist learns on the next call. No grades = no prompt changes.
        </SectionDescription>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Grade form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Submit a grade</CardTitle>
            <SectionDescription>
              Pick a specialist, paste the output you want to grade, and explain what was wrong.
              The Prompt Engineer will identify which section of the specialist&apos;s prompt caused
              the behavior and propose a rewrite.
            </SectionDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="specialist" className="text-sm font-medium text-foreground">Specialist</label>
              <Select value={targetSpecialistId} onValueChange={setTargetSpecialistId}>
                <SelectTrigger id="specialist">
                  <SelectValue placeholder="Pick a specialist..." />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALIST_OPTIONS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="taskId" className="text-sm font-medium text-foreground">Source task ID (optional)</label>
              <Input
                id="taskId"
                placeholder="e.g. campaign_042_blog_post_v3"
                value={sourceReportTaskId}
                onChange={(e) => setSourceReportTaskId(e.target.value)}
              />
              <Caption>Used for audit trail. Leave blank for a timestamped placeholder.</Caption>
            </div>

            <div className="space-y-2">
              <label htmlFor="grade" className="text-sm font-medium text-foreground">Grade</label>
              <Select value={grade} onValueChange={(v) => setGrade(v as typeof grade)}>
                <SelectTrigger id="grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reject">Reject (redo from scratch)</SelectItem>
                  <SelectItem value="request_revision">Request revision (fix specific issues)</SelectItem>
                  <SelectItem value="approve_with_notes">Approve with notes (improve for next time)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="excerpt" className="text-sm font-medium text-foreground">Specialist output you are grading</label>
              <Textarea
                id="excerpt"
                rows={8}
                placeholder="Paste the specific output text the specialist produced that you want to grade..."
                value={sourceReportExcerpt}
                onChange={(e) => setSourceReportExcerpt(e.target.value)}
              />
              <Caption>Max 20,000 characters. This is what the Prompt Engineer will read to understand the failure mode.</Caption>
            </div>

            <div className="space-y-2">
              <label htmlFor="explanation" className="text-sm font-medium text-foreground">What was wrong? (your correction)</label>
              <Textarea
                id="explanation"
                rows={6}
                placeholder="Explain in your own words what was wrong with this output and what you want the specialist to do differently next time. Be specific — the Prompt Engineer will translate your intent into a prompt rewrite."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
              <Caption>Min 5 / max 5000 characters. Be specific — shorthand works but specifics work better.</Caption>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { void handleSubmitGrade(); }} disabled={submitting}>
                {submitting ? 'Running Prompt Engineer...' : 'Submit grade'}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={submitting}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Pending reviews */}
        <Card>
          <CardHeader>
            <CardTitle>Pending review</CardTitle>
            <SectionDescription>
              Feedback records waiting for a decision.
            </SectionDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPending && <Caption>Loading...</Caption>}
            {!loadingPending && pendingRecords.length === 0 && (
              <Caption>No pending reviews.</Caption>
            )}
            {pendingRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-border-light bg-surface-elevated p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{record.targetSpecialistName}</span>
                  <Badge variant="outline">{record.grade}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{record.explanation}</p>
                <Caption>{new Date(record.createdAt).toLocaleString()}</Caption>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 3-panel modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {modalKind === 'edit' && 'Prompt Engineer proposed an edit'}
              {modalKind === 'clarification' && 'Prompt Engineer needs clarification'}
            </DialogTitle>
            <DialogDescription>
              {modalKind === 'edit' && 'Review the before/after. Tweak the proposed text if needed. Approve to deploy, or reject to leave the Golden Master unchanged.'}
              {modalKind === 'clarification' && 'The Prompt Engineer could not cleanly address your correction and is asking for more context. Answer below, or close this modal and submit a revised grade.'}
            </DialogDescription>
          </DialogHeader>

          {modalKind === 'edit' && activeEdit && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Section: {activeEdit.targetSection.headingOrLocation}</Badge>
                <Badge variant="secondary">Confidence: {activeEdit.confidence}%</Badge>
                <Badge variant="secondary">Brand DNA preserved: yes</Badge>
                {activeEdit.conflictsWithOtherSections.length > 0 && (
                  <Badge variant="destructive">
                    {activeEdit.conflictsWithOtherSections.length} potential conflict(s)
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <SectionTitle>Current</SectionTitle>
                  <div className="rounded-md border border-border bg-surface-elevated p-3 max-h-96 overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{activeEdit.currentText}</pre>
                  </div>
                  <Caption>{activeEdit.currentText.length} chars — will be replaced</Caption>
                </div>
                <div className="space-y-2">
                  <SectionTitle>Proposed</SectionTitle>
                  <Textarea
                    rows={16}
                    className="max-h-96 text-xs font-mono"
                    value={editedProposedText}
                    onChange={(e) => setEditedProposedText(e.target.value)}
                  />
                  <Caption>{editedProposedText.length} chars — editable. Final text deploys as-is.</Caption>
                </div>
              </div>

              <div className="space-y-2">
                <SectionTitle>Why this edit</SectionTitle>
                <p className="text-sm text-muted-foreground">{activeEdit.rationale}</p>
              </div>

              {activeEdit.conflictsWithOtherSections.length > 0 && (
                <div className="space-y-2">
                  <SectionTitle>Potential conflicts</SectionTitle>
                  <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
                    {activeEdit.conflictsWithOtherSections.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="rejectReason" className="text-sm font-medium text-foreground">Reason (only required if rejecting)</label>
                <Textarea
                  id="rejectReason"
                  rows={2}
                  placeholder="Why are you rejecting this proposed edit?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
          )}

          {modalKind === 'clarification' && activeClarification && (
            <div className="space-y-4">
              <div className="space-y-2">
                <SectionTitle>Why clarification is needed</SectionTitle>
                <p className="text-sm text-muted-foreground">{activeClarification.rationale}</p>
              </div>
              <div className="space-y-2">
                <SectionTitle>Questions</SectionTitle>
                <ul className="text-sm text-foreground list-decimal pl-6 space-y-1">
                  {activeClarification.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              {activeClarification.conflictsDetected.length > 0 && (
                <div className="space-y-2">
                  <SectionTitle>Conflicts with existing instructions</SectionTitle>
                  <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
                    {activeClarification.conflictsDetected.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Caption>
                Close this modal and submit a revised grade with more specific direction. The original feedback
                record has been flagged &quot;clarification_needed&quot; in Firestore.
              </Caption>
            </div>
          )}

          <DialogFooter>
            {modalKind === 'edit' && (
              <>
                <Button variant="outline" onClick={() => { void handleReject(); }} disabled={modalBusy}>
                  {modalBusy ? 'Rejecting...' : 'Reject'}
                </Button>
                <Button onClick={() => { void handleApprove(); }} disabled={modalBusy}>
                  {modalBusy ? 'Deploying...' : 'Approve & deploy'}
                </Button>
              </>
            )}
            {modalKind === 'clarification' && (
              <Button onClick={closeModal}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
