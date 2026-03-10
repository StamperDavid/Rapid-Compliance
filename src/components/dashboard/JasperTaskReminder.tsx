'use client';

/**
 * Jasper Task Reminder
 *
 * Shows a dismissable banner on the dashboard with pending setup tasks.
 * Jasper greets the user and lists what needs to be completed.
 * Reappears each session until all tasks are done.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { CheckCircle2, Circle, X, Sparkles, ChevronRight } from 'lucide-react';

interface SetupTask {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  actionUrl: string;
  priority: number;
}

interface OnboardingStatus {
  tasks: SetupTask[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
}

const SESSION_KEY = 'jasper-task-reminder-dismissed';

export function JasperTaskReminder() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Check session dismissal
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(SESSION_KEY);
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  // Fetch onboarding status
  useEffect(() => {
    if (dismissed) { return; }

    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch('/api/onboarding/status');
        if (cancelled) { return; }

        if (response.ok) {
          const data = (await response.json()) as OnboardingStatus;
          setStatus(data);
        }
      } catch {
        // Silently fail — don't block the dashboard
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [authFetch, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem(SESSION_KEY, 'true');
  }, []);

  const handleTaskClick = useCallback((url: string) => {
    router.push(url);
  }, [router]);

  // Don't render if dismissed, loading, all complete, or no data
  if (dismissed || loading || !status || status.allComplete) {
    return null;
  }

  const pendingTasks = status.tasks.filter((t) => !t.completed);
  const completedTasks = status.tasks.filter((t) => t.completed);
  const progressPercent = Math.round((status.completedCount / status.totalCount) * 100);

  // Jasper greeting based on progress
  const greeting = status.completedCount === 0
    ? "Welcome! I'm Jasper, your AI sales partner. Let's get your workspace set up — here's what we need to do:"
    : `Great progress! You've completed ${status.completedCount} of ${status.totalCount} setup tasks. Here's what's left:`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="mb-6 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 backdrop-blur-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Jasper — Setup Assistant</h3>
              <p className="text-xs text-gray-400 mt-0.5">{greeting}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Setup progress</span>
            <span className="text-xs font-medium text-indigo-400">{progressPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Task list */}
        <div className="px-5 pb-4 pt-1">
          <div className="space-y-1.5">
            {/* Pending tasks first */}
            {pendingTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task.actionUrl)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors group"
              >
                <Circle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 group-hover:text-white transition-colors">
                    {task.label}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{task.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
              </button>
            ))}

            {/* Completed tasks (collapsed) */}
            {completedTasks.length > 0 && (
              <div className="pt-1 border-t border-white/5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-3 py-1.5 opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-gray-400 line-through">{task.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
