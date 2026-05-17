'use client';

/**
 * Public SMS Opt-In Page (Toll-Free Verification Evidence)
 *
 * Lives at /sms-opt-in. Public — no authentication required. Exists so
 * Twilio toll-free verification reviewers can directly see the SMS
 * consent disclosure language and the working opt-in flow without
 * having to create a SalesVelocity.ai account first.
 *
 * Structure mirrors Twilio's published reference opt-in form so it
 * passes TFV review against the example reviewers compare against:
 * Full Name, Email, Phone Number, TWO separate consent checkboxes
 * (marketing vs non-marketing), and Terms + Privacy Policy linked on
 * the same page.
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentTransactional, setConsentTransactional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!consentMarketing && !consentTransactional) {
      setError(
        'Please check at least one consent box to subscribe. You may consent to marketing, non-marketing, or both.',
      );
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
        body: JSON.stringify({
          phoneNumber,
          email: email.trim() || undefined,
          name: name.trim() || undefined,
          consentMarketing,
          consentTransactional,
        }),
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
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">SMS opt-in</h1>
        <p className="mt-3 text-sm text-gray-400">
          Subscribe to receive text messages from {BRAND_NAME} at the mobile
          number you provide below. Messages are sent from {SMS_FROM_NUMBER}.
        </p>

        {/* Message-category disclosure block. Twilio toll-free verification
            requires the consent language to enumerate every message type
            the brand intends to send, with sample messages, frequency, and
            opt-out instructions. The two consent checkboxes below let the
            subscriber consent to marketing and non-marketing independently
            — mirroring Twilio's published reference opt-in form. */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
          <p className="font-medium text-white">Message categories</p>
          <p className="mt-2 text-gray-400">
            {BRAND_NAME} sends three types of SMS messages. You can consent to
            each independently below.
          </p>
          <ul className="mt-3 space-y-3">
            <li>
              <span className="font-semibold text-white">
                Account notifications
              </span>{' '}
              (non-marketing). Sign-in verification codes, password resets,
              billing alerts, and security notices.{' '}
              <span className="text-gray-400">
                Example: &ldquo;Your {BRAND_NAME} verification code is 482910.
                Reply STOP to opt out.&rdquo;
              </span>
            </li>
            <li>
              <span className="font-semibold text-white">Customer care</span>{' '}
              (non-marketing). Replies from our support team and one-to-one
              conversations you initiate with us.{' '}
              <span className="text-gray-400">
                Example: &ldquo;{BRAND_NAME} support here — your ticket #4421
                is resolved. Reply if you need anything else.&rdquo;
              </span>
            </li>
            <li>
              <span className="font-semibold text-white">Marketing.</span>{' '}
              Product announcements, feature releases, and promotional offers.{' '}
              <span className="text-gray-400">
                Example: &ldquo;New in {BRAND_NAME}: 2-way SMS now live. See
                what&apos;s shipping this month → svelo.ai/m. Reply STOP to opt
                out.&rdquo;
              </span>
            </li>
          </ul>
          <p className="mt-4 text-gray-400">
            Message frequency varies by category and by your activity. Message
            and data rates may apply. Reply{' '}
            <span className="font-semibold text-white">STOP</span> at any time
            to unsubscribe, or{' '}
            <span className="font-semibold text-white">HELP</span> for help.
          </p>
          <p className="mt-3 text-gray-400">
            {BRAND_NAME} does not sell, rent, lease, or share mobile phone
            numbers or SMS opt-in data with third parties for their marketing
            purposes. See our{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Privacy Policy
            </a>{' '}
            for full details on how we handle your data.
          </p>
        </div>

        <form onSubmit={(e) => { void submit(e); }} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-200">
              Full name <span className="text-gray-500">(optional)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your full name"
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

          {/* Two separate consent checkboxes — marketing and non-marketing —
              matching Twilio's published reference opt-in. Required for TFV
              approval when the submission declares multiple message use
              cases. SMS consent is intentionally NOT bundled with Terms of
              Service acceptance (Twilio TFV error 30513). */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentMarketing}
                onChange={(e) => setConsentMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-indigo-500"
              />
              <span className="text-sm leading-relaxed text-gray-300">
                I consent to receive recurring{' '}
                <strong className="text-white">marketing</strong> text messages
                from {BRAND_NAME} at the phone number provided — including
                product announcements, feature releases, and promotional
                offers. Frequency may vary. Message &amp; data rates may apply.
                Text HELP for assistance, reply STOP to opt out. Consent is not
                a condition of purchase.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentTransactional}
                onChange={(e) => setConsentTransactional(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-indigo-500"
              />
              <span className="text-sm leading-relaxed text-gray-300">
                I consent to receive recurring{' '}
                <strong className="text-white">non-marketing</strong> text
                messages from {BRAND_NAME} at the phone number provided —
                including account notifications (verification codes, password
                resets, billing alerts, security notices) and customer-care
                replies. Message &amp; data rates may apply. Text HELP for
                assistance, reply STOP to opt out.
              </span>
            </label>
          </div>

          {error !== null && (
            <p className="text-sm text-red-400" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || (!consentMarketing && !consentTransactional)}
            className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>

          <p className="pt-1 text-sm text-gray-400">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Terms of Service
            </a>{' '}
            &amp;{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              Privacy Policy
            </a>
          </p>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          SMS consent is independent of any other agreement with {BRAND_NAME} —
          you may use the platform without subscribing to SMS, and you may
          unsubscribe at any time by replying STOP.
        </p>
      </div>
    </main>
  );
}
