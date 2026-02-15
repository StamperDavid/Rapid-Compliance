/**
 * Product Service
 * Business logic layer for product/catalog management
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  currency?: string;
  category?: string;
  tags?: string[];
  images?: string[];
  inStock: boolean;
  stockQuantity?: number;
  trackInventory?: boolean;
  isDigital?: boolean;
  downloadUrl?: string;
  variants?: ProductVariant[];
  customFields?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stockQuantity?: number;
  options: Record<string, string>; // e.g., { size: 'M', color: 'Blue' }
}

export interface ProductFilters {
  category?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Get products with pagination and filtering
 */
export async function getProducts(
  filters?: ProductFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Product>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.category) {
      constraints.push(where('category', '==', filters.category));
    }

    if (filters?.inStock !== undefined) {
      constraints.push(where('inStock', '==', filters.inStock));
    }

    // Default ordering
    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Product>(
      getSubCollection('products'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    // Client-side price filtering (Firestore can't do range queries on multiple fields)
    let filtered = result.data;
    if (filters?.minPrice !== undefined) {
      filtered = filtered.filter(p => filters.minPrice !== undefined && p.price >= filters.minPrice);
    }
    if (filters?.maxPrice !== undefined) {
      filtered = filtered.filter(p => filters.maxPrice !== undefined && p.price <= filters.maxPrice);
    }

    logger.info('Products retrieved', {
      count: filtered.length,
      category: filters?.category,
      inStock: filters?.inStock,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
    });

    return {
      ...result,
      data: filtered,
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get products', error instanceof Error ? error : new Error(String(error)), {
      category: filters?.category,
      inStock: filters?.inStock,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
    });
    throw new Error(`Failed to retrieve products: ${err.message}`);
  }
}

/**
 * Get a single product
 */
export async function getProduct(
  productId: string
): Promise<Product | null> {
  try {
    const product = await FirestoreService.get<Product>(
      getSubCollection('products'),
      productId
    );

    if (!product) {
      logger.warn('Product not found', { productId });
      return null;
    }

    logger.info('Product retrieved', { productId });
    return product;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to get product', error instanceof Error ? error : new Error(String(error)), { productId });
    throw new Error(`Failed to retrieve product: ${err.message}`);
  }
}

/**
 * Create a new product
 */
export async function createProduct(
  data: Omit<Product, 'id' | 'createdAt'>
): Promise<Product> {
  try {
    const productId = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const product: Product = {
      ...data,
      id: productId,
      currency:(data.currency !== '' && data.currency != null) ? data.currency : 'USD',
      inStock: data.inStock ?? true,
      trackInventory: data.trackInventory ?? false,
      isDigital: data.isDigital ?? false,
      tags: data.tags ?? [],
      images: data.images ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('products'),
      productId,
      product,
      false
    );

    logger.info('Product created', {
      productId,
      name: product.name,
      price: product.price,
    });

    return product;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to create product', error instanceof Error ? error : new Error(String(error)), {
      productName: data.name,
      price: data.price,
    });
    throw new Error(`Failed to create product: ${err.message}`);
  }
}

/**
 * Update product
 */
export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>
): Promise<Product> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      getSubCollection('products'),
      productId,
      updatedData
    );

    logger.info('Product updated', {
      productId,
      updatedFields: Object.keys(updates),
    });

    const product = await getProduct(productId);
    if (!product) {
      throw new Error('Product not found after update');
    }

    return product;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to update product', error instanceof Error ? error : new Error(String(error)), { productId });
    throw new Error(`Failed to update product: ${err.message}`);
  }
}

/**
 * Delete product
 */
export async function deleteProduct(
  productId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      getSubCollection('products'),
      productId
    );

    logger.info('Product deleted', { productId });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to delete product', error instanceof Error ? error : new Error(String(error)), { productId });
    throw new Error(`Failed to delete product: ${err.message}`);
  }
}

/**
 * Update product inventory
 */
export async function updateInventory(
  productId: string,
  quantityChange: number
): Promise<Product> {
  try {
    const product = await getProduct(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.trackInventory) {
      logger.warn('Inventory update skipped - tracking disabled', { productId });
      return product;
    }

    const currentQuantity = product.stockQuantity ?? 0;
    const newQuantity = currentQuantity + quantityChange;

    const updated = await updateProduct(productId, {
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    });

    logger.info('Inventory updated', {
      productId,
      previousQuantity: currentQuantity,
      newQuantity,
      change: quantityChange,
    });

    return updated;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Failed to update inventory', error instanceof Error ? error : new Error(String(error)), { productId, quantityChange });
    throw new Error(`Failed to update inventory: ${err.message}`);
  }
}

/**
 * Get products by category
 */
export async function getProductsByCategory(
  category: string,
  options?: PaginationOptions
): Promise<PaginatedResult<Product>> {
  return getProducts({ category }, options);
}

/**
 * Search products
 */
export async function searchProducts(
  searchTerm: string,
  options?: PaginationOptions
): Promise<PaginatedResult<Product>> {
  try {
    const result = await getProducts(undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(product =>
      (product.name?.toLowerCase().includes(searchLower) ?? false) ||
      (product.description?.toLowerCase().includes(searchLower) ?? false) ||
      (product.sku?.toLowerCase().includes(searchLower) ?? false) ||
      (product.category?.toLowerCase().includes(searchLower) ?? false)
    );

    logger.info('Products searched', {
      searchTerm,
      resultsCount: filtered.length,
    });

    return {
      data: filtered,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Product search failed', error instanceof Error ? error : new Error(String(error)), { searchTerm });
    throw new Error(`Search failed: ${err.message}`);
  }
}

/**
 * Bulk update product status
 */
export async function bulkUpdateProducts(
  productIds: string[],
  updates: Partial<Product>
): Promise<number> {
  try {
    let successCount = 0;

    for (const productId of productIds) {
      try {
        await updateProduct(productId, updates);
        successCount++;
      } catch (error) {
        logger.warn('Failed to update product in bulk operation', {
          productId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Bulk product update completed', {
      total: productIds.length,
      successful: successCount,
      failed: productIds.length - successCount,
    });

    return successCount;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Bulk product update failed', error instanceof Error ? error : new Error(String(error)), { productIds });
    throw new Error(`Bulk update failed: ${err.message}`);
  }
}




