'use client';

/**
 * SetupChecklistSection
 *
 * Renders the "Finish Setting Up" section inside the JasperOnLoginPopup.
 * Each row carries:
 *  - A "Don't remind me again" checkbox that calls
 *    POST /api/jasper/setup/dismiss { key } and fades the row out on success.
 *  - Title + 1-line description.
 *  - Right-side CTA button (Link if `ctaHref` is set, otherwise no-op).
 *
 * Sort order: high-urgency rows first, then medium, then low.
 *
 * Design tokens only — `bg-card`, `text-foreground`, `border-border-strong`,
 * `bg-error/10`, etc. Never raw hex or `var(--color-...)`.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CardTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { SetupItem } from '@/types/jasper-insights';

interface SetupChecklistSectionProps {
  items: SetupItem[];
  /** Called after the row is dismissed so the parent can drop it from its local list. */
  onItemDismissed?: (key: string) => void;
}

const URGENCY_RANK: Record<SetupItem['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const URGENCY_PILL: Record<SetupItem['urgency'], { label: string; classes: string }> = {
  high: { label: 'High', classes: 'bg-error/10 text-error border border-error/30' },
  medium: { label: 'Medium', classes: 'bg-warning/10 text-warning border border-warning/30' },
  low: { label: 'Low', classes: 'bg-muted text-muted-foreground border border-border' },
};

export function SetupChecklistSection({ items, onItemDismissed }: SetupChecklistSectionProps) {
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]),
    [items],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-success mb-2" aria-hidden />
        <CardTitle>You&apos;re all set</CardTitle>
        <SectionDescription className="mt-1">
          No outstanding setup items. Nice work.
        </SectionDescription>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sorted.map((item) => (
        <SetupRow key={item.key} item={item} onItemDismissed={onItemDismissed} />
      ))}
    </ul>
  );
}

interface SetupRowProps {
  item: SetupItem;
  onItemDismissed?: (key: string) => void;
}

function SetupRow({ item, onItemDismissed }: SetupRowProps) {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDismissChange = async (checked: boolean) => {
    if (!checked || dismissing) {
      return;
    }
    setDismissing(true);
    setError(null);
    try {
      const res = await authFetch('/api/jasper/setup/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || data.success !== true) {
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      // Fade out, then notify parent.
      setHidden(true);
      window.setTimeout(() => {
        onItemDismissed?.(item.key);
      }, 280);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not dismiss this item';
      setError(msg);
      logger.error(
        '[SetupChecklistSection] dismiss failed',
        err instanceof Error ? err : new Error(msg),
      );
      setDismissing(false);
    }
  };

  const pill = URGENCY_PILL[item.urgency];
  const ctaVariant: 'default' | 'outline' = item.urgency === 'high' ? 'default' : 'outline';

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.li
          data-setup-key={item.key}
          data-urgency={item.urgency}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-border-strong bg-card p-4 flex flex-wrap items-start gap-3"
        >
          <label className="flex items-center gap-2 cursor-pointer pt-1 shrink-0 select-none">
            <Checkbox
              checked={dismissing}
              disabled={dismissing}
              onChange={(e) => {
                void handleDismissChange(e.target.checked);
              }}
              aria-label={`Don't remind me again about: ${item.title}`}
            />
            <Caption className="hidden sm:inline">Don&apos;t remind me</Caption>
          </label>

          <div className="flex-1 min-w-[12rem]">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="leading-snug">{item.title}</CardTitle>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${pill.classes}`}
                aria-label={`Urgency: ${pill.label}`}
              >
                {pill.label}
              </span>
            </div>
            <SectionDescription className="mt-1 line-clamp-2">
              {item.description}
            </SectionDescription>
            {error !== null && (
              <p className="mt-2 text-xs text-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="ml-auto shrink-0">
            <Button
              type="button"
              size="sm"
              variant={ctaVariant}
              disabled={dismissing || !item.ctaHref}
              className="gap-1.5"
              onClick={() => {
                if (item.ctaHref !== undefined && item.ctaHref !== '') {
                  router.push(item.ctaHref);
                }
              }}
              aria-disabled={!item.ctaHref ? true : undefined}
              title={!item.ctaHref ? 'Coming soon' : undefined}
            >
              {dismissing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {item.ctaLabel}
              {item.ctaHref ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : null}
            </Button>
          </div>
        </motion.li>
      )}
    </AnimatePresence>
  );
}

export default SetupChecklistSection;
