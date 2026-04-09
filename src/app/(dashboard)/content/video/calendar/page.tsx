'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  CalendarDays,
  Plus,
  Loader2,
  Sparkles,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Film,
  X,
  Zap,
} from 'lucide-react';
import type {
  ContentCalendarWeek,
  BatchProject,
} from '@/types/video-pipeline';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string }> = {
  pending: { icon: Clock, color: 'text-zinc-400' },
  storyboarded: { icon: Film, color: 'text-blue-400' },
  approved: { icon: CheckCircle, color: 'text-amber-400' },
  generating: { icon: Loader2, color: 'text-amber-500' },
  completed: { icon: CheckCircle, color: 'text-green-400' },
  failed: { icon: AlertCircle, color: 'text-red-400' },
};

export default function ContentCalendarPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [weeks, setWeeks] = useState<ContentCalendarWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingWeekId, setGeneratingWeekId] = useState<string | null>(null);

  // Create modal state
  const [theme, setTheme] = useState('');
  const [weekName, setWeekName] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [topics, setTopics] = useState<Array<{ day: number; topic: string }>>(
    WEEKDAY_ORDER.map((d) => ({ day: d, topic: '' }))
  );

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/video/calendar');
      if (response.ok) {
        const data = await response.json() as { success: boolean; weeks: ContentCalendarWeek[] };
        if (data.success) {
          setWeeks(data.weeks);
        }
      }
    } catch {
      // Load error — keep empty state
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [authFetch]);

  // Load on first render
  if (!loaded && !loading) {
    void loadWeeks();
  }

  const handleAutoFillTopics = () => {
    if (!theme.trim()) {
      return;
    }
    const suffixes = [
      'Introduction & Overview',
      'Key Benefits & Features',
      'Customer Success Story',
      'How-To Tutorial',
      'Behind the Scenes',
      'Tips & Best Practices',
      'Week Recap & Preview',
    ];
    setTopics(
      WEEKDAY_ORDER.map((d, i) => ({ day: d, topic: `${theme}: ${suffixes[i]}` }))
    );
  };

  const handleCreate = async () => {
    if (!weekName.trim() || !theme.trim() || !weekStart) {
      return;
    }
    const filledTopics = topics.filter((t) => t.topic.trim());
    if (filledTopics.length === 0) {
      return;
    }

    setCreating(true);
    try {
      const response = await authFetch('/api/video/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: weekName,
          weekStartDate: weekStart,
          theme,
          topics: filledTopics.map((t) => ({
            dayOfWeek: t.day,
            topic: t.topic,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json() as { success: boolean; week: ContentCalendarWeek };
        if (data.success) {
          setWeeks((prev) => [data.week, ...prev]);
          setShowCreateModal(false);
          resetCreateForm();
        }
      }
    } catch {
      // Create error
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (weekId: string) => {
    try {
      const response = await authFetch(`/api/video/calendar?weekId=${weekId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setWeeks((prev) => prev.filter((w) => w.id !== weekId));
      }
    } catch {
      // Delete error
    }
  };

  const handleGenerateAll = async (weekId: string) => {
    setGeneratingWeekId(weekId);
    try {
      const response = await authFetch('/api/video/calendar/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId }),
      });
      if (response.ok) {
        // Reload weeks to get updated statuses
        await loadWeeks();
      }
    } catch {
      // Generation error — reload to show any partial progress
      await loadWeeks();
    } finally {
      setGeneratingWeekId(null);
    }
  };

  const resetCreateForm = () => {
    setTheme('');
    setWeekName('');
    setWeekStart('');
    setTopics(WEEKDAY_ORDER.map((d) => ({ day: d, topic: '' })));
  };

  const handleOpenProject = (project: BatchProject, week: ContentCalendarWeek) => {
    if (project.projectId) {
      // Linked — open existing pipeline project
      router.push(`/content/video?load=${project.projectId}`);
    } else {
      // Unlinked — open pipeline with topic pre-filled as brief
      const projectIndex = week.projects.findIndex((p) => p.id === project.id);
      const params = new URLSearchParams({
        brief: project.topic,
        batchWeekId: week.id,
        batchIndex: String(projectIndex),
      });
      router.push(`/content/video?${params.toString()}`);
    }
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  return (
    <div className="bg-zinc-950">
      {/* Navigation */}
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="px-6 pt-4 pb-0">
          <SubpageNav items={CONTENT_GENERATOR_TABS} />
        </div>
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-500" />
              Content <span className="text-amber-500">Calendar</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Plan a week of video content — batch create, review, and generate
            </p>
          </div>
          <Button
            onClick={() => {
              setShowCreateModal(true);
              if (!weekStart) { setWeekStart(getNextMonday()); }
            }}
            className="gap-2 bg-amber-600 hover:bg-amber-500"
          >
            <Plus className="w-4 h-4" />
            New Week
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && !loaded ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="ml-3 text-zinc-400">Loading calendar...</span>
          </div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-24">
            <CalendarDays className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
            <h2 className="text-lg font-semibold text-zinc-300 mb-2">No content weeks yet</h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
              Create a content week to batch-plan 7 days of video topics.
              Review all storyboards at once, then generate them sequentially.
            </p>
            <Button
              onClick={() => {
                setShowCreateModal(true);
                if (!weekStart) { setWeekStart(getNextMonday()); }
              }}
              className="gap-2 bg-amber-600 hover:bg-amber-500"
            >
              <Plus className="w-4 h-4" />
              Create Your First Week
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {weeks.map((week) => (
              <Card key={week.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-amber-500" />
                        {week.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Theme: {week.theme} — Week of{' '}
                        {new Date(week.weekStartDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          week.status === 'completed'
                            ? 'border-green-700 bg-green-950 text-green-400'
                            : week.status === 'generating'
                              ? 'border-amber-700 bg-amber-950 text-amber-400'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {week.status}
                      </span>
                      {week.projects.some((p) => p.projectId && (p.status === 'approved' || p.status === 'storyboarded')) && (
                        <Button
                          size="sm"
                          onClick={() => { void handleGenerateAll(week.id); }}
                          disabled={generatingWeekId === week.id}
                          className="gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs h-7"
                        >
                          {generatingWeekId === week.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3" />
                              Generate All
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void handleDelete(week.id); }}
                        className="text-zinc-500 hover:text-red-400 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                    {week.projects
                      .sort((a, b) => {
                        const aIdx = WEEKDAY_ORDER.indexOf(a.dayOfWeek);
                        const bIdx = WEEKDAY_ORDER.indexOf(b.dayOfWeek);
                        return aIdx - bIdx;
                      })
                      .map((project) => {
                        const statusInfo = STATUS_STYLES[project.status] || STATUS_STYLES.pending;
                        const StatusIcon = statusInfo.icon;
                        return (
                          <button
                            key={project.id}
                            onClick={() => handleOpenProject(project, week)}
                            className="text-left p-3 rounded-lg border border-zinc-800 hover:border-amber-500/30 transition-colors group"
                          >
                            <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                              {DAY_NAMES[project.dayOfWeek]}
                            </div>
                            <p className="text-xs text-zinc-300 line-clamp-2 mb-2 min-h-[2rem]">
                              {project.topic}
                            </p>
                            <div className={`flex items-center gap-1 text-[10px] ${statusInfo.color}`}>
                              <StatusIcon className={`w-3 h-3 ${project.status === 'generating' ? 'animate-spin' : ''}`} />
                              {project.projectId ? project.status : 'click to create'}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Week Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                Create Content Week
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Week name & date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Week Name</label>
                  <input
                    type="text"
                    value={weekName}
                    onChange={(e) => setWeekName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    placeholder="e.g., Product Launch Week"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Week Starts (Monday)</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Theme</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    placeholder="e.g., AI Sales Automation, Real Estate Tips"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFillTopics}
                    disabled={!theme.trim()}
                    className="gap-1 border-zinc-700"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Fill
                  </Button>
                </div>
              </div>

              {/* Daily topics */}
              <div>
                <label className="block text-xs text-zinc-500 mb-2">Daily Topics</label>
                <div className="space-y-2">
                  {topics.map((topic, index) => (
                    <div key={topic.day} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 w-12 text-right font-mono">
                        {DAY_NAMES[topic.day].slice(0, 3)}
                      </span>
                      <input
                        type="text"
                        value={topic.topic}
                        onChange={(e) => {
                          const updated = [...topics];
                          updated[index] = { ...updated[index], topic: e.target.value };
                          setTopics(updated);
                        }}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                        placeholder={`${DAY_NAMES[topic.day]} topic...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { void handleCreate(); }}
                disabled={creating || !weekName.trim() || !theme.trim() || topics.every((t) => !t.topic.trim())}
                className="gap-2 bg-amber-600 hover:bg-amber-500"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Create Week
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
