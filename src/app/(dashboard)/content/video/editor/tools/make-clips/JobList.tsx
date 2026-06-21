'use client';

/**
 * JobList — real per-item status for every (short × format) the operator made.
 * Honest states only: rendering → scheduled (with the scheduler note) OR saved
 * to Library (with a plain reason) OR error. Never claims a post was scheduled
 * unless the scheduler returned a post id.
 */

import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Library } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { ClipJob, JobPhase } from './useMakeClips';

const PHASE_LABEL: Record<JobPhase, string> = {
  queued: 'Waiting…',
  captioning: 'Adding captions…',
  rendering: 'Rendering…',
  scheduling: 'Scheduling…',
  scheduled: 'Scheduled',
  saved: 'Saved to Library',
  error: 'Could not finish',
};

function StatusIcon({ phase }: { phase: JobPhase }) {
  if (phase === 'scheduled') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />;
  }
  if (phase === 'saved') {
    return <Library className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  if (phase === 'error') {
    return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
  }
  if (phase === 'queued') {
    return <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
}

export default function JobList({ jobs }: { jobs: ClipJob[] }) {
  if (jobs.length === 0) {
    return null;
  }
  return (
    <section className="space-y-2">
      <Caption className="block font-medium text-foreground">Results</Caption>
      <ul className="space-y-1.5">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="space-y-1 rounded-lg border border-border-strong bg-card p-3"
          >
            <div className="flex items-center gap-2">
              <StatusIcon phase={job.phase} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {job.shortName} · {job.formatLabel}
                </span>
                <Caption className="block">{PHASE_LABEL[job.phase]}</Caption>
              </span>
            </div>

            {job.error ? (
              <Caption className="block text-destructive">{job.error}</Caption>
            ) : null}
            {job.note ? <Caption className="block">{job.note}</Caption> : null}

            {job.libraryUrl ? (
              <a
                href={job.libraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Open clip
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
