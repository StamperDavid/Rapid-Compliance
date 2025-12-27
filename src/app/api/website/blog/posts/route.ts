/**
 * Blog Posts API
 * Manage blog posts
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { BlogPost } from '@/types/website';

/**
 * GET /api/website/blog/posts
 * List blog posts for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get posts collection
    let query = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('blog-posts');

    // Apply filters
    if (status) {
      query = query.where('status', '==', status) as any;
    }

    const snapshot = await query.get();
    const posts: BlogPost[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // CRITICAL: Double-check organizationId matches
      if (data.organizationId === organizationId) {
        const post = {
          id: doc.id,
          ...data,
        } as BlogPost;

        // Filter by category if specified
        if (!category || post.categories.includes(category)) {
          posts.push(post);
        }
      }
    });

    // Sort by creation date (newest first)
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[Blog Posts API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/blog/posts
 * Create a new blog post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, post } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Validate post data
    if (!post || !post.title) {
      return NextResponse.json(
        { error: 'Invalid post data' },
        { status: 400 }
      );
    }

    // Create post document
    const postData: BlogPost = {
      ...post,
      id: post.id || `post_${Date.now()}`,
      organizationId, // CRITICAL: Set org ownership
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore
    const postRef = db
      .collection('organizations')
      .doc(organizationId) // CRITICAL: Scoped to org
      .collection('website')
      .doc('config')
      .collection('blog-posts')
      .doc(postData.id);

    await postRef.set(postData);

    return NextResponse.json({ post: postData }, { status: 201 });
  } catch (error) {
    console.error('[Blog Posts API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}

