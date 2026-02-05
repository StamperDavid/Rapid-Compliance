/**
 * Blog Post Preview API
 * Generate shareable preview links for blog posts
 * CRITICAL: Organization isolation - validates organizationId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { randomBytes } from 'crypto';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

const paramsSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

const postBodySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  expiresIn: z.number().int().positive().optional().default(24),
});

const getQuerySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  token: z.string().min(1, 'Preview token is required'),
});

interface BlogPostData {
  organizationId: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}

interface PreviewTokenData {
  postId: string;
  type: string;
  organizationId: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

/**
 * POST /api/website/blog/posts/[postId]/preview
 * Generate a preview token for a blog post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid postId parameter' }, { status: 400 });
    }
    const { postId } = paramsResult.data;

    const rawBody: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { organizationId, expiresIn } = bodyResult.data;

    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data() as BlogPostData | undefined;

    // CRITICAL: Verify organizationId matches
    if (postData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Generate preview token
    const previewToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresIn);

    // Store preview token
    const performedBy = await getUserIdentifier();

    const tokenRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/preview-tokens/tokens/{token}',
      { orgId: organizationId, token: previewToken }
    );

    await tokenRef.set({
      postId,
      type: 'blog-post',
      organizationId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy: performedBy,
    });

    // Generate preview URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const previewUrl = `${baseUrl}/preview/blog/${previewToken}`;

    return NextResponse.json({
      success: true,
      previewToken,
      previewUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate blog post preview', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts/[postId]/preview',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to generate preview', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/website/blog/posts/[postId]/preview
 * Get blog post preview data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid postId parameter' }, { status: 400 });
    }
    const { postId } = paramsResult.data;

    const { searchParams } = request.nextUrl;
    const queryResult = getQuerySchema.safeParse({
      organizationId: searchParams.get('organizationId') ?? undefined,
      token: searchParams.get('token') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: queryResult.error.errors[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { organizationId, token } = queryResult.data;

    // Verify preview token
    const tokenRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/preview-tokens/tokens/{token}',
      { orgId: organizationId, token }
    );

    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid preview token' },
        { status: 403 }
      );
    }

    const tokenData = tokenDoc.data() as PreviewTokenData | undefined;

    // Check if token matches the post
    if (tokenData?.postId !== postId) {
      return NextResponse.json(
        { error: 'Preview token does not match post' },
        { status: 403 }
      );
    }

    // Check if token is expired
    if (tokenData.expiresAt) {
      const expiresAt = new Date(tokenData.expiresAt);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Preview token has expired' },
          { status: 403 }
        );
      }
    }

    // Get the post data
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data() as BlogPostData | undefined;

    // CRITICAL: Verify organizationId matches
    if (postData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      post: {
        id: doc.id,
        ...postData,
      },
      isPreview: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch blog post preview', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts/[postId]/preview',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch preview', details: errorMessage },
      { status: 500 }
    );
  }
}
