/**
 * Batch Video Generator Service
 *
 * Creates multiple video storyboards from a week's worth of topics.
 * Used by the Content Calendar feature to batch-produce video briefs
 * that can be reviewed, approved, and generated sequentially.
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  BatchProject,
  ContentCalendarWeek,
  VideoType,
  TargetPlatform,
} from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoResolution } from '@/types/video';

export interface BatchTopicInput {
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  topic: string;
  videoType?: VideoType;
  platform?: TargetPlatform;
}

export interface CreateCalendarWeekInput {
  name: string;
  weekStartDate: string; // ISO date for Monday
  theme: string;
  topics: BatchTopicInput[];
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;
  createdBy: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Create a content calendar week with batch projects
 */
export async function createCalendarWeek(
  input: CreateCalendarWeekInput
): Promise<ContentCalendarWeek> {
  const weekId = `week-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const projects: BatchProject[] = input.topics.map((topic, index) => ({
    id: `batch-${weekId}-${index}`,
    name: `${DAY_NAMES[topic.dayOfWeek]} — ${topic.topic}`,
    topic: topic.topic,
    dayOfWeek: topic.dayOfWeek,
    projectId: null,
    status: 'pending',
    videoUrl: null,
  }));

  const week: ContentCalendarWeek = {
    id: weekId,
    name: input.name,
    weekStartDate: input.weekStartDate,
    theme: input.theme,
    projects,
    status: 'draft',
    createdAt: now,
    createdBy: input.createdBy,
  };

  const collection = getSubCollection('content_calendar');
  await AdminFirestoreService.set(
    collection,
    weekId,
    JSON.parse(JSON.stringify(week)) as Record<string, unknown>
  );

  logger.info('Content calendar week created', {
    weekId,
    topicCount: projects.length,
    theme: input.theme,
  });

  return week;
}

/**
 * Get a calendar week by ID
 */
export async function getCalendarWeek(weekId: string): Promise<ContentCalendarWeek | null> {
  const collection = getSubCollection('content_calendar');
  const doc = await AdminFirestoreService.get(collection, weekId);
  if (!doc) {
    return null;
  }
  return doc as unknown as ContentCalendarWeek;
}

/**
 * List all calendar weeks, ordered by creation date
 */
export async function listCalendarWeeks(): Promise<ContentCalendarWeek[]> {
  const collection = getSubCollection('content_calendar');
  const docs = await AdminFirestoreService.getAll(collection);
  const weeks = docs as unknown as ContentCalendarWeek[];
  return weeks.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

/**
 * Update a batch project within a calendar week
 */
export async function updateBatchProject(
  weekId: string,
  projectIndex: number,
  updates: Partial<BatchProject>
): Promise<ContentCalendarWeek> {
  const week = await getCalendarWeek(weekId);
  if (!week) {
    throw new Error(`Calendar week ${weekId} not found`);
  }

  if (projectIndex < 0 || projectIndex >= week.projects.length) {
    throw new Error(`Invalid project index ${projectIndex}`);
  }

  week.projects[projectIndex] = { ...week.projects[projectIndex], ...updates };

  // Update overall week status based on project statuses
  const allCompleted = week.projects.every((p) => p.status === 'completed');
  const anyGenerating = week.projects.some((p) => p.status === 'generating');
  const allStoryboarded = week.projects.every(
    (p) => p.status === 'storyboarded' || p.status === 'approved' || p.status === 'completed'
  );

  if (allCompleted) {
    week.status = 'completed';
  } else if (anyGenerating) {
    week.status = 'generating';
  } else if (allStoryboarded) {
    week.status = 'storyboarded';
  }

  const collection = getSubCollection('content_calendar');
  await AdminFirestoreService.set(
    collection,
    weekId,
    JSON.parse(JSON.stringify(week)) as Record<string, unknown>
  );

  return week;
}

/**
 * Delete a calendar week
 */
export async function deleteCalendarWeek(weekId: string): Promise<void> {
  const collection = getSubCollection('content_calendar');
  await AdminFirestoreService.delete(collection, weekId);

  logger.info('Content calendar week deleted', { weekId });
}

/**
 * Generate AI topic suggestions from a theme via OpenRouter.
 * Returns 7 topics (one per day, Mon-Sun).
 * Falls back to structured defaults if the AI call fails.
 */
export async function generateDefaultTopics(theme: string): Promise<BatchTopicInput[]> {
  try {
    const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
    const provider = new OpenRouterProvider({});
    const response = await provider.chat({
      model: 'anthropic/claude-sonnet-4.6' as import('@/types/ai-models').ModelName,
      messages: [
        {
          role: 'system',
          content: 'You are a social media content strategist. Generate exactly 7 short video topic titles for a week of content. Return ONLY a JSON array of 7 strings, one per day (Monday through Sunday). Each title should be 5-12 words, engaging, and directly related to the theme. No numbering, no extra text.',
        },
        {
          role: 'user',
          content: `Theme: "${theme}". Generate 7 daily video topics for this theme.`,
        },
      ],
      temperature: 0.8,
      maxTokens: 512,
    });

    const parsed: unknown = JSON.parse(response.content);
    if (Array.isArray(parsed) && parsed.length === 7 && parsed.every((t): t is string => typeof t === 'string')) {
      const dayMap = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun → dayOfWeek
      return parsed.map((topic, i) => ({
        dayOfWeek: dayMap[i],
        topic,
        videoType: 'social-ad' as VideoType,
        platform: 'tiktok' as TargetPlatform,
      }));
    }

    logger.warn('AI topic generation returned unexpected format, using fallback', { parsed: String(parsed) });
  } catch (err) {
    logger.warn('AI topic generation failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Structured fallback — always returns valid topics
  const dayTopics = [
    { day: 1, suffix: 'Introduction & Overview' },
    { day: 2, suffix: 'Key Benefits & Features' },
    { day: 3, suffix: 'Customer Success Story' },
    { day: 4, suffix: 'How-To Tutorial' },
    { day: 5, suffix: 'Behind the Scenes' },
    { day: 6, suffix: 'Tips & Best Practices' },
    { day: 0, suffix: 'Week Recap & Preview' },
  ];

  return dayTopics.map(({ day, suffix }) => ({
    dayOfWeek: day,
    topic: `${theme}: ${suffix}`,
    videoType: 'social-ad' as VideoType,
    platform: 'tiktok' as TargetPlatform,
  }));
}
