/**
 * Activity Timeline Component
 * Displays chronological activity history for any CRM entity
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TimelineGroup, Activity, ActivityInsight, NextBestAction, ActivityStats } from '@/types/activity';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface InsightsData {
  insights: ActivityInsight[];
  nextBestAction: NextBestAction | null;
}

type FirestoreTimestamp = Date | string | { toDate: () => Date } | null | undefined;

interface ActivityTimelineProps {
  entityType: 'lead' | 'contact' | 'company' | 'deal';
  entityId: string;
  workspaceId?: string;
  showInsights?: boolean;
  showNextAction?: boolean;
  maxHeight?: string;
}

export default function ActivityTimeline({
  entityType,
  entityId,
  workspaceId = 'default',
  showInsights = true,
  showNextAction = true,
  maxHeight = '600px',
}: ActivityTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineGroup[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [insights, setInsights] = useState<ActivityInsight[]>([]);
  const [nextAction, setNextAction] = useState<NextBestAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load timeline
      const timelineRes = await fetch(
        `/api/crm/activities/timeline?entityType=${entityType}&entityId=${entityId}&workspaceId=${workspaceId}`
      );
      const timelineData = await timelineRes.json() as ApiResponse<TimelineGroup[]>;

      if (timelineData.success) {
        setTimeline(timelineData.data);
      }

      // Load stats
      const statsRes = await fetch(
        `/api/crm/activities/stats?entityType=${entityType}&entityId=${entityId}&workspaceId=${workspaceId}`
      );
      const statsData = await statsRes.json() as ApiResponse<ActivityStats>;

      if (statsData.success) {
        setStats(statsData.data);
      }

      // Load insights
      if (showInsights || showNextAction) {
        const insightsRes = await fetch(
          `/api/crm/activities/insights?entityType=${entityType}&entityId=${entityId}&workspaceId=${workspaceId}`
        );
        const insightsData = await insightsRes.json() as ApiResponse<InsightsData>;

        if (insightsData.success) {
          setInsights(insightsData.data.insights ?? []);
          setNextAction(insightsData.data.nextBestAction);
        }
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load activity timeline';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, workspaceId, showInsights, showNextAction]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getActivityIcon = (type: Activity['type']): string => {
    const icons: Record<string, string> = {
      email_sent: '📧',
      email_received: '📨',
      email_opened: '👀',
      email_clicked: '🖱️',
      call_made: '📞',
      call_received: '☎️',
      meeting_scheduled: '📅',
      meeting_completed: '✅',
      meeting_no_show: '❌',
      ai_chat: '🤖',
      note_added: '📝',
      task_created: '📋',
      task_completed: '✔️',
      form_submitted: '📋',
      website_visit: '🌐',
      document_viewed: '📄',
      deal_stage_changed: '🔄',
      lead_status_changed: '🔄',
      field_updated: '✏️',
      enrichment_completed: '✨',
      sequence_enrolled: '🎯',
      sequence_unenrolled: '🚫',
      workflow_triggered: '⚙️',
      sms_sent: '💬',
      sms_received: '💬',
    };
    return icons[type] || '•';
  };

  const formatActivityType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (date: string): string => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (timestamp: FirestoreTimestamp): string => {
    if (!timestamp) { return ''; }
    const tsWithToDate = timestamp as { toDate?: () => Date };
    const date = typeof tsWithToDate.toDate === 'function'
      ? tsWithToDate.toDate()
      : new Date(timestamp as string | Date);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[priority] || colors.low;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Activities</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalActivities}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Engagement Score</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.engagementScore ?? 0}/100
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Avg Per Day</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.avgActivitiesPerDay?.toFixed(1) ?? 0}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Last Activity</div>
            <div className="text-sm font-medium text-gray-900">
              {stats.lastActivityDate 
                ? new Date(stats.lastActivityDate).toLocaleDateString()
                : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* Next Best Action */}
      {showNextAction && nextAction && nextAction.action !== 'wait' && (
        <div className={`rounded-lg border-2 p-4 ${getPriorityColor(nextAction.priority)}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold">💡 Next Best Action</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(nextAction.priority)}`}>
                  {nextAction.priority.toUpperCase()}
                </span>
              </div>
              <div className="text-sm font-medium mb-1">
                {formatActivityType(nextAction.action)}
              </div>
              <div className="text-sm opacity-90">
                {nextAction.reasoning}
              </div>
              {nextAction.suggestedDueDate && (
                <div className="text-xs mt-2 opacity-75">
                  Suggested: {new Date(nextAction.suggestedDueDate).toLocaleDateString()}
                </div>
              )}
            </div>
            <button className="px-4 py-2 bg-white rounded-lg border-2 border-current text-sm font-medium hover:bg-opacity-90">
              Take Action
            </button>
          </div>
        </div>
      )}

      {/* Insights */}
      {showInsights && insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, idx) => {
            const bgColor = 
              insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' :
              insight.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' :
              'bg-blue-50 border-blue-200 text-blue-900';
            
            return (
              <div key={idx} className={`rounded-lg border p-3 ${bgColor}`}>
                <div className="font-medium text-sm">{insight.message}</div>
                {insight.recommendation && (
                  <div className="text-sm opacity-90 mt-1">
                    💡 {insight.recommendation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
        </div>
        
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {timeline.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              No activities yet
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {timeline.map((group) => (
                <div key={group.date}>
                  <div className="sticky top-0 bg-white pb-2 mb-3 border-b border-gray-200">
                    <div className="text-sm font-semibold text-gray-700">
                      {formatDate(group.date)}
                    </div>
                  </div>
                  
                  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                    {group.activities.map((activity) => (
                      <div key={activity.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[1.6rem] top-1 w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center text-xs">
                          {getActivityIcon(activity.type)}
                        </div>
                        
                        {/* Activity card */}
                        <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-medium text-sm text-gray-900">
                              {formatActivityType(activity.type)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(activity.occurredAt)}
                            </div>
                          </div>
                          
                          {activity.subject && (
                            <div className="text-sm text-gray-700 mb-1">
                              {activity.subject}
                            </div>
                          )}
                          
                          {activity.summary && (
                            <div className="text-sm text-gray-600">
                              {activity.summary}
                            </div>
                          )}
                          
                          {activity.body && !activity.summary && (
                            <div className="text-sm text-gray-600 line-clamp-2">
                              {activity.body}
                            </div>
                          )}
                          
                          {activity.createdByName && (
                            <div className="text-xs text-gray-500 mt-2">
                              by {activity.createdByName}
                            </div>
                          )}
                          
                          {/* Metadata badges */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {activity.metadata?.opens && activity.metadata.opens > 0 && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                {activity.metadata.opens} {activity.metadata.opens === 1 ? 'open' : 'opens'}
                              </span>
                            )}
                            {activity.metadata?.clicks && activity.metadata.clicks > 0 && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                {activity.metadata.clicks} {activity.metadata.clicks === 1 ? 'click' : 'clicks'}
                              </span>
                            )}
                            {activity.metadata?.callDuration && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                {Math.floor(activity.metadata.callDuration / 60)}m {activity.metadata.callDuration % 60}s
                              </span>
                            )}
                            {activity.metadata?.sentiment && (
                              <span className={`px-2 py-1 rounded text-xs ${
                                activity.metadata.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                activity.metadata.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {activity.metadata.sentiment}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

