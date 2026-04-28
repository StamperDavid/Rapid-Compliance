'use client';

/**
 * Early-Access Signup Page
 *
 * Pre-launch lead capture. Submissions hit /api/public/early-access which
 * stores them in the standard `leads` collection so the operator can work
 * them via /entities/leads.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { logger } from '@/lib/logger/logger';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

const ROLE_OPTIONS = [
  'Founder / CEO',
  'Sales Lead',
  'Marketing Lead',
  'Operations',
  'Other',
] as const;

interface FormState {
  name: string;
  email: string;
  company: string;
  role: string;
  useCase: string;
  referralSource: string;
  // Honeypot — left visually hidden, expected to stay empty.
  website: string;
}

const initialState: FormState = {
  name: '',
  email: '',
  company: '',
  role: '',
  useCase: '',
  referralSource: '',
  website: '',
};

export default function EarlyAccessPage() {
  const [formData, setFormData] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/public/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
      setFormData(initialState);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      logger.error(
        'Early-access form submission failed',
        err instanceof Error ? err : new Error(msg)
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition';

  return (
    <PublicLayout>
        <section className="pt-44 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 rounded-full mb-6">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-indigo-300">Early Access</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Get early access to
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  SalesVelocity.ai
                </span>
              </h1>
              <p className="text-lg text-gray-200 max-w-2xl mx-auto mb-8">
                <span className="font-semibold text-white">Reserve your spot now &mdash; early access list members get skip-the-line priority onboarding when SalesVelocity.ai opens the doors.</span>{' '}
                Be the first in when we launch.
              </p>
              <ul className="inline-flex flex-col gap-2 text-left text-gray-300 text-base">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>Skip-the-line priority onboarding when we open</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>First-look access before public availability</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>No spam &mdash; we&apos;ll only email you when it&apos;s your turn</span>
                </li>
              </ul>
            </div>

            {/* Form / Success */}
            {submitted ? (
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-2xl p-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/40 mb-6">
                  <CheckCircle2 className="w-9 h-9 text-indigo-300" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">You&apos;re on the list.</h2>
                <p className="text-lg text-gray-300 max-w-xl mx-auto mb-8">
                  We&apos;ll email you the moment SalesVelocity.ai is ready for you.
                </p>
                <p className="text-sm text-gray-400 mb-8">— Team SalesVelocity.ai</p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 border border-white/20 transition"
                >
                  Back to home
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => { void handleSubmit(e); }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 space-y-6"
                noValidate
              >
                {/* Honeypot — visually hidden but present in the DOM. Real users won't fill it. */}
                <div aria-hidden="true" className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      maxLength={200}
                      value={formData.name}
                      onChange={(e) => update('name', e.target.value)}
                      className={inputClass}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Work email <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      maxLength={320}
                      value={formData.email}
                      onChange={(e) => update('email', e.target.value)}
                      className={inputClass}
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
                      Company name
                    </label>
                    <input
                      id="company"
                      type="text"
                      maxLength={200}
                      value={formData.company}
                      onChange={(e) => update('company', e.target.value)}
                      className={inputClass}
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
                      Role / title
                    </label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => update('role', e.target.value)}
                      className={`${inputClass} appearance-none cursor-pointer`}
                    >
                      <option value="" className="bg-gray-900">Select your role…</option>
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} className="bg-gray-900">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="useCase" className="block text-sm font-medium text-gray-300 mb-2">
                    What problem are you trying to solve?
                  </label>
                  <textarea
                    id="useCase"
                    rows={4}
                    maxLength={2000}
                    value={formData.useCase}
                    onChange={(e) => update('useCase', e.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Tell us what you&rsquo;d use SalesVelocity.ai for. The more detail, the better we can prioritize."
                  />
                </div>

                <div>
                  <label htmlFor="referralSource" className="block text-sm font-medium text-gray-300 mb-2">
                    How did you hear about us?
                  </label>
                  <input
                    id="referralSource"
                    type="text"
                    maxLength={200}
                    value={formData.referralSource}
                    onChange={(e) => update('referralSource', e.target.value)}
                    className={inputClass}
                    placeholder="Search, Twitter, a friend, etc."
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg hover:from-indigo-400 hover:to-purple-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding you to the list…' : (
                    <>
                      Join the early access list
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  We&apos;ll only email you about SalesVelocity.ai. No spam, no list selling.
                </p>
              </form>
            )}
          </div>
        </section>
    </PublicLayout>
  );
}
