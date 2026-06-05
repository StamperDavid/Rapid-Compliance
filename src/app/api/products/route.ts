import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const productsPath = getSubCollection('products');

interface ProductRecord {
  id: string;
  [key: string]: unknown;
}

const variantSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  price: z.number(),
  stockQuantity: z.number().optional(),
  options: z.record(z.string()),
});

const createProductSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['product', 'service', 'digital', 'subscription']).optional(),
  sku: z.string().optional(),
  price: z.number(),
  compareAtPrice: z.number().optional(),
  cost: z.number().optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().optional(),
  trackInventory: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  downloadUrl: z.string().optional(),
  variants: z.array(variantSchema).optional(),
  customFields: z.record(z.unknown()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

/**
 * GET /api/products - List products. Supports ?type= filter (product/service/digital/subscription)
 * and ?category= filter.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const products = await AdminFirestoreService.getAll<ProductRecord>(productsPath, []);

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const categoryFilter = searchParams.get('category');

    let filtered = products;
    if (typeFilter) {
      filtered = filtered.filter((p) => (p.type ?? 'product') === typeFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    return NextResponse.json({ success: true, products: filtered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    logger.error('Failed to fetch products', error instanceof Error ? error : new Error(String(error)), { file: 'api/products/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/products - Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = createProductSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const data = bodyResult.data;
    const productId = data.id ?? `product-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const itemType = data.type ?? 'product';
    const now = new Date().toISOString();

    const product = {
      ...data,
      id: productId,
      type: itemType,
      currency: data.currency && data.currency !== '' ? data.currency : 'USD',
      inStock: data.inStock ?? true,
      trackInventory: data.trackInventory ?? false,
      isDigital: itemType === 'digital' ? true : (data.isDigital ?? false),
      tags: data.tags ?? [],
      images: data.images ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(productsPath, productId, product);

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create product';
    logger.error('Failed to create product', error instanceof Error ? error : new Error(String(error)), { file: 'api/products/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
