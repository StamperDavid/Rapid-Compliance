import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ecommerce/orders - List orders with pagination
 * Query params:
 * - customerEmail: optional filter
 * - status: optional filter
 * - limit: page size (default 50, max 100)
 * - cursor: pagination cursor (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/orders');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('customerEmail');
    const status = searchParams.get('status');
    const pageSize = parseInt(searchParams.get('limit') ?? '50');

    // Filter by authenticated user's orders only (non-admin users)
    const isAdmin = authResult.user.role === 'owner' || authResult.user.role === 'admin';

    logger.info('Fetching orders', {
      route: '/api/ecommerce/orders',
      pageSize,
      filters: JSON.stringify({ customerEmail, status }),
    });

    // Build native admin query - canonical orders path
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const { COLLECTIONS: COLS } = await import('@/lib/firebase/collections');
    const ordersPath = `${COLS.ORGANIZATIONS}/${PLATFORM_ID}/orders`;
    const cappedPageSize = Math.min(pageSize, 100);

    let query: FirebaseFirestore.Query = AdminFirestoreService.collection(ordersPath)
      .orderBy('createdAt', 'desc');

    if (!isAdmin) {
      query = query.where('userId', '==', authResult.user.uid);
    }
    if (customerEmail) {
      query = query.where('customerEmail', '==', customerEmail);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    // Fetch pageSize + 1 to determine if there are more pages
    const snapshot = await query.limit(cappedPageSize + 1).get();
    const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const hasMore = allDocs.length > cappedPageSize;
    const orders = hasMore ? allDocs.slice(0, cappedPageSize) : allDocs;

    logger.info('Orders fetched successfully', {
      route: '/api/ecommerce/orders',
      count: orders.length,
      hasMore,
    });

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        hasMore,
        pageSize: orders.length,
      },
    });
  } catch (error: unknown) {
    logger.error('Error listing orders', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/ecommerce/orders',
    });
    return errors.database('Failed to list orders', error instanceof Error ? error : new Error(String(error)));
  }
}
