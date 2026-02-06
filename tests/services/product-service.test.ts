/**
 * Product Service Tests
 * Integration tests for product service layer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateInventory,
  searchProducts,
  type Product,
} from '@/lib/ecommerce/product-service';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('ProductService', () => {
  const testWorkspaceId = 'default';
  let testProductId: string;

  afterEach(async () => {
    if (testProductId) {
      try {
        await deleteProduct(testProductId, testWorkspaceId);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const product = await createProduct({
        name: 'Test Product',
        description: 'A test product',
        sku: 'TEST-001',
        price: 99.99,
        inStock: true,
        category: 'Electronics',
      }, testWorkspaceId);
      testProductId = product.id;

      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.price).toBe(99.99);
      expect(product.currency).toBe('USD');
      expect(product.inStock).toBe(true);
    });

    it('should create digital product', async () => {
      const product = await createProduct({
        name: 'E-book',
        price: 19.99,
        inStock: true,
        isDigital: true,
        downloadUrl: 'https://example.com/ebook.pdf',
      }, testWorkspaceId);
      testProductId = product.id;

      expect(product.isDigital).toBe(true);
      expect(product.downloadUrl).toBeDefined();
    });
  });

  describe('updateInventory', () => {
    it('should decrease inventory when product is purchased', async () => {
      const product = await createProduct({
        name: 'Inventory Product',
        price: 50.00,
        inStock: true,
        trackInventory: true,
        stockQuantity: 100,
      }, testWorkspaceId);
      testProductId = product.id;

      // Decrease inventory by 5
      const updated = await updateInventory(product.id, -5, testWorkspaceId);

      expect(updated.stockQuantity).toBe(95);
      expect(updated.inStock).toBe(true);
    });

    it('should mark product out of stock when inventory reaches 0', async () => {
      const product = await createProduct({
        name: 'Last Item',
        price: 25.00,
        inStock: true,
        trackInventory: true,
        stockQuantity: 1,
      }, testWorkspaceId);
      testProductId = product.id;

      // Sell the last item
      const updated = await updateInventory(product.id, -1, testWorkspaceId);

      expect(updated.stockQuantity).toBe(0);
      expect(updated.inStock).toBe(false);
    });

    it('should not update inventory for non-tracked products', async () => {
      const product = await createProduct({
        name: 'Unlimited Product',
        price: 10.00,
        inStock: true,
        trackInventory: false,
      }, testWorkspaceId);
      testProductId = product.id;

      const updated = await updateInventory(product.id, -5, testWorkspaceId);

      // Should not change since tracking is disabled
      expect(updated.stockQuantity).toBeUndefined();
    });
  });

  describe('searchProducts', () => {
    it('should search products by name', async () => {
      const product = await createProduct({
        name: 'Searchable Widget',
        price: 29.99,
        inStock: true,
      }, testWorkspaceId);
      testProductId = product.id;

      const result = await searchProducts('Searchable', testWorkspaceId);

      expect(result.data.some(p => p.id === testProductId)).toBe(true);
    });
  });

  describe('getProducts with filters', () => {
    it('should filter products by price range', async () => {
      const cheap = await createProduct({
        name: 'Cheap Product',
        price: 10.00,
        inStock: true,
      }, testWorkspaceId);

      const expensive = await createProduct({
        name: 'Expensive Product',
        price: 500.00,
        inStock: true,
      }, testWorkspaceId);

      const result = await getProducts(testWorkspaceId, {
        minPrice: 100,
      });

      expect(result.data.some(p => p.id === expensive.id)).toBe(true);
      expect(result.data.every(p => p.price >= 100)).toBe(true);

      await deleteProduct(cheap.id, testWorkspaceId);
      await deleteProduct(expensive.id, testWorkspaceId);
    });
  });
});
