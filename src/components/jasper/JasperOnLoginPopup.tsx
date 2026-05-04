'use client';

/**
 * JasperOnLoginPopup
 *
 * Auto-opening login modal that surfaces ONLY the "Finish Setting Up"
 * checklist. Jasper's insights live in his chat window now (via the
 * arrow-down button on the orchestrator chat panel) — not here.
 *
 * Behavior:
 *   - Auto-opens once per login if there are unresolved setup items.
 *   - Once every setup item is resolved or dismissed, the popup never
 *     opens again — the operator only sees it when there's actual
 *     setup work pending.
 *
 * Backdrop is transparent + blurred (not opaque) per owner UX rule —
 * operator still sees the dashboard behind the modal.
 */

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SetupItem } from '@/types/jasper-insights';
import { SetupChecklistSection } from './SetupChecklistSection';

interface JasperOnLoginPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupItems: SetupItem[];
  /** Set true while the hook is still fetching/regenerating content. */
  loading?: boolean;
}

export function JasperOnLoginPopup({
  open,
  onOpenChange,
  setupItems,
  loading = false,
}: JasperOnLoginPopupProps) {
  // Local copy so we can fade rows out client-side after dismiss/run before
  // the parent has a chance to re-fetch.
  const [localSetup, setLocalSetup] = useState<SetupItem[]>(setupItems);

  // Sync incoming props whenever the parent reloads.
  useEffect(() => {
    setLocalSetup(setupItems);
  }, [setupItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[min(95vw,40rem)] max-h-[min(560px,75vh)] overflow-hidden bg-card text-card-foreground border-border-strong sm:rounded-2xl flex flex-col shadow-2xl"
        // Transparent + blur backdrop — operator still sees the dashboard
        // behind the popup, slightly out of focus. Per owner's UX rule.
        overlayClassName="fixed inset-0 backdrop-blur-md bg-background/40"
        data-testid="jasper-on-login-popup"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">
                Finish setting up
              </DialogTitle>
              <DialogDescription className="mt-1">
                {loading
                  ? 'Jasper is scanning your platform activity…'
                  : `${localSetup.length} thing${localSetup.length === 1 ? '' : 's'} left to wire up before the platform runs at full strength.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && localSetup.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
            Loading…
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <SetupChecklistSection
              items={localSetup}
              onItemDismissed={(key) =>
                setLocalSetup((prev) => prev.filter((i) => i.key !== key))
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default JasperOnLoginPopup;
