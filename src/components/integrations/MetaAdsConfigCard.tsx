'use client';

/**
 * MetaAdsConfigCard
 *
 * Sits alongside GoogleAdsConfigCard in the Marketing Ads category. Meta
 * Ads has its OWN OAuth (separate from organic FB/IG posting and from the
 * unified Meta Services card) because it needs the ads_management scope
 * which requires App Review approval.
 *
 * UI flow:
 *   1. If not connected: Connect Meta Ads button → initiates OAuth flow.
 *   2. If connected with multiple ad accounts: account picker.
 *   3. If connected with one ad account: status + change-account button.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
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

interface MetaAdsStatus {
  configured: boolean;
  tokenPresent: boolean;
  tokenExpired: boolean;
  adAccountId?: string;
  scope: string[];
  diagnostic: string;
}

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  status: number;
}

export default function MetaAdsConfigCard() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<MetaAdsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showAdAccountPicker, setShowAdAccountPicker] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/integrations/meta-ads/status');
      const data = (await res.json()) as { success?: boolean; status?: MetaAdsStatus };
      if (data.status) {setStatus(data.status);}
    } catch (err) {
      logger.error(
        'MetaAdsConfigCard status fetch failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: 'MetaAdsConfigCard.tsx' },
      );
      setMessage('Could not load Meta Ads status.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/integrations/meta-ads/auth');
      const data = (await res.json()) as { success?: boolean; authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        setMessage(data.error ?? 'Could not start Meta Ads OAuth.');
        return;
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connect error');
    } finally {
      setConnecting(false);
    }
  };

  const loadAdAccounts = async () => {
    setLoadingAccounts(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/integrations/meta-ads/ad-accounts');
      const data = (await res.json()) as { success?: boolean; adAccounts?: AdAccount[]; selected?: string; error?: string };
      if (!res.ok || !data.adAccounts) {
        setMessage(data.error ?? 'Could not load ad accounts.');
        return;
      }
      setAdAccounts(data.adAccounts);
      setShowAdAccountPicker(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ad-account fetch error');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handlePickAccount = async (adAccountId: string) => {
    setSavingAccount(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/integrations/meta-ads/save-ad-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) {
        setMessage(data.error ?? 'Save failed.');
        return;
      }
      setMessage('Ad account saved.');
      setShowAdAccountPicker(false);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Meta Ads</CardTitle>
          <Caption>
            Facebook Marketing API — needs ads_management permission via App Review.
          </Caption>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void refresh()} disabled={loading} aria-label="Refresh status">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </Button>
      </div>

      {/* Status */}
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          {status?.configured ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1">
            <div className={`text-sm font-medium ${status?.configured ? 'text-foreground' : 'text-muted-foreground'}`}>
              {status?.configured ? 'Meta Ads connected' : 'Not connected'}
            </div>
            <Caption>{status?.diagnostic ?? 'Loading…'}</Caption>
          </div>
        </div>
        {status?.adAccountId && (
          <div className="flex items-start gap-2 pl-6">
            <Caption>
              Ad account: <span className="font-mono">{status.adAccountId}</span>
            </Caption>
          </div>
        )}
        {status?.scope && status.scope.length > 0 && (
          <div className="flex items-start gap-2 pl-6">
            <Caption>
              Scopes: {status.scope.join(', ')}
            </Caption>
          </div>
        )}
      </div>

      {!status?.configured && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertCircle size={12} className="inline mr-1" />
          Before connecting, the Meta App must have ads_management approved via{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
            App Review <ExternalLink size={10} />
          </a>
          . Review queues typically run days to weeks.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!status?.tokenPresent ? (
          <Button onClick={() => void handleConnect()} disabled={connecting}>
            {connecting ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Redirecting…</> : <><Sparkles size={14} className="mr-1.5" /> Connect Meta Ads</>}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => void handleConnect()} disabled={connecting}>
              Reconnect / refresh token
            </Button>
            <Button variant="outline" onClick={() => void loadAdAccounts()} disabled={loadingAccounts}>
              {loadingAccounts ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Loading…</> : 'Change ad account'}
            </Button>
          </>
        )}
      </div>

      {/* Ad-account picker */}
      {showAdAccountPicker && adAccounts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border-light">
          <Caption className="text-foreground">Pick an ad account to target:</Caption>
          <div className="space-y-1.5">
            {adAccounts.map((acct) => (
              <button
                key={acct.id}
                type="button"
                onClick={() => void handlePickAccount(acct.id)}
                disabled={savingAccount}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                  acct.id === status?.adAccountId
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border-light hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{acct.name}</div>
                    <Caption className="font-mono">{acct.id}</Caption>
                  </div>
                  <Caption>{acct.currency}</Caption>
                </div>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAdAccountPicker(false)}>
            Cancel
          </Button>
        </div>
      )}

      {message && (
        <div className="text-xs text-muted-foreground">{message}</div>
      )}
    </div>
  );
}
