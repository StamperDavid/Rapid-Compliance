'use client';

/**
 * Early-Access Signup Page
 *
 * Pre-launch lead capture. Submissions hit /api/public/early-access which
 * stores them in the standard `leads` collection so the operator can work
 * them via /entities/leads.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { logger } from '@/lib/logger/logger';
import { Sparkles, ArrowRight, CheckCircle2, Calendar, Loader2, Video } from 'lucide-react';

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

interface Slot {
  start: string;     // ISO datetime
  end: string;       // ISO datetime
  display: string;   // e.g. "2:00 PM"
}

interface SlotsResponse {
  slots: Slot[];
  date: string;
  timezone: string;
  duration?: number;
}

interface BookingApiResponse {
  success?: boolean;
  error?: string;
  booking?: {
    id: string;
    date: string;
    time: string;
    duration: number;
    startTime: string;
    endTime: string;
    zoomJoinUrl?: string | null;
    zoomCreationFailed?: boolean;
  };
}

interface DemoOutcome {
  status: 'booked' | 'snag' | 'slot_taken' | 'none';
  display?: string;     // human-readable confirmation, e.g. "Tuesday, Nov 4 at 2:00 PM"
  zoomJoinUrl?: string | null;
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

// Build the next N weekdays as a button row for the date selector.
function nextNWeekdays(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Start from tomorrow — same-day booking is rarely useful and often hits the
  // "no past slots" filter on the backend.
  cursor.setDate(cursor.getDate() + 1);
  while (out.length < n) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      const dd = String(cursor.getDate()).padStart(2, '0');
      out.push({
        value: `${yyyy}-${mm}-${dd}`,
        label: cursor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export default function EarlyAccessPage() {
  const [formData, setFormData] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo-scheduling state (revealed when the "Schedule a demo" checkbox is ticked).
  const [wantsDemo, setWantsDemo] = useState(false);
  const dateOptions = React.useMemo(() => nextNWeekdays(10), []);
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0]?.value ?? '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsTimezone, setSlotsTimezone] = useState<string>('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<DemoOutcome>({ status: 'none' });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const loadSlots = useCallback(async (date: string) => {
    if (!date) { return; }
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/booking?date=${encodeURIComponent(date)}`);
      if (!res.ok) {
        throw new Error('Could not load available times. Please try again.');
      }
      const data = (await res.json()) as SlotsResponse;
      setSlots(data.slots ?? []);
      setSlotsTimezone(data.timezone ?? '');
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : 'Could not load available times.');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Auto-fetch slots whenever the demo box is ticked or the date changes.
  React.useEffect(() => {
    if (wantsDemo && selectedDate) {
      void loadSlots(selectedDate);
    }
  }, [wantsDemo, selectedDate, loadSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Pre-flight: if demo is requested, a slot must be selected.
    if (wantsDemo && !selectedSlot) {
      setError('Pick a time for your demo or uncheck the demo option.');
      setSubmitting(false);
      return;
    }

    // Lead capture is the source-of-truth success. Demo booking is independent —
    // a Zoom hiccup or a slot-just-taken does NOT lose the lead.
    let leadOk = false;
    let leadErrorMsg: string | null = null;
    try {
      const res = await fetch('/api/public/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        leadErrorMsg = data.error ?? 'Something went wrong. Please try again.';
      } else {
        leadOk = true;
      }
    } catch (err) {
      leadErrorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      logger.error(
        'Early-access form submission failed',
        err instanceof Error ? err : new Error(leadErrorMsg ?? 'unknown'),
      );
    }

    let outcome: DemoOutcome = { status: 'none' };

    if (leadOk && wantsDemo && selectedSlot) {
      // Extract HH:MM from the slot's ISO start (the API expects local time, not UTC).
      const slotStart = new Date(selectedSlot.start);
      const hh = String(slotStart.getHours()).padStart(2, '0');
      const mm = String(slotStart.getMinutes()).padStart(2, '0');
      try {
        const bookingRes = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            time: `${hh}:${mm}`,
            name: formData.name,
            email: formData.email,
            phone: undefined,
            notes: formData.useCase || undefined,
            duration: 30,
          }),
        });
        const bookingData = (await bookingRes.json().catch(() => ({}))) as BookingApiResponse;
        if (bookingRes.status === 409) {
          outcome = { status: 'slot_taken' };
        } else if (!bookingRes.ok || !bookingData.success) {
          outcome = { status: 'snag' };
        } else {
          const dateLabel = slotStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          outcome = {
            status: 'booked',
            display: `${dateLabel} at ${selectedSlot.display}${slotsTimezone ? ` (${slotsTimezone})` : ''}`,
            zoomJoinUrl: bookingData.booking?.zoomJoinUrl ?? null,
          };
        }
      } catch (bookingErr) {
        outcome = { status: 'snag' };
        logger.error(
          'Demo booking failed during early-access submission',
          bookingErr instanceof Error ? bookingErr : new Error(String(bookingErr)),
        );
      }
    }

    if (leadOk) {
      setDemoOutcome(outcome);
      setSubmitted(true);
      setFormData(initialState);
      setWantsDemo(false);
      setSelectedSlot(null);
    } else {
      setError(leadErrorMsg ?? 'Something went wrong. Please try again.');
    }

    setSubmitting(false);
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
                <p className="text-lg text-gray-300 max-w-xl mx-auto mb-6">
                  We&apos;ll email you the moment SalesVelocity.ai is ready for you.
                </p>

                {demoOutcome.status === 'booked' && (
                  <div className="mt-2 mb-6 mx-auto max-w-xl rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-5 text-left">
                    <div className="flex items-center gap-2 text-indigo-200 font-semibold mb-2">
                      <Calendar className="w-5 h-5" />
                      Your demo is booked
                    </div>
                    <p className="text-gray-200 text-sm mb-2">
                      {demoOutcome.display} — calendar invite incoming.
                    </p>
                    {demoOutcome.zoomJoinUrl ? (
                      <a
                        href={demoOutcome.zoomJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200 underline"
                      >
                        <Video className="w-4 h-4" />
                        Join the Zoom meeting
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">
                        We&apos;ll email your Zoom link separately within the hour.
                      </p>
                    )}
                  </div>
                )}

                {demoOutcome.status === 'slot_taken' && (
                  <div className="mt-2 mb-6 mx-auto max-w-xl rounded-xl border border-yellow-400/40 bg-yellow-500/10 p-5 text-left">
                    <p className="text-yellow-200 text-sm">
                      That time slot was just taken by someone else. Your spot on the early-access list is saved — we&apos;ll reach out to find another time for the demo.
                    </p>
                  </div>
                )}

                {demoOutcome.status === 'snag' && (
                  <div className="mt-2 mb-6 mx-auto max-w-xl rounded-xl border border-yellow-400/40 bg-yellow-500/10 p-5 text-left">
                    <p className="text-yellow-200 text-sm">
                      We hit a snag booking your demo automatically — your spot on the early-access list is saved. We&apos;ll email you to set up the demo time.
                    </p>
                  </div>
                )}

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

                {/* Demo scheduling — checkbox reveals an inline slot picker. */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={wantsDemo}
                      onChange={(e) => setWantsDemo(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-white/20 bg-white/10 accent-indigo-500"
                    />
                    <span className="flex-1">
                      <span className="block text-base font-semibold text-white flex items-center gap-2">
                        <Video className="w-4 h-4 text-indigo-400" />
                        Schedule a demo while you&apos;re here
                      </span>
                      <span className="block text-sm text-gray-400 mt-1">
                        Lock in a 30-minute Zoom walkthrough with our team. Optional — your spot on the early-access list is already covered.
                      </span>
                    </span>
                  </label>

                  {wantsDemo && (
                    <div className="space-y-4 pt-2 border-t border-white/10">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Pick a day
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {dateOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setSelectedDate(opt.value)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                                selectedDate === opt.value
                                  ? 'bg-indigo-500/30 border-indigo-400 text-white'
                                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-300">
                            Pick a time
                          </label>
                          {slotsTimezone && (
                            <span className="text-xs text-gray-500">
                              Times shown in {slotsTimezone}
                            </span>
                          )}
                        </div>
                        {slotsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading available times…
                          </div>
                        ) : slotsError ? (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                            {slotsError}
                          </div>
                        ) : slots.length === 0 ? (
                          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm">
                            No times available that day. Try another.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const isSelected = selectedSlot?.start === slot.start;
                              return (
                                <button
                                  key={slot.start}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                                    isSelected
                                      ? 'bg-indigo-500/30 border-indigo-400 text-white'
                                      : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                                  }`}
                                >
                                  {slot.display}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {selectedSlot && (
                        <div className="text-sm text-indigo-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Selected: {selectedSlot.display}
                          {slotsTimezone ? ` (${slotsTimezone})` : ''}
                        </div>
                      )}
                    </div>
                  )}
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
