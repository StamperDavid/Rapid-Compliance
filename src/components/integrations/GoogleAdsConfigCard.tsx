'use client';

/**
 * GoogleAdsConfigCard
 *
 * Sits next to the unified Google Services card on /settings/integrations.
 * Google Ads needs TWO things on top of the central Google OAuth:
 *   1. A developer token (apply via https://ads.google.com/aw/apicenter)
 *   2. The operator's customer ID (the 10-digit Google Ads account number)
 *
 * This card walks through both — surfaces the central Google connect state
 * (read-only here; operator manages it via the parent Google Services card),
 * then collects the dev token + customer ID + optional MCC login-customer-id.
 *
 * Per the destructive-actions standing rule, saving config is non-destructive
 * — no two-step. (Two-step belongs on the eventual Apply path that actually
 * moves budget.)
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Caption, CardTitle } from '@/components/ui/typography';
import { logger } from '@/lib/logger/logger';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface AdsStatus {
  configured: boolean;
  googleAccountConnected: boolean;
  hasAdwordsScope: boolean;
  developerToken: boolean;
  customerId?: string;
  loginCustomerId?: string;
  diagnostic: string;
}

export default function GoogleAdsConfigCard() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<AdsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [developerToken, setDeveloperToken] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/integrations/google-ads/status');
      const data = (await res.json()) as { success?: boolean; status?: AdsStatus };
      if (data.status) {
        setStatus(data.status);
        if (data.status.customerId) {setCustomerId(data.status.customerId);}
        if (data.status.loginCustomerId) {setLoginCustomerId(data.status.loginCustomerId);}
      }
    } catch (err) {
      logger.error(
        'GoogleAdsConfigCard status fetch failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'GoogleAdsConfigCard.tsx' },
      );
      setMessage('Could not load Google Ads status. Refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    setMessage(null);
    if (!developerToken.trim()) {
      setMessage('Enter a developer token.');
      return;
    }
    if (!customerId.trim()) {
      setMessage('Enter your customer ID.');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/integrations/google-ads/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerToken: developerToken.trim(),
          customerId: customerId.trim(),
          ...(loginCustomerId.trim() ? { loginCustomerId: loginCustomerId.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) {
        setMessage(data.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      setMessage('Google Ads config saved.');
      setEditing(false);
      setDeveloperToken('');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Google Ads</CardTitle>
          <Caption>
            Read spend + write campaign-budget changes for BUDGET_STRATEGIST.
          </Caption>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={loading} aria-label="Refresh status">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </Button>
      </div>

      {/* Status checklist */}
      <div className="space-y-2 text-sm">
        <StatusRow
          ok={Boolean(status?.googleAccountConnected)}
          label="Google account connected"
          hint={
            status?.googleAccountConnected
              ? 'Managed via the Google Services card above.'
              : 'Connect Google first (Google Services card above).'
          }
        />
        <StatusRow
          ok={Boolean(status?.hasAdwordsScope)}
          label="Google Ads scope granted"
          hint={
            status?.hasAdwordsScope
              ? 'OAuth covers Google Ads read + write.'
              : 'Reconnect Google to grant the adwords scope.'
          }
        />
        <StatusRow
          ok={Boolean(status?.developerToken)}
          label="Developer token saved"
          hint={
            status?.developerToken
              ? 'Stored in apiKeys (encrypted at rest).'
              : 'Apply via Google Ads API Center, then paste below.'
          }
        />
        <StatusRow
          ok={Boolean(status?.customerId)}
          label="Customer ID saved"
          hint={
            status?.customerId
              ? `Configured: ${status.customerId}${status.loginCustomerId ? ` (MCC: ${status.loginCustomerId})` : ''}`
              : 'Find at the top-right of ads.google.com — 10 digits.'
          }
        />
      </div>

      {/* Diagnostic — the plain-English "what to do next" line. */}
      {status?.diagnostic && (
        <div className={`rounded-md border px-3 py-2 text-xs ${status.configured ? 'border-success/30 bg-success/5 text-success' : 'border-warning/30 bg-warning/5 text-warning'}`}>
          {status.configured ? <CheckCircle2 size={12} className="inline mr-1" /> : <AlertCircle size={12} className="inline mr-1" />}
          {status.diagnostic}
        </div>
      )}

      {/* Form: shown when not configured OR when operator clicks Edit. */}
      {(!status?.configured || editing) && status?.googleAccountConnected && status?.hasAdwordsScope && (
        <div className="space-y-3 pt-2 border-t border-border-light">
          <div className="space-y-1.5">
            <label htmlFor="ga-dev-token" className="text-sm font-medium text-foreground">
              Developer token
            </label>
            <Input
              id="ga-dev-token"
              type="password"
              autoComplete="off"
              value={developerToken}
              onChange={(e) => setDeveloperToken(e.target.value)}
              placeholder={status?.developerToken ? 'Enter a new token to replace the existing one' : 'paste developer token'}
            />
            <Caption>
              Get one at{' '}
              <a
                href="https://ads.google.com/aw/apicenter"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary inline-flex items-center gap-0.5"
              >
                ads.google.com/aw/apicenter <ExternalLink size={10} />
              </a>{' '}
              — basic access is usually approved in 1-5 business days.
            </Caption>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ga-cust-id" className="text-sm font-medium text-foreground">
                Customer ID
              </label>
              <Input
                id="ga-cust-id"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="123-456-7890"
              />
              <Caption>10 digits, found at top-right of ads.google.com.</Caption>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ga-login-cust-id" className="text-sm font-medium text-foreground">
                Login customer ID (MCC, optional)
              </label>
              <Input
                id="ga-login-cust-id"
                value={loginCustomerId}
                onChange={(e) => setLoginCustomerId(e.target.value)}
                placeholder="leave blank if no manager account"
              />
              <Caption>Only fill if the account is under a manager (MCC).</Caption>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Saving…</> : <><Sparkles size={14} className="mr-1.5" /> Save config</>}
            </Button>
            {editing && (
              <Button variant="outline" onClick={() => { setEditing(false); void refresh(); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Edit button when fully configured. */}
      {status?.configured && !editing && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit config
        </Button>
      )}

      {message && (
        <div className="text-xs text-muted-foreground">{message}</div>
      )}
    </div>
  );
}

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
      ) : (
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1">
        <div className={`text-sm font-medium ${ok ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</div>
        <Caption>{hint}</Caption>
      </div>
    </div>
  );
}
