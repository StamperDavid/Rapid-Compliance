/**
 * Product Service
 * Business logic layer for product/catalog management
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface Product {
  id: string;
  organizationId: string;
  workspaceId: string;
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
  customFields?: Record<string, any>;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: any;
  updatedAt?: any;
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
  organizationId: string,
  workspaceId: string = 'default',
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
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/products/records`,
      constraints,
      options?.pageSize || 50,
      options?.lastDoc
    );

    // Client-side price filtering (Firestore can't do range queries on multiple fields)
    let filtered = result.data;
    if (filters?.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price >= filters.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice!);
    }

    logger.info('Products retrieved', {
      organizationId,
      count: filtered.length,
      filters,
    });

    return {
      ...result,
      data: filtered,
    };
  } catch (error: any) {
    logger.error('Failed to get products', error, { organizationId, filters });
    throw new Error(`Failed to retrieve products: ${error.message}`);
  }
}

/**
 * Get a single product
 */
export async function getProduct(
  organizationId: string,
  productId: string,
  workspaceId: string = 'default'
): Promise<Product | null> {
  try {
    const product = await FirestoreService.get<Product>(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/products/records`,
      productId
    );

    if (!product) {
      logger.warn('Product not found', { organizationId, productId });
      return null;
    }

    logger.info('Product retrieved', { organizationId, productId });
    return product;
  } catch (error: any) {
    logger.error('Failed to get product', error, { organizationId, productId });
    throw new Error(`Failed to retrieve product: ${error.message}`);
  }
}

/**
 * Create a new product
 */
export async function createProduct(
  organizationId: string,
  data: Omit<Product, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>,
  workspaceId: string = 'default'
): Promise<Product> {
  try {
    const productId = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const product: Product = {
      ...data,
      id: productId,
      organizationId,
      workspaceId,
      currency: data.currency || 'USD',
      inStock: data.inStock !== undefined ? data.inStock : true,
      trackInventory: data.trackInventory || false,
      isDigital: data.isDigital || false,
      tags: data.tags || [],
      images: data.images || [],
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/products/records`,
      productId,
      product,
      false
    );

    logger.info('Product created', {
      organizationId,
      productId,
      name: product.name,
      price: product.price,
    });

    return product;
  } catch (error: any) {
    logger.error('Failed to create product', error, { organizationId, data });
    throw new Error(`Failed to create product: ${error.message}`);
  }
}

/**
 * Update product
 */
export async function updateProduct(
  organizationId: string,
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string = 'default'
): Promise<Product> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/products/records`,
      productId,
      updatedData
    );

    logger.info('Product updated', {
      organizationId,
      productId,
      updatedFields: Object.keys(updates),
    });

    const product = await getProduct(organizationId, productId, workspaceId);
    if (!product) {
      throw new Error('Product not found after update');
    }

    return product;
  } catch (error: any) {
    logger.error('Failed to update product', error, { organizationId, productId });
    throw new Error(`Failed to update product: ${error.message}`);
  }
}

/**
 * Delete product
 */
export async function deleteProduct(
  organizationId: string,
  productId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/entities/products/records`,
      productId
    );

    logger.info('Product deleted', { organizationId, productId });
  } catch (error: any) {
    logger.error('Failed to delete product', error, { organizationId, productId });
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}

/**
 * Update product inventory
 */
export async function updateInventory(
  organizationId: string,
  productId: string,
  quantityChange: number,
  workspaceId: string = 'default'
): Promise<Product> {
  try {
    const product = await getProduct(organizationId, productId, workspaceId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.trackInventory) {
      logger.warn('Inventory update skipped - tracking disabled', { productId });
      return product;
    }

    const currentQuantity = product.stockQuantity || 0;
    const newQuantity = currentQuantity + quantityChange;

    const updated = await updateProduct(organizationId, productId, {
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    }, workspaceId);

    logger.info('Inventory updated', {
      organizationId,
      productId,
      previousQuantity: currentQuantity,
      newQuantity,
      change: quantityChange,
    });

    return updated;
  } catch (error: any) {
    logger.error('Failed to update inventory', error, { organizationId, productId, quantityChange });
    throw new Error(`Failed to update inventory: ${error.message}`);
  }
}

/**
 * Get products by category
 */
export async function getProductsByCategory(
  organizationId: string,
  category: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<Product>> {
  return getProducts(organizationId, workspaceId, { category }, options);
}

/**
 * Search products
 */
export async function searchProducts(
  organizationId: string,
  searchTerm: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<Product>> {
  try {
    const result = await getProducts(organizationId, workspaceId, undefined, options);

    const searchLower = searchTerm.toLowerCase();
    const filtered = result.data.filter(product =>
      product.name?.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower)
    );

    logger.info('Products searched', {
      organizationId,
      searchTerm,
      resultsCount: filtered.length,
    });

    return {
      data: filtered,
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  } catch (error: any) {
    logger.error('Product search failed', error, { organizationId, searchTerm });
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Bulk update product status
 */
export async function bulkUpdateProducts(
  organizationId: string,
  productIds: string[],
  updates: Partial<Product>,
  workspaceId: string = 'default'
): Promise<number> {
  try {
    let successCount = 0;

    for (const productId of productIds) {
      try {
        await updateProduct(organizationId, productId, updates, workspaceId);
        successCount++;
      } catch (error) {
        logger.warn('Failed to update product in bulk operation', { productId, error });
      }
    }

    logger.info('Bulk product update completed', {
      organizationId,
      total: productIds.length,
      successful: successCount,
      failed: productIds.length - successCount,
    });

    return successCount;
  } catch (error: any) {
    logger.error('Bulk product update failed', error, { organizationId, productIds });
    throw new Error(`Bulk update failed: ${error.message}`);
  }
}

