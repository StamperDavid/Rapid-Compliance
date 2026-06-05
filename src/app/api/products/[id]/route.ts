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

const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['product', 'service', 'digital', 'subscription']).optional(),
  sku: z.string().optional(),
  price: z.number().optional(),
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
 * GET /api/products/[id] - Get a single product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const product = await AdminFirestoreService.get<ProductRecord>(productsPath, id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product';
    logger.error('Failed to fetch product', error instanceof Error ? error : new Error(String(error)), { file: 'api/products/[id]/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/products/[id] - Update a single product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateProductSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const existing = await AdminFirestoreService.get<ProductRecord>(productsPath, id);

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await AdminFirestoreService.update(productsPath, id, {
      ...bodyResult.data,
      updatedAt: new Date().toISOString(),
    });

    const product = await AdminFirestoreService.get<ProductRecord>(productsPath, id);

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    logger.error('Failed to update product', error instanceof Error ? error : new Error(String(error)), { file: 'api/products/[id]/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/products/[id] - Delete a single product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await AdminFirestoreService.delete(productsPath, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    logger.error('Failed to delete product', error instanceof Error ? error : new Error(String(error)), { file: 'api/products/[id]/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
