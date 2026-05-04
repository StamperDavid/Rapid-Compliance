'use client';

/**
 * GoogleBusinessLocationPicker
 *
 * Modal that lists every Google Business Profile location available on
 * the connected Google account and lets the operator pick which one
 * the platform should manage. Picks are persisted via
 * POST /api/integrations/google/gbp/select to the central
 * connected-Google doc.
 *
 * Mounted from /settings/integrations as both:
 *   - the "Select GBP Location" CTA on the Google Business Profile
 *     integration card (shown after central Google OAuth completes)
 *   - the "Change selected location" CTA once a selection exists.
 *
 * Empty state: "No GBP locations found on the connected Google account."
 * Error state: shows the upstream message + a Retry button.
 */

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface FlattenedLocation {
  accountId: string;
  accountName: string;
  locationId: string;
  locationName: string;
  address: string;
}

interface CurrentSelection {
  gbpAccountId?: string;
  gbpLocationId?: string;
  gbpLocationName?: string;
}

interface GoogleBusinessLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful save with the chosen location name (for toast / parent state). */
  onSaved?: (selection: CurrentSelection) => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; locations: FlattenedLocation[] }
  | { kind: 'empty' }
  | { kind: 'no_connection' }
  | { kind: 'reauth_required' }
  | { kind: 'scope_missing' }
  | { kind: 'error'; message: string };

export default function GoogleBusinessLocationPicker({
  open,
  onOpenChange,
  onSaved,
}: GoogleBusinessLocationPickerProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const [state, setState] = React.useState<LoadState>({ kind: 'idle' });
  const [selectedLocationKey, setSelectedLocationKey] = React.useState<string | null>(null);
  const [currentSelection, setCurrentSelection] = React.useState<CurrentSelection>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const buildKey = (loc: FlattenedLocation): string => `${loc.accountId}::${loc.locationId}`;

  const load = React.useCallback(async () => {
    setState({ kind: 'loading' });
    setSaveError(null);
    try {
      // Fetch current selection (best-effort) + list in parallel.
      const [selRes, listRes] = await Promise.all([
        authFetch('/api/integrations/google/gbp/select', { method: 'GET' }),
        authFetch('/api/integrations/google/gbp/locations', { method: 'GET' }),
      ]);

      if (selRes.ok) {
        const selBody = (await selRes.json()) as { success: boolean; selection?: CurrentSelection };
        if (selBody.success && selBody.selection) {
          setCurrentSelection(selBody.selection);
        }
      }

      if (listRes.status === 503) {
        const body = (await listRes.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === 'no_google_connection') {
          setState({ kind: 'no_connection' });
          return;
        }
        if (body?.code === 'reauth_required') {
          setState({ kind: 'reauth_required' });
          return;
        }
        if (body?.code === 'scope_missing') {
          setState({ kind: 'scope_missing' });
          return;
        }
      }

      if (!listRes.ok) {
        const body = (await listRes.json().catch(() => null)) as { error?: string } | null;
        setState({
          kind: 'error',
          message: body?.error ?? `Google returned status ${listRes.status}`,
        });
        return;
      }

      const body = (await listRes.json()) as { success: boolean; locations?: FlattenedLocation[]; error?: string };
      if (!body.success || !Array.isArray(body.locations)) {
        setState({ kind: 'error', message: body.error ?? 'Unexpected response shape' });
        return;
      }

      if (body.locations.length === 0) {
        setState({ kind: 'empty' });
        return;
      }

      setState({ kind: 'ready', locations: body.locations });

      // Pre-select the operator's existing pick if it's in the new list.
      const existingMatch = body.locations.find(
        (loc) =>
          loc.locationId === currentSelection.gbpLocationId &&
          (loc.accountId === currentSelection.gbpAccountId ||
            loc.accountName === currentSelection.gbpAccountId),
      );
      if (existingMatch) {
        setSelectedLocationKey(buildKey(existingMatch));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        '[GoogleBusinessLocationPicker] load failed',
        err instanceof Error ? err : new Error(msg),
        { file: 'GoogleBusinessLocationPicker.tsx' },
      );
      setState({ kind: 'error', message: msg });
    }
  }, [authFetch, currentSelection.gbpAccountId, currentSelection.gbpLocationId]);

  // Load when the modal opens.
  React.useEffect(() => {
    if (open && state.kind === 'idle') {
      void load();
    }
    if (!open) {
      // Reset transient state on close so a reopen pulls fresh data.
      setState({ kind: 'idle' });
      setSelectedLocationKey(null);
      setSaveError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = React.useCallback(async () => {
    if (state.kind !== 'ready' || !selectedLocationKey) {
      return;
    }
    const chosen = state.locations.find((loc) => buildKey(loc) === selectedLocationKey);
    if (!chosen) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Store the bare trailing id for both accountId and locationId
      // because that matches what GoogleBusinessService.createLocalPost
      // expects (it does `accounts/${accountId}/locations/${locationId}`).
      // The full resource names are kept in the picker's local state for
      // display only — they're not what the posting code consumes.
      const res = await authFetch('/api/integrations/google/gbp/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gbpAccountId: chosen.accountId,
          gbpLocationId: chosen.locationId,
          gbpLocationName: chosen.locationName,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveError(body?.error ?? `Save failed (status ${res.status})`);
        setSaving(false);
        return;
      }

      const body = (await res.json()) as { success: boolean; selection?: CurrentSelection };
      if (body.success && body.selection) {
        setCurrentSelection(body.selection);
        onSaved?.(body.selection);
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        '[GoogleBusinessLocationPicker] save failed',
        err instanceof Error ? err : new Error(msg),
        { file: 'GoogleBusinessLocationPicker.tsx' },
      );
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [authFetch, onOpenChange, onSaved, selectedLocationKey, state]);

  const renderBody = (): React.ReactNode => {
    switch (state.kind) {
      case 'idle':
      case 'loading':
        return (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Loading available Google Business Profile locations...
          </p>
        );
      case 'no_connection':
        return (
          <div className="space-y-3 py-4">
            <p className="text-sm text-foreground">
              You need to connect Google before selecting a Business Profile location.
            </p>
            <p className="text-sm text-muted-foreground">
              Use the &quot;Connect Google&quot; button on any Google integration card to start the OAuth flow.
            </p>
          </div>
        );
      case 'reauth_required':
        return (
          <div className="space-y-3 py-4">
            <p className="text-sm text-foreground">
              Your Google access token has expired and could not be refreshed automatically.
            </p>
            <p className="text-sm text-muted-foreground">
              Reconnect Google from the integrations page to continue.
            </p>
          </div>
        );
      case 'scope_missing':
        return (
          <div className="space-y-3 py-4">
            <p className="text-sm text-foreground">
              Google rejected the request because the connected account is missing the
              <code className="mx-1 px-1 py-0.5 bg-surface-elevated rounded">business.manage</code>
              scope.
            </p>
            <p className="text-sm text-muted-foreground">
              Reconnect Google to grant the full scope bundle including Google Business Profile access.
            </p>
          </div>
        );
      case 'empty':
        return (
          <div className="space-y-3 py-4">
            <p className="text-sm text-foreground">
              No Google Business Profile locations were found on this Google account.
            </p>
            <p className="text-sm text-muted-foreground">
              If you manage a Google Business Profile, ensure it&apos;s linked to the Google
              account you connected. You can verify ownership at
              {' '}
              <a
                href="https://business.google.com/locations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                business.google.com/locations
              </a>.
            </p>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-3 py-4">
            <p className="text-sm text-foreground">Failed to load locations.</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        );
      case 'ready':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {state.locations.map((loc) => {
              const key = buildKey(loc);
              const isSelected = selectedLocationKey === key;
              const isCurrent =
                loc.locationId === currentSelection.gbpLocationId &&
                (loc.accountId === currentSelection.gbpAccountId ||
                  loc.accountName === currentSelection.gbpAccountId);
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-surface-elevated'
                      : 'border-border-light hover:bg-surface-elevated'
                  }`}
                >
                  <input
                    type="radio"
                    name="gbp-location"
                    value={key}
                    checked={isSelected}
                    onChange={() => setSelectedLocationKey(key)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {loc.locationName}
                      </span>
                      {isCurrent ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Current
                        </span>
                      ) : null}
                    </div>
                    {loc.address.length > 0 ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.address}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                      {loc.accountName} / locations/{loc.locationId}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        );
    }
  };

  const showRetry =
    state.kind === 'error' ||
    state.kind === 'reauth_required' ||
    state.kind === 'scope_missing' ||
    state.kind === 'no_connection' ||
    state.kind === 'empty';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Google Business Profile location</DialogTitle>
          <DialogDescription>
            Pick which location on your connected Google account the platform should manage.
            All future GBP posts publish to the location you choose here.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">{renderBody()}</div>

        {saveError ? (
          <p className="text-sm text-destructive mt-2">{saveError}</p>
        ) : null}

        <DialogFooter className="mt-4">
          {showRetry ? (
            <Button variant="outline" onClick={() => { void load(); }}>
              Retry
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {state.kind === 'ready' ? (
            <Button
              onClick={() => { void handleSave(); }}
              disabled={!selectedLocationKey || saving}
            >
              {saving ? 'Saving...' : 'Save selection'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
