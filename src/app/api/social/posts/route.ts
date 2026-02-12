/**
 * API Route: Social Posts Management
 *
 * GET    /api/social/posts - List social posts
 * POST   /api/social/posts - Create social post
 * PUT    /api/social/posts - Update social post
 * DELETE /api/social/posts - Delete social post
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { orderBy, where, type QueryConstraint } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

interface SocialPostDoc {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledFor?: string;
  publishedAt?: string;
  hashtags?: string[];
  mediaUrls?: string[];
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const postsPath = `${getSubCollection('workspaces')}/default/test_socialPosts`;

const createPostSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram']),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['draft', 'scheduled', 'published']).optional().default('draft'),
  scheduledFor: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
});

const updatePostSchema = z.object({
  postId: z.string().min(1),
  content: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  scheduledFor: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const platformFilter = searchParams.get('platform');

    const constraints: QueryConstraint[] = [];

    if (statusFilter) {
      constraints.push(where('status', '==', statusFilter));
    }
    if (platformFilter) {
      constraints.push(where('platform', '==', platformFilter));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const posts = await FirestoreService.getAll<SocialPostDoc>(postsPath, constraints);

    return NextResponse.json({ success: true, posts });
  } catch (error: unknown) {
    logger.error('Failed to list social posts', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = createPostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const now = new Date();
    const postId = `social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const post: SocialPostDoc = {
      id: postId,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.user.uid,
    };

    await FirestoreService.set(postsPath, postId, post, false);

    logger.info('Social post created', { postId, platform: validation.data.platform });

    return NextResponse.json({ success: true, post });
  } catch (error: unknown) {
    logger.error('Failed to create social post', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = updatePostSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { postId, ...updates } = validation.data;

    await FirestoreService.update(postsPath, postId, {
      ...updates,
      updatedAt: new Date(),
    });

    logger.info('Social post updated', { postId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to update social post', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 });
    }

    await FirestoreService.delete(postsPath, postId);

    logger.info('Social post deleted', { postId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete social post', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
