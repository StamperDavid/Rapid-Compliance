'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger/logger';

interface TimeSlot {
  start: string;
  end: string;
  display: string;
}

interface SlotsResponse {
  slots: TimeSlot[];
  date: string;
  timezone: string;
  duration: number;
}

interface BookingResponse {
  success: boolean;
  booking?: {
    id: string;
    date: string;
    time: string;
    duration: number;
  };
  error?: string;
}

type BookingStep = 'date' | 'time' | 'details' | 'confirmed';

export default function BookingPage() {
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Generate next 14 days for date selection
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6); // skip weekends

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setError('');
    try {
      const res = await fetch(`/api/booking?date=${date}`);
      const data = await res.json() as SlotsResponse;
      setSlots(data.slots ?? []);
    } catch (err: unknown) {
      logger.error('Failed to fetch slots', err instanceof Error ? err : new Error(String(err)));
      setError('Failed to load availability');
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      void fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep('time');
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !selectedDate) { return; }
    setSubmitting(true);
    setError('');

    const slotTime = new Date(selectedSlot.start);
    const time = `${String(slotTime.getHours()).padStart(2, '0')}:${String(slotTime.getMinutes()).padStart(2, '0')}`;

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time, name, email, phone: phone || undefined, notes: notes || undefined }),
      });
      const data = await res.json() as BookingResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Booking failed');
      }
      setStep('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-surface-main flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Book a Meeting</h1>
          <p className="text-[var(--color-text-secondary)]">Choose a time that works for you</p>
        </div>

        <div className="bg-surface-elevated border border-border-light rounded-2xl p-6 shadow-xl">
          {/* Step: Date Selection */}
          {step === 'date' && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Select a Date</h2>
              <div className="grid grid-cols-3 gap-2">
                {availableDates.map(d => (
                  <button
                    key={d.toISOString()}
                    onClick={() => handleDateSelect(d)}
                    className="p-3 rounded-xl border border-border-light hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-sm text-center transition-all text-[var(--color-text-primary)]"
                  >
                    <div className="font-semibold">{formatDate(d)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Time Selection */}
          {step === 'time' && (
            <div>
              <button onClick={() => setStep('date')} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
                &larr; Change date
              </button>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Select a Time</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">{selectedDate}</p>

              {loadingSlots ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">Loading available times...</div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">No available times for this date. Please try another day.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {slots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => handleSlotSelect(slot)}
                      className="p-2.5 rounded-xl border border-border-light hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 text-sm font-medium transition-all text-[var(--color-text-primary)]"
                    >
                      {slot.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Contact Details */}
          {step === 'details' && (
            <div>
              <button onClick={() => setStep('time')} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
                &larr; Change time
              </button>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Your Details</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {selectedDate} at {selectedSlot?.display}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                    className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface-main text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface-main text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(optional)"
                    className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface-main text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Notes</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What would you like to discuss? (optional)"
                    className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface-main text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>

                {error && <p className="text-sm text-error">{error}</p>}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={!name.trim() || !email.trim() || submitting}
                  className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-primary to-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Confirmation */}
          {step === 'confirmed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Booking Confirmed!</h2>
              <p className="text-[var(--color-text-secondary)] mb-1">{selectedDate} at {selectedSlot?.display}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">A confirmation email has been sent to {email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
