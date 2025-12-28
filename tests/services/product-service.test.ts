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
  const testOrgId = `test-org-${Date.now()}`;
  const testWorkspaceId = 'default';
  let testProductId: string;

  beforeEach(async () => {
    await FirestoreService.set('organizations', testOrgId, {
      id: testOrgId,
      name: 'Test Organization',
    }, false);
  });

  afterEach(async () => {
    if (testProductId) {
      try {
        await deleteProduct(testOrgId, testProductId, testWorkspaceId);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const product = await createProduct(testOrgId, {
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
      const product = await createProduct(testOrgId, {
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
      const product = await createProduct(testOrgId, {
        name: 'Inventory Product',
        price: 50.00,
        inStock: true,
        trackInventory: true,
        stockQuantity: 100,
      }, testWorkspaceId);
      testProductId = product.id;

      // Decrease inventory by 5
      const updated = await updateInventory(testOrgId, product.id, -5, testWorkspaceId);

      expect(updated.stockQuantity).toBe(95);
      expect(updated.inStock).toBe(true);
    });

    it('should mark product out of stock when inventory reaches 0', async () => {
      const product = await createProduct(testOrgId, {
        name: 'Last Item',
        price: 25.00,
        inStock: true,
        trackInventory: true,
        stockQuantity: 1,
      }, testWorkspaceId);
      testProductId = product.id;

      // Sell the last item
      const updated = await updateInventory(testOrgId, product.id, -1, testWorkspaceId);

      expect(updated.stockQuantity).toBe(0);
      expect(updated.inStock).toBe(false);
    });

    it('should not update inventory for non-tracked products', async () => {
      const product = await createProduct(testOrgId, {
        name: 'Unlimited Product',
        price: 10.00,
        inStock: true,
        trackInventory: false,
      }, testWorkspaceId);
      testProductId = product.id;

      const updated = await updateInventory(testOrgId, product.id, -5, testWorkspaceId);

      // Should not change since tracking is disabled
      expect(updated.stockQuantity).toBeUndefined();
    });
  });

  describe('searchProducts', () => {
    it('should search products by name', async () => {
      const product = await createProduct(testOrgId, {
        name: 'Searchable Widget',
        price: 29.99,
        inStock: true,
      }, testWorkspaceId);
      testProductId = product.id;

      const result = await searchProducts(testOrgId, 'Searchable', testWorkspaceId);

      expect(result.data.some(p => p.id === testProductId)).toBe(true);
    });
  });

  describe('getProducts with filters', () => {
    it('should filter products by price range', async () => {
      const cheap = await createProduct(testOrgId, {
        name: 'Cheap Product',
        price: 10.00,
        inStock: true,
      }, testWorkspaceId);

      const expensive = await createProduct(testOrgId, {
        name: 'Expensive Product',
        price: 500.00,
        inStock: true,
      }, testWorkspaceId);

      const result = await getProducts(testOrgId, testWorkspaceId, {
        minPrice: 100,
      });

      expect(result.data.some(p => p.id === expensive.id)).toBe(true);
      expect(result.data.every(p => p.price >= 100)).toBe(true);

      await deleteProduct(testOrgId, cheap.id, testWorkspaceId);
      await deleteProduct(testOrgId, expensive.id, testWorkspaceId);
    });
  });
});




