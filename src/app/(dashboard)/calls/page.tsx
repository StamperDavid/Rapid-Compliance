'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Phone, Plus, Play, Clock, Calendar, User, PhoneCall, Download, CalendarPlus, X as XIcon, Trash2 } from 'lucide-react';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getCallsCollection } from '@/lib/firebase/collections';
import { usePagination } from '@/hooks/usePagination';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { showErrorToast, showSuccessToast } from '@/components/ErrorToast';
import { logger } from '@/lib/logger/logger';
import { type QueryConstraint, type DocumentData, type QueryDocumentSnapshot, orderBy } from 'firebase/firestore';

interface Call {
  id: string;
  contactName?: string;
  phoneNumber?: string;
  duration?: number;
  status?: string;
  createdAt?: string | number | Date;
  recordingUrl?: string;
}

interface ScheduledCallItem {
  id: string;
  to: string;
  recipientName?: string;
  contactId?: string;
  goal: string;
  scheduledFor: string;
  status: 'scheduled' | 'firing' | 'fired' | 'failed' | 'cancelled';
  createdAt: string;
  lastError?: string;
  callSid?: string;
}

interface ScheduleListResponse {
  success: boolean;
  total?: number;
  scheduledCalls?: ScheduledCallItem[];
  error?: string;
}

interface ScheduleCreateResponse {
  success: boolean;
  scheduledCall?: ScheduledCallItem;
  calendarLink?: string | null;
  error?: string;
}

interface ScheduleCancelResponse {
  success: boolean;
  error?: string;
}

const FILE = 'calls/page.tsx';

/**
 * Convert an ISO datetime string to the local-time `<input type="datetime-local">`
 * value (YYYY-MM-DDTHH:mm). The native picker expects local time without
 * a timezone suffix.
 */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) { return ''; }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert a `<input type="datetime-local">` value (local time, no TZ) to
 * an ISO-8601 string with the local TZ offset. Returns null if invalid.
 */
function localInputToIso(value: string): string | null {
  if (!value) { return null; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { return null; }
  return d.toISOString();
}

function formatDuration(seconds?: number): string {
  if (!seconds) { return '-'; }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(timestamp?: string | number | Date): string {
  if (!timestamp) { return '-'; }
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function CallLogPage(): JSX.Element {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [activeTab, setActiveTab] = useState('history');

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // ─── Call history (pagination) ─────────────────────────────────────────
  const fetchCalls = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData>): Promise<{
    data: Call[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    const result = await FirestoreService.getAllPaginated(
      getCallsCollection(),
      constraints,
      50,
      lastDoc,
    );
    return {
      data: result.data as Call[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, []);

  const {
    data: calls,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePagination<Call, QueryDocumentSnapshot<DocumentData>>({ fetchFn: fetchCalls });

  useEffect(() => { void refresh(); }, [refresh]);

  // ─── Scheduled calls list ──────────────────────────────────────────────
  const [scheduled, setScheduled] = useState<ScheduledCallItem[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const loadScheduled = useCallback(async (): Promise<void> => {
    setLoadingScheduled(true);
    try {
      const res = await authFetch('/api/voice/calls/schedule?status=scheduled');
      const json = (await res.json()) as ScheduleListResponse;
      if (res.ok && json.success && json.scheduledCalls) {
        setScheduled(json.scheduledCalls);
      } else {
        setScheduled([]);
        if (!res.ok) {
          logger.warn('Failed to load scheduled calls', { file: FILE, status: res.status });
        }
      }
    } catch (err) {
      logger.error('loadScheduled error', err instanceof Error ? err : new Error(String(err)), { file: FILE });
      setScheduled([]);
    } finally {
      setLoadingScheduled(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeTab === 'scheduled') { void loadScheduled(); }
  }, [activeTab, loadScheduled]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center flex-wrap gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Call Log</PageTitle>
            <SectionDescription className="mt-1">View call history and schedule future calls</SectionDescription>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setScheduleDialogOpen(true)}
            className="gap-2"
          >
            <CalendarPlus className="w-4 h-4" />
            Schedule a call
          </Button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/calls/make`)}
            className="px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Make Call
          </motion.button>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled{scheduled.length > 0 ? ` (${scheduled.length})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* History tab */}
        <TabsContent value="history">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-error/30 rounded-xl text-error bg-error/10 backdrop-blur-xl mb-4"
            >
              <p className="flex items-center gap-2">
                <span className="text-error">⚠</span>
                {error}
              </p>
            </motion.div>
          )}

          {calls.length === 0 && !loading ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl p-12 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <PhoneCall className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No calls yet</h3>
              <p className="text-muted-foreground">Start making calls to see your log here.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Contact
                        </div>
                      </th>
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Number
                        </div>
                      </th>
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Duration
                        </div>
                      </th>
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date
                        </div>
                      </th>
                      <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">
                        Recording
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call, index) => (
                      <motion.tr
                        key={call.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border-b border-border-light hover:bg-surface-elevated transition-colors duration-200"
                      >
                        <td className="p-4">
                          <span className="font-medium text-foreground">
                            {call.contactName ?? 'Unknown'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-muted-foreground font-mono text-sm">
                            {call.phoneNumber ?? '-'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-muted-foreground font-mono text-sm">
                            {formatDuration(call.duration)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30">
                            {call.status ?? 'pending'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-muted-foreground text-sm">
                            {formatDateTime(call.createdAt)}
                          </span>
                        </td>
                        <td className="p-4">
                          {call.recordingUrl ? (
                            <motion.a
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              href={call.recordingUrl}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/20 to-secondary/20 hover:from-primary/30 hover:to-secondary/30 text-primary rounded-lg border border-primary/30 transition-all duration-200 text-sm font-medium"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Listen
                            </motion.a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(hasMore || loading) && (
                <div className="p-6 border-t border-border-light flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { void loadMore(); }}
                    disabled={loading || !hasMore}
                    className="px-6 py-3 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Loading...
                      </span>
                    ) : hasMore ? (
                      <span className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Load More ({calls.length} shown)
                      </span>
                    ) : (
                      'All calls loaded'
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </TabsContent>

        {/* Scheduled tab */}
        <TabsContent value="scheduled">
          <ScheduledCallsTab
            items={scheduled}
            loading={loadingScheduled}
            onRefresh={() => { void loadScheduled(); }}
          />
        </TabsContent>
      </Tabs>

      {/* Schedule dialog */}
      <ScheduleCallDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onScheduled={() => {
          setScheduleDialogOpen(false);
          // Move to scheduled tab so the user sees what they just created.
          setActiveTab('scheduled');
          void loadScheduled();
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Schedule dialog
// ────────────────────────────────────────────────────────────────────────────

interface ScheduleCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled: () => void;
}

function ScheduleCallDialog({ open, onOpenChange, onScheduled }: ScheduleCallDialogProps): JSX.Element {
  const authFetch = useAuthFetch();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [goal, setGoal] = useState('');
  // Default the picker to "1 hour from now" rounded to the next 15 min.
  const defaultLocal = (() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return isoToLocalInput(d.toISOString());
  })();
  const [whenLocal, setWhenLocal] = useState(defaultLocal);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!phoneNumber.trim()) {
      showErrorToast(new Error('Phone number is required'), 'Phone number is required');
      return;
    }
    if (!goal.trim()) {
      showErrorToast(new Error('Goal is required'), 'Tell us why we are calling');
      return;
    }
    const iso = localInputToIso(whenLocal);
    if (!iso) {
      showErrorToast(new Error('Pick a valid date and time'), 'Pick a valid date and time');
      return;
    }
    if (new Date(iso).getTime() <= Date.now()) {
      showErrorToast(new Error('Time must be in the future'), 'Schedule time must be in the future');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/voice/calls/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber.trim(),
          recipientName: recipientName.trim() === '' ? undefined : recipientName.trim(),
          goal: goal.trim(),
          scheduledFor: iso,
        }),
      });
      const json = (await res.json()) as ScheduleCreateResponse;
      if (res.ok && json.success) {
        showSuccessToast('Call scheduled — added to your Google Calendar.');
        // Reset for next use.
        setPhoneNumber('');
        setRecipientName('');
        setGoal('');
        setWhenLocal(defaultLocal);
        onScheduled();
      } else {
        showErrorToast(new Error(json.error ?? 'Failed to schedule call'), json.error ?? 'Failed to schedule call');
      }
    } catch (err) {
      logger.error('schedule call submit failed', err instanceof Error ? err : new Error(String(err)), { file: FILE });
      showErrorToast(err, 'Failed to schedule call');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Schedule a call</DialogTitle>
          <DialogDescription>
            The call will fire automatically at the chosen time and appear in your connected Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Phone number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+15551234567"
              className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">E.164 format (e.g. +15551234567).</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recipient name (optional)</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Sarah Chen"
              className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Goal of the call</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Follow up on the demo from last week..."
              rows={3}
              className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">When</label>
            <input
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => { void handleSubmit(); }} disabled={submitting}>
            {submitting ? 'Scheduling…' : 'Schedule call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Scheduled tab + per-row two-step cancel
// ────────────────────────────────────────────────────────────────────────────

interface ScheduledCallsTabProps {
  items: ScheduledCallItem[];
  loading: boolean;
  onRefresh: () => void;
}

function ScheduledCallsTab({ items, loading, onRefresh }: ScheduledCallsTabProps): JSX.Element {
  if (loading && items.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">Loading scheduled calls…</div>
    );
  }
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl p-12 text-center"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
          <CalendarPlus className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No scheduled calls</h3>
        <p className="text-muted-foreground">Use &ldquo;Schedule a call&rdquo; above to plan a future-time call.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-light">
              <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">Recipient</th>
              <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">Number</th>
              <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">Goal</th>
              <th className="text-left p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">Fires at</th>
              <th className="text-right p-4 text-muted-foreground font-semibold text-sm uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ScheduledCallRow key={item.id} item={item} onChanged={onRefresh} />
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

interface ScheduledCallRowProps {
  item: ScheduledCallItem;
  onChanged: () => void;
}

function ScheduledCallRow({ item, onChanged }: ScheduledCallRowProps): JSX.Element {
  const authFetch = useAuthFetch();
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); }
  }, []);

  const armCancel = (): void => {
    setCancelArmed(true);
    if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); }
    cancelTimerRef.current = setTimeout(() => {
      setCancelArmed(false);
      cancelTimerRef.current = null;
    }, 5000);
  };

  const disarmCancel = (): void => {
    setCancelArmed(false);
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelling(true);
    try {
      const res = await authFetch(`/api/voice/calls/schedule/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as ScheduleCancelResponse;
      if (res.ok && json.success) {
        showSuccessToast('Scheduled call cancelled.');
        disarmCancel();
        onChanged();
      } else {
        showErrorToast(new Error(json.error ?? 'Failed to cancel'), json.error ?? 'Failed to cancel');
      }
    } catch (err) {
      logger.error('cancel scheduled call failed', err instanceof Error ? err : new Error(String(err)), { file: FILE });
      showErrorToast(err, 'Failed to cancel call');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <tr className="border-b border-border-light hover:bg-surface-elevated transition-colors duration-200">
      <td className="p-4">
        <span className="font-medium text-foreground">{item.recipientName ?? item.to}</span>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground font-mono text-sm">{item.to}</span>
      </td>
      <td className="p-4 max-w-[320px]">
        <span className="text-muted-foreground text-sm line-clamp-2">{item.goal}</span>
      </td>
      <td className="p-4">
        <span className="text-foreground text-sm">{formatDateTime(item.scheduledFor)}</span>
      </td>
      <td className="p-4">
        <div className="flex justify-end gap-2">
          {/*
            Two-step cancel — first click arms ("Click again to confirm" +
            ghost X disarm button), second click fires. Auto-disarms after
            5s. Required by `feedback_destructive_actions_two_step_confirmation`.
          */}
          {cancelArmed ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { void handleCancel(); }}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Click again to confirm'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={disarmCancel}
                disabled={cancelling}
                aria-label="Cancel cancellation"
              >
                <XIcon className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={armCancel}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
