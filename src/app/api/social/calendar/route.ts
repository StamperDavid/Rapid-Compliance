/**
 * API Route: Social Calendar
 *
 * GET /api/social/calendar → Aggregates posts from all sources into calendar event format
 *   Query params: start (ISO date), end (ISO date), platform, status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

interface PostDoc {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt?: string | { seconds: number };
  publishedAt?: string | { seconds: number };
  scheduledFor?: string;
  createdAt: string | { seconds: number };
  mediaUrls?: string[];
  accountId?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: string;
  status: string;
  content: string;
  postId: string;
  source: string;
  mediaUrls?: string[];
  accountId?: string;
}

function toISOString(value: string | { seconds: number } | undefined | null): string | null {
  if (!value) {return null;}
  if (typeof value === 'string') {return value;}
  if ('seconds' in value) {return new Date(value.seconds * 1000).toISOString();}
  return null;
}

function postToEvent(post: PostDoc, source: string): CalendarEvent | null {
  // Determine the date to place this event on
  const dateStr =
    toISOString(post.scheduledAt) ??
    post.scheduledFor ??
    toISOString(post.publishedAt) ??
    toISOString(post.createdAt);

  if (!dateStr) {return null;}

  const start = new Date(dateStr);
  // Events are 30 minutes long by default
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    id: post.id,
    title: post.content.substring(0, 40) + (post.content.length > 40 ? '...' : ''),
    start: start.toISOString(),
    end: end.toISOString(),
    platform: post.platform,
    status: post.status,
    content: post.content,
    postId: post.id,
    source,
    mediaUrls: post.mediaUrls,
    accountId: post.accountId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/calendar');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    // Fetch from all 3 sources in parallel
    const [agentPosts, queuedPosts, campaignPosts] = await Promise.all([
      // Source 1: Autonomous agent posts (scheduled + published)
      FirestoreService.getAll<PostDoc>(
        getSubCollection('social_posts')
      ),
      // Source 2: Queued posts
      FirestoreService.getAll<PostDoc>(
        getSubCollection('social_queue')
      ),
      // Source 3: Campaign posts (the campaigns page store)
      FirestoreService.getAll<PostDoc>(
        `${getSubCollection('workspaces')}/default/test_socialPosts`
      ),
    ]);

    // Deduplicate by ID and convert to calendar events
    const seenIds = new Set<string>();
    const events: CalendarEvent[] = [];

    const addEvents = (posts: PostDoc[], source: string) => {
      for (const post of posts) {
        if (seenIds.has(post.id)) {continue;}
        seenIds.add(post.id);
        const event = postToEvent(post, source);
        if (event) {events.push(event);}
      }
    };

    addEvents(agentPosts, 'agent');
    addEvents(queuedPosts, 'queue');
    addEvents(campaignPosts, 'campaigns');

    // Sort by start date
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({ success: true, events, total: events.length });
  } catch (error: unknown) {
    logger.error('Calendar API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
