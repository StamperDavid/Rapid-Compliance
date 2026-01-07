/**
 * Team Collaboration Features
 * - @mentions in notes/comments
 * - Task assignment
 * - Team leaderboards
 * - Activity goals
 * - Performance tracking
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

export interface TeamComment {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityType: 'lead' | 'contact' | 'deal' | 'company';
  entityId: string;
  content: string;
  mentions: string[]; // User IDs mentioned with @
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TeamTask {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  description?: string;
  assignedTo: string;
  assignedToName?: string;
  assignedBy: string;
  assignedByName?: string;
  dueDate?: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'blocked' | 'completed';
  relatedEntityType?: 'lead' | 'contact' | 'deal';
  relatedEntityId?: string;
  tags?: string[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userEmail: string;
  metrics: {
    leadsCreated: number;
    dealsClosed: number;
    revenueGenerated: number;
    activitiesLogged: number;
    tasksCompleted: number;
    avgResponseTime?: number; // minutes
    winRate?: number; // percentage
  };
  rank: number;
  points: number; // Gamification score
  badges?: string[];
}

export interface ActivityGoal {
  id: string;
  organizationId: string;
  userId: string;
  goalType: 'calls' | 'emails' | 'meetings' | 'deals' | 'revenue';
  target: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  current: number;
  progress: number; // 0-100
  status: 'on_track' | 'at_risk' | 'behind';
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

/**
 * Create a comment with @mentions
 */
export async function createComment(
  organizationId: string,
  workspaceId: string,
  data: Omit<TeamComment, 'id' | 'createdAt' | 'mentions' | 'organizationId' | 'workspaceId'>
): Promise<TeamComment> {
  try {
    // Extract @mentions from content
    const mentions = extractMentions(data.content);

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const comment: TeamComment = {
      ...data,
      id: commentId,
      organizationId,
      workspaceId,
      mentions,
      createdAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/comments`,
      commentId,
      comment,
      false
    );

    // Send notifications to mentioned users
    if (mentions.length > 0) {
      await notifyMentionedUsers(organizationId, comment, mentions);
    }

    logger.info('Comment created', { commentId, mentions: mentions.length });

    return comment;

  } catch (error: any) {
    logger.error('Failed to create comment', error);
    throw error;
  }
}

/**
 * Extract @mentions from content
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex) || [];
  return matches.map(m => m.substring(1)); // Remove @
}

/**
 * Notify users who were mentioned
 */
async function notifyMentionedUsers(
  organizationId: string,
  comment: TeamComment,
  mentionedUserIds: string[]
): Promise<void> {
  try {
    const { sendEmail } = await import('@/lib/email/email-service');

    for (const userId of mentionedUserIds) {
      // Get user email
      const user = await FirestoreService.get<any>(
        `organizations/${organizationId}/members`,
        userId
      );

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `${comment.authorName} mentioned you in a comment`,
          text: `${comment.authorName} mentioned you:\n\n"${comment.content}"\n\nView in CRM: [LINK]`,
          metadata: { organizationId },
        });
      }
    }

  } catch (error) {
    logger.warn('Failed to notify mentioned users', { error: error });
  }
}

/**
 * Create and assign task
 */
export async function createTask(
  organizationId: string,
  workspaceId: string,
  task: Omit<TeamTask, 'id' | 'createdAt' | 'organizationId' | 'workspaceId'>
): Promise<TeamTask> {
  try {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const newTask: TeamTask = {
      ...task,
      id: taskId,
      organizationId,
      workspaceId,
      createdAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/tasks`,
      taskId,
      newTask,
      false
    );

    // Notify assigned user
    await notifyTaskAssignment(organizationId, newTask);

    logger.info('Task created and assigned', {
      taskId,
      assignedTo: task.assignedTo,
    });

    return newTask;

  } catch (error: any) {
    logger.error('Failed to create task', error);
    throw error;
  }
}

/**
 * Notify user of task assignment
 */
async function notifyTaskAssignment(
  organizationId: string,
  task: TeamTask
): Promise<void> {
  try {
    const { sendEmail } = await import('@/lib/email/email-service');

    const user = await FirestoreService.get<any>(
      `organizations/${organizationId}/members`,
      task.assignedTo
    );

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `New task assigned: ${task.title}`,
        text: `${task.assignedByName} assigned you a task:\n\nTitle: ${task.title}\nPriority: ${task.priority}\nDue: ${task.dueDate?.toLocaleDateString() || 'No due date'}\n\n${task.description || ''}`,
        metadata: { organizationId },
      });
    }

  } catch (error) {
    logger.warn('Failed to notify task assignment', { error: error });
  }
}

/**
 * Calculate team leaderboard
 */
export async function calculateLeaderboard(
  organizationId: string,
  workspaceId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<LeaderboardEntry[]> {
  try {
    // Get all team members
    const membersResult = await FirestoreService.getAll<any>(
      `organizations/${organizationId}/members`
    );

    const members = membersResult;
    const leaderboard: LeaderboardEntry[] = [];

    // Calculate period start date
    const now = new Date();
    const startDate = new Date();
    if (period === 'week') {startDate.setDate(now.getDate() - 7);}
    else if (period === 'month') {startDate.setMonth(now.getMonth() - 1);}
    else if (period === 'quarter') {startDate.setMonth(now.getMonth() - 3);}
    else {startDate.setFullYear(now.getFullYear() - 1);}

    // Calculate metrics for each member
    for (const member of members) {
      const metrics = await calculateUserMetrics(
        organizationId,
        workspaceId,
        member.userId,
        startDate,
        now
      );

      // Calculate gamification points
      const points = 
        metrics.leadsCreated * 10 +
        metrics.dealsClosed * 100 +
        (metrics.revenueGenerated / 1000) +
        metrics.activitiesLogged * 2 +
        metrics.tasksCompleted * 5;

      leaderboard.push({
        userId: member.userId,
        userName: member.name || member.email,
        userEmail: member.email,
        metrics,
        rank: 0, // Will be set after sorting
        points: Math.round(points),
      });
    }

    // Sort by points and assign ranks
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    logger.info('Leaderboard calculated', {
      organizationId,
      period,
      teamSize: leaderboard.length,
    });

    return leaderboard;

  } catch (error: any) {
    logger.error('Failed to calculate leaderboard', error, { organizationId });
    throw error;
  }
}

/**
 * Calculate metrics for a user
 */
async function calculateUserMetrics(
  organizationId: string,
  workspaceId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<LeaderboardEntry['metrics']> {
  try {
    const { getLeads } = await import('@/lib/crm/lead-service');
    const { getDeals } = await import('@/lib/crm/deal-service');
    const { getActivities } = await import('@/lib/crm/activity-service');

    // Get leads created by user
    const leadsResult = await getLeads(organizationId, workspaceId, { ownerId: userId }, { pageSize: 1000 });
    const leadsInPeriod = leadsResult.data.filter(l => {
      const createdAt = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
      return createdAt >= startDate && createdAt <= endDate;
    });

    // Get deals closed by user
    const dealsResult = await getDeals(organizationId, workspaceId, { ownerId: userId }, { pageSize: 1000 });
    const dealsClosedWon = dealsResult.data.filter(d => {
      if (d.stage !== 'closed_won') {return false;}
      const closedAt = d.actualCloseDate?.toDate ? d.actualCloseDate.toDate() : new Date(d.actualCloseDate || d.updatedAt);
      return closedAt >= startDate && closedAt <= endDate;
    });

    // Revenue generated
    const revenueGenerated = dealsClosedWon.reduce((sum, d) => sum + d.value, 0);

    // Win rate
    const allClosedDeals = dealsResult.data.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost');
    const winRate = allClosedDeals.length > 0 
      ? (dealsClosedWon.length / allClosedDeals.length) * 100
      : 0;

    // Activities
    const activitiesResult = await getActivities(
      organizationId,
      workspaceId,
      { createdBy: userId },
      { pageSize: 1000 }
    );
    const activitiesInPeriod = activitiesResult.data.filter(a => {
      let occurredAt: Date;
      if (a.occurredAt?.toDate) {
        occurredAt = a.occurredAt.toDate();
      } else if (a.occurredAt instanceof Date) {
        occurredAt = a.occurredAt;
      } else if (typeof a.occurredAt === 'string' || typeof a.occurredAt === 'number') {
        occurredAt = new Date(a.occurredAt);
      } else {
        // Fallback: use current date if occurredAt is invalid
        occurredAt = new Date();
      }
      return occurredAt >= startDate && occurredAt <= endDate;
    });

    // Tasks completed
    const tasksResult = await FirestoreService.getAll<TeamTask>(
      `organizations/${organizationId}/workspaces/${workspaceId}/tasks`
    );
    const tasksCompleted = tasksResult.filter(t => 
      t.assignedTo === userId && 
      t.status === 'completed' &&
      t.completedAt &&
      new Date(t.completedAt) >= startDate &&
      new Date(t.completedAt) <= endDate
    ).length;

    return {
      leadsCreated: leadsInPeriod.length,
      dealsClosed: dealsClosedWon.length,
      revenueGenerated,
      activitiesLogged: activitiesInPeriod.length,
      tasksCompleted,
      winRate,
    };

  } catch (error: any) {
    logger.error('Failed to calculate user metrics', error, { userId });
    return {
      leadsCreated: 0,
      dealsClosed: 0,
      revenueGenerated: 0,
      activitiesLogged: 0,
      tasksCompleted: 0,
      winRate: 0,
    };
  }
}

/**
 * Get tasks for a user
 */
export async function getUserTasks(
  organizationId: string,
  workspaceId: string,
  userId: string,
  status?: TeamTask['status']
): Promise<TeamTask[]> {
  try {
    const result = await FirestoreService.getAll<TeamTask>(
      `organizations/${organizationId}/workspaces/${workspaceId}/tasks`
    );

    let tasks = result.filter(t => t.assignedTo === userId);

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    // Sort by priority and due date
    tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {return aPriority - bPriority;}

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      return 0;
    });

    return tasks;

  } catch (error: any) {
    logger.error('Failed to get user tasks', error, { userId });
    return [];
  }
}

/**
 * Complete a task
 */
export async function completeTask(
  organizationId: string,
  workspaceId: string,
  taskId: string
): Promise<void> {
  try {
    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/tasks`,
      taskId,
      {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      }
    );

    logger.info('Task completed', { taskId });

  } catch (error: any) {
    logger.error('Failed to complete task', error, { taskId });
    throw error;
  }
}

