'use client';

/**
 * Public SMS Opt-In Page (Toll-Free Verification Evidence)
 *
 * Lives at /sms-opt-in. Public — no authentication required. Exists so
 * Twilio toll-free verification reviewers can directly see the SMS
 * consent disclosure language and the working opt-in flow without
 * having to create a SalesVelocity.ai account first.
 *
 * The same disclosure copy is also shown during the authenticated
 * onboarding flow at /onboarding/industry. Keep the two in sync.
 *
 * Submissions are saved to tcpa_consent via /api/public/sms-opt-in.
 */

import { useState } from 'react';
import Link from 'next/link';

const BRAND_NAME = 'SalesVelocity.ai';
const SMS_FROM_NUMBER = '+1 (844) 955-3015';

interface ApiResponse {
  success?: boolean;
  error?: string;
}

export default function SmsOptInPage(): React.ReactElement {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError('Please check the consent box to continue.');
      return;
    }
    if (phoneNumber.replace(/[^\d]/g, '').length < 10) {
      setError('Please enter a valid 10-digit US phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/sms-opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, email: email.trim() || undefined }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h1 className="text-2xl font-semibold text-white">You&apos;re subscribed.</h1>
          <p className="mt-3 text-gray-300">
            Thanks. We&apos;ll send a confirmation text to the number you provided
            from {SMS_FROM_NUMBER}. Reply STOP at any time to unsubscribe.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">SMS notifications</h1>
        <p className="mt-3 text-sm text-gray-400">
          Get account, billing, and customer-care updates from {BRAND_NAME} via
          text message.
        </p>

        <form onSubmit={(e) => { void submit(e); }} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-200">
              Mobile phone number <span className="text-red-400">*</span>
            </span>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="(555) 123-4567"
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-200">
              Email <span className="text-gray-500">(optional)</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </label>

          {/* The consent disclosure below MUST stay in sync with the
              equivalent UI on /onboarding/industry. CTIA-compliant:
              brand, message types, frequency, rates, STOP/HELP, privacy
              policy link. SMS consent is intentionally NOT bundled with
              Terms of Service acceptance — Twilio toll-free verification
              error 30513 specifically calls that out. */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-indigo-500"
              />
              <span className="text-sm leading-relaxed text-gray-300">
                Yes, I agree to receive recurring text messages from {BRAND_NAME}
                at the phone number provided, including account notifications,
                marketing updates, and customer-care messages. Message frequency
                varies. Message and data rates may apply. Reply STOP to opt out,
                HELP for help. See our{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline hover:text-indigo-300"
                >
                  Privacy Policy
                </a>
                {' '}for details on how we handle your data.
              </span>
            </label>
          </div>

          {error !== null && (
            <p className="text-sm text-red-400" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !consent}
            className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Subscribe to SMS updates'}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Messages will be sent from {SMS_FROM_NUMBER}. SMS consent is independent
          of any other agreement with {BRAND_NAME} — you may use the platform
          without subscribing to SMS.
        </p>
      </div>
    </main>
  );
}
