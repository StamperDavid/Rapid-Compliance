'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PublicLayout from '@/components/PublicLayout';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type UnsubscribeStatus = 'loading' | 'confirm' | 'processing' | 'success' | 'error' | 'manual';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get('contact');
  const emailId = searchParams.get('email');
  const org = searchParams.get('org');

  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    if (!contactId || !org) {
      // No token — show manual unsubscribe form instead of a hostile error.
      // People sometimes paste the URL, click old links, or arrive here by
      // mistake. Give them a path forward.
      setStatus('manual');
    } else {
      setStatus('confirm');
    }
  }, [contactId, org]);

  const handleUnsubscribe = useCallback(async () => {
    if (!contactId || !org) {return;}
    setStatus('processing');

    try {
      const res = await fetch('/api/public/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, emailId, org }),
      });

      if (res.ok) {
        setStatus('success');
      } else {
        const data: unknown = await res.json().catch(() => null);
        const msg = (data && typeof data === 'object' && 'error' in data)
          ? String((data as { error: string }).error)
          : 'Failed to process your request.';
        setErrorMessage(msg);
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again later.');
      setStatus('error');
    }
  }, [contactId, emailId, org]);

  const handleManualSubmit = useCallback(async () => {
    if (!manualEmail.trim()) {return;}
    setManualSubmitting(true);
    try {
      const res = await fetch('/api/public/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: manualEmail.trim() }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        const data: unknown = await res.json().catch(() => null);
        const msg = (data && typeof data === 'object' && 'error' in data)
          ? String((data as { error: string }).error)
          : 'We couldn\'t process that request. Please contact support.';
        setErrorMessage(msg);
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again later.');
      setStatus('error');
    } finally {
      setManualSubmitting(false);
    }
  }, [manualEmail]);

  return (
    <PublicLayout>
      <section className="pt-44 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-xl mx-auto">
          <div className="bg-card border border-border-strong rounded-2xl p-8 md:p-10">

            {/* Header — consistent for every state */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Email Preferences</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage what you receive from SalesVelocity.ai
                </p>
              </div>
            </div>

            {status === 'loading' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            )}

            {status === 'confirm' && (
              <>
                <p className="text-foreground mb-2">
                  You&apos;re about to unsubscribe from marketing emails.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  You&apos;ll still receive transactional messages related to your account
                  (booking confirmations, password resets, billing notices). This change
                  takes effect within a few minutes and can take up to 24 hours to fully
                  propagate to all systems.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => { void handleUnsubscribe(); }}
                    className="flex-1 bg-error text-primary-foreground font-medium py-3 px-6 rounded-lg hover:bg-error/90 transition"
                  >
                    Unsubscribe
                  </button>
                  <Link
                    href="/"
                    className="flex-1 text-center bg-surface-elevated text-foreground font-medium py-3 px-6 rounded-lg hover:bg-card-hover border border-border-light transition"
                  >
                    Keep me subscribed
                  </Link>
                </div>
              </>
            )}

            {status === 'processing' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing your request…
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-success flex-shrink-0" />
                  <div>
                    <p className="text-foreground font-semibold">You&apos;re unsubscribed.</p>
                    <p className="text-sm text-muted-foreground">
                      You will no longer receive marketing emails from us.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Changes can take up to 24 hours to fully propagate. If you keep getting
                  emails after that, reply to one of them and ask us to remove you manually.
                </p>
                <Link
                  href="/"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  ← Back to home
                </Link>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-error flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">Something went wrong</p>
                    <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  {contactId && org && (
                    <button
                      type="button"
                      onClick={() => { void handleUnsubscribe(); }}
                      className="text-sm text-primary hover:underline"
                    >
                      Try again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setStatus('manual'); setErrorMessage(''); }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Use email instead
                  </button>
                  <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                    Contact support
                  </Link>
                </div>
              </div>
            )}

            {status === 'manual' && (
              <div className="space-y-4">
                <p className="text-foreground">
                  Looks like you got here without a tracking link. No problem — enter the
                  email address you want to unsubscribe and we&apos;ll handle it.
                </p>
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => { setManualEmail(e.target.value); }}
                    placeholder="you@example.com"
                    className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => { void handleManualSubmit(); }}
                    disabled={!manualEmail.trim() || manualSubmitting}
                    className="flex-1 bg-error text-primary-foreground font-medium py-3 px-6 rounded-lg hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {manualSubmitting ? 'Submitting…' : 'Unsubscribe'}
                  </button>
                  <Link
                    href="/"
                    className="flex-1 text-center bg-surface-elevated text-foreground font-medium py-3 px-6 rounded-lg hover:bg-card-hover border border-border-light transition"
                  >
                    Cancel
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Need help instead?{' '}
                  <Link href="/contact" className="text-primary hover:underline">
                    Contact support
                  </Link>
                  {' · '}
                  <Link href="/" className="text-primary hover:underline">
                    Back to home
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
