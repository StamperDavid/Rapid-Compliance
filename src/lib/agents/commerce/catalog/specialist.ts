/**
 * Catalog Manager Specialist
 * STATUS: FUNCTIONAL
 *
 * Manages product catalog operations with dynamic fetching and industry-agnostic pricing.
 * Handles product lifecycle, variant management, and catalog synchronization.
 *
 * CAPABILITIES:
 * - Dynamic product fetching from organization database
 * - Catalog CRUD operations
 * - Variant and option management
 * - Price management without industry bias
 * - Category and collection organization
 * - Product search and filtering
 *
 * @module agents/commerce/catalog/specialist
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'CATALOG_MANAGER',
    name: 'Catalog Manager',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: [
      'fetch_products',
      'manage_catalog',
      'variant_management',
      'price_management',
      'category_organization',
      'product_search',
    ],
  },
  systemPrompt: `You are the Catalog Manager, responsible for product catalog operations.
Your capabilities include:
- Fetching products dynamically from the database
- Managing product lifecycle (create, update, archive)
- Handling variants and options
- Price management without industry-specific bias
- Category and collection organization

Always ensure data consistency and proper validation.`,
  tools: ['fetch_products', 'create_product', 'update_product', 'search_catalog'],
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      products: { type: 'array' },
      product: { type: 'object' },
      totalCount: { type: 'number' },
      error: { type: 'string' },
    },
  },
  maxTokens: 4096,
  temperature: 0.2,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProductVariant {
  id: string;
  sku?: string;
  name: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  inventory?: number;
  weight?: number;
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  costPrice?: number;
  status: 'active' | 'draft' | 'archived';
  type: 'physical' | 'digital' | 'service' | 'subscription';
  variants?: ProductVariant[];
  options?: Array<{ name: string; values: string[] }>;
  categories?: string[];
  collections?: string[];
  tags?: string[];
  images?: string[];
  inventory?: {
    tracked: boolean;
    quantity: number;
    lowStockThreshold?: number;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSummary {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  categories: string[];
  priceRange: { min: number; max: number };
  lastUpdated: string;
}

interface FetchProductsPayload {
  action: 'fetch_products';
  filters?: {
    status?: Product['status'];
    category?: string;
    collection?: string;
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
  };
  pagination?: {
    page: number;
    limit: number;
  };
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

interface GetProductPayload {
  action: 'get_product';
  productId: string;
}

interface CreateProductPayload {
  action: 'create_product';
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
}

interface UpdateProductPayload {
  action: 'update_product';
  productId: string;
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>;
}

interface ArchiveProductPayload {
  action: 'archive_product';
  productId: string;
}

interface SearchCatalogPayload {
  action: 'search_catalog';
  query: string;
  limit?: number;
}

interface GetCatalogSummaryPayload {
  action: 'get_catalog_summary';
}

interface SyncCatalogPayload {
  action: 'sync_catalog';
  source: 'stripe' | 'shopify' | 'woocommerce' | 'manual';
  products?: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;
}

type CatalogPayload =
  | FetchProductsPayload
  | GetProductPayload
  | CreateProductPayload
  | UpdateProductPayload
  | ArchiveProductPayload
  | SearchCatalogPayload
  | GetCatalogSummaryPayload
  | SyncCatalogPayload;

export interface CatalogResult {
  success: boolean;
  action: string;
  products?: Product[];
  product?: Product;
  totalCount?: number;
  page?: number;
  totalPages?: number;
  summary?: CatalogSummary;
  syncedCount?: number;
  error?: string;
}

// ============================================================================
// CATALOG MANAGER IMPLEMENTATION
// ============================================================================

export class CatalogManagerSpecialist extends BaseSpecialist {
  private isReady = false;

  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    try {
      this.log('INFO', 'Initializing Catalog Manager...');
      this.isReady = true;
      this.isInitialized = true;
      this.log('INFO', 'Catalog Manager initialized successfully');
      await Promise.resolve();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('ERROR', `Failed to initialize Catalog Manager: ${err.message}`);
      throw err;
    }
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const payload = message.payload as CatalogPayload;

      if (!payload || typeof payload !== 'object' || !('action' in payload)) {
        return this.createReport(taskId, 'FAILED', null, ['Invalid payload: action is required']);
      }

      let result: CatalogResult;

      switch (payload.action) {
        case 'fetch_products':
          result = await this.handleFetchProducts(payload);
          break;

        case 'get_product':
          result = await this.handleGetProduct(payload);
          break;

        case 'create_product':
          result = await this.handleCreateProduct(payload);
          break;

        case 'update_product':
          result = await this.handleUpdateProduct(payload);
          break;

        case 'archive_product':
          result = await this.handleArchiveProduct(payload);
          break;

        case 'search_catalog':
          result = await this.handleSearchCatalog(payload);
          break;

        case 'get_catalog_summary':
          result = await this.handleGetCatalogSummary(payload);
          break;

        case 'sync_catalog':
          result = await this.handleSyncCatalog(payload);
          break;

        default:
          return this.createReport(taskId, 'FAILED', null, [
            `Unknown action: ${(payload as { action: string }).action}`,
          ]);
      }

      if (result.success) {
        return this.createReport(taskId, 'COMPLETED', result);
      } else {
        return this.createReport(taskId, 'FAILED', result, [result.error ?? 'Unknown error']);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[Catalog Manager] Execution error:', err, { taskId, file: 'specialist.ts' });
      return this.createReport(taskId, 'FAILED', null, [err.message]);
    }
  }

  /**
   * Fetch products with filtering and pagination
   */
  private async handleFetchProducts(payload: FetchProductsPayload): Promise<CatalogResult> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const { where, orderBy: _orderBy, limit: _limit } = await import('firebase/firestore');

      const constraints = [];

      // Apply filters
      if (payload.filters?.status) {
        constraints.push(where('status', '==', payload.filters.status));
      }

      if (payload.filters?.category) {
        constraints.push(where('categories', 'array-contains', payload.filters.category));
      }

      // Get e-commerce config for product schema
      const ecommerceConfig = await FirestoreService.get(
        getSubCollection('ecommerce'),
        'config'
      );

      let products: Product[] = [];

      if (ecommerceConfig?.productSchema) {
        // Fetch from configured entity schema
        const productSchema = String(ecommerceConfig.productSchema);
        const records = await FirestoreService.getAll(
          getSubCollection(productSchema),
          constraints
        );

        // Map records to Product format using mappings
        const mappings: Record<string, string> = this.extractMappings(ecommerceConfig);
        products = records.map(record => this.mapRecordToProduct(record, mappings));
      } else {
        // Fallback to direct products collection
        const productsPath = getSubCollection('products');
        products = await FirestoreService.getAll(productsPath, constraints);
      }

      // Apply client-side filtering for complex queries
      if (payload.filters?.priceMin !== undefined) {
        products = products.filter(p => p.price >= (payload.filters?.priceMin ?? 0));
      }

      if (payload.filters?.priceMax !== undefined) {
        products = products.filter(p => p.price <= (payload.filters?.priceMax ?? Infinity));
      }

      if (payload.filters?.searchQuery) {
        const query = payload.filters.searchQuery.toLowerCase();
        products = products.filter(
          p =>
            p.name.toLowerCase().includes(query) ||
            (p.description?.toLowerCase().includes(query) ?? false) ||
            (p.sku?.toLowerCase().includes(query) ?? false)
        );
      }

      // Sort
      const sortBy = payload.sortBy ?? 'createdAt';
      const sortOrder = payload.sortOrder ?? 'desc';
      products.sort((a, b) => {
        const aVal = a[sortBy] ?? '';
        const bVal = b[sortBy] ?? '';
        if (sortOrder === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      });

      // Paginate
      const page = payload.pagination?.page ?? 1;
      const pageLimit = payload.pagination?.limit ?? 50;
      const totalCount = products.length;
      const totalPages = Math.ceil(totalCount / pageLimit);
      const startIndex = (page - 1) * pageLimit;
      const paginatedProducts = products.slice(startIndex, startIndex + pageLimit);

      this.log('INFO', `Fetched ${paginatedProducts.length} products (page ${page}/${totalPages})`);

      return {
        success: true,
        action: 'fetch_products',
        products: paginatedProducts,
        totalCount,
        page,
        totalPages,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: 'fetch_products',
        error: `Failed to fetch products: ${err.message}`,
      };
    }
  }

  /**
   * Get single product by ID
   */
  private async handleGetProduct(payload: GetProductPayload): Promise<CatalogResult> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      // Get e-commerce config
      const ecommerceConfig = await FirestoreService.get(
        getSubCollection('ecommerce'),
        'config'
      );

      let product: Product | null = null;

      if (ecommerceConfig?.productSchema) {
        const productSchema = String(ecommerceConfig.productSchema);
        const record = await FirestoreService.get(
          getSubCollection(productSchema),
          payload.productId
        );

        if (record) {
          const mappings: Record<string, string> = this.extractMappings(ecommerceConfig);
          product = this.mapRecordToProduct(record, mappings);
        }
      } else {
        product = await FirestoreService.get(
          getSubCollection('products'),
          payload.productId
        );
      }

      if (!product) {
        return {
          success: false,
          action: 'get_product',
          error: 'Product not found',
        };
      }

      return {
        success: true,
        action: 'get_product',
        product,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: 'get_product',
        error: `Failed to get product: ${err.message}`,
      };
    }
  }

  /**
   * Create a new product
   */
  private async handleCreateProduct(payload: CreateProductPayload): Promise<CatalogResult> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const now = new Date().toISOString();

      const product: Product = {
        id: productId,
        ...payload.product,
        currency: payload.product.currency ?? 'USD',
        status: payload.product.status ?? 'draft',
        type: payload.product.type ?? 'physical',
        createdAt: now,
        updatedAt: now,
      };

      await FirestoreService.set(
        getSubCollection('products'),
        productId,
        product,
        false
      );

      this.log('INFO', `Created product: ${productId} - ${product.name}`);

      return {
        success: true,
        action: 'create_product',
        product,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: 'create_product',
        error: `Failed to create product: ${err.message}`,
      };
    }
  }

  /**
   * Update an existing product
   */
  private async handleUpdateProduct(payload: UpdateProductPayload): Promise<CatalogResult> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const existingProduct = await FirestoreService.get(
        getSubCollection('products'),
        payload.productId
      );

      if (!existingProduct) {
        return {
          success: false,
          action: 'update_product',
          error: 'Product not found',
        };
      }

      const updates = {
        ...payload.updates,
        updatedAt: new Date().toISOString(),
      };

      await FirestoreService.set(
        getSubCollection('products'),
        payload.productId,
        updates,
        true
      );

      const updatedProduct: Product = {
        ...(existingProduct as Product),
        ...updates,
      };

      this.log('INFO', `Updated product: ${payload.productId}`);

      return {
        success: true,
        action: 'update_product',
        product: updatedProduct,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: 'update_product',
        error: `Failed to update product: ${err.message}`,
      };
    }
  }

  /**
   * Archive a product
   */
  private async handleArchiveProduct(payload: ArchiveProductPayload): Promise<CatalogResult> {
    return this.handleUpdateProduct({
      ...payload,
      action: 'update_product',
      updates: { status: 'archived' },
    });
  }

  /**
   * Search catalog with full-text search
   */
  private async handleSearchCatalog(payload: SearchCatalogPayload): Promise<CatalogResult> {
    return this.handleFetchProducts({
      action: 'fetch_products',
      filters: {
        searchQuery: payload.query,
        status: 'active',
      },
      pagination: {
        page: 1,
        limit: payload.limit ?? 20,
      },
    });
  }

  /**
   * Get catalog summary statistics
   */
  private async handleGetCatalogSummary(_payload: GetCatalogSummaryPayload): Promise<CatalogResult> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const rawProducts = await FirestoreService.getAll(
        getSubCollection('products'),
        []
      );
      const products = rawProducts as Product[];

      const activeProducts = products.filter(p => p.status === 'active');
      const draftProducts = products.filter(p => p.status === 'draft');
      const archivedProducts = products.filter(p => p.status === 'archived');

      const prices: number[] = activeProducts.map(p => Number(p.price)).filter(p => !isNaN(p) && p > 0);
      const allCategories: string[] = products.flatMap(p => this.extractCategories(p));
      const categories: string[] = [...new Set(allCategories)];

      const summary: CatalogSummary = {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        draftProducts: draftProducts.length,
        archivedProducts: archivedProducts.length,
        categories,
        priceRange: {
          min: prices.length > 0 ? Math.min(...prices) : 0,
          max: prices.length > 0 ? Math.max(...prices) : 0,
        },
        lastUpdated: products.length > 0
          ? products.reduce((latest, p) => {
              const updated = String(p.updatedAt);
              return updated > latest ? updated : latest;
            }, String(products[0].updatedAt))
          : new Date().toISOString(),
      };

      return {
        success: true,
        action: 'get_catalog_summary',
        summary,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: 'get_catalog_summary',
        error: `Failed to get catalog summary: ${err.message}`,
      };
    }
  }

  /**
   * Sync catalog from external source
   */
  private async handleSyncCatalog(payload: SyncCatalogPayload): Promise<CatalogResult> {
    this.log('INFO', `Catalog sync started from source: ${payload.source}`);

    try {
      switch (payload.source) {
        case 'stripe':
          return await this.syncFromStripe();
        case 'shopify':
          return await this.syncFromShopify();
        case 'woocommerce':
          return await this.syncFromWooCommerce();
        case 'manual':
          return await this.syncManual(payload.products ?? []);
        default:
          return {
            success: false,
            action: 'sync_catalog',
            syncedCount: 0,
            error: `Unknown sync source: ${payload.source}`,
          };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('ERROR', `Catalog sync failed: ${err.message}`);
      return {
        success: false,
        action: 'sync_catalog',
        syncedCount: 0,
        error: `Catalog sync failed: ${err.message}`,
      };
    }
  }

  /**
   * Sync products from Stripe Products API
   */
  private async syncFromStripe(): Promise<CatalogResult> {
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as Record<string, string> | null;
    if (!keys?.secretKey && !keys?.secret_key) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'Stripe API key not configured. Add it in Settings > API Keys.' };
    }

    const secretKey = keys.secretKey ?? keys.secret_key;
    const productsCollection = getSubCollection('products');
    let syncedCount = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params = new URLSearchParams({ limit: '100', active: 'true' });
      if (startingAfter) { params.set('starting_after', startingAfter); }

      const response = await fetch(`https://api.stripe.com/v1/products?${params}`, {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Stripe API error: ${errBody}`);
      }

      interface StripeProduct {
        id: string;
        name: string;
        description: string | null;
        active: boolean;
        images: string[];
        metadata: Record<string, string>;
        default_price?: string | { unit_amount?: number; currency?: string } | null;
        created: number;
        updated: number;
      }

      const data = await response.json() as { data: StripeProduct[]; has_more: boolean };

      for (const sp of data.data) {
        const product: Product = {
          id: `stripe_${sp.id}`,
          name: sp.name,
          description: sp.description ?? undefined,
          price: 0,
          currency: 'USD',
          status: sp.active ? 'active' : 'archived',
          type: 'physical',
          images: sp.images,
          metadata: { stripeId: sp.id, ...sp.metadata },
          categories: sp.metadata?.category ? [sp.metadata.category] : [],
          createdAt: new Date(sp.created * 1000).toISOString(),
          updatedAt: new Date(sp.updated * 1000).toISOString(),
        };

        // Resolve price if default_price is an expanded object
        if (sp.default_price && typeof sp.default_price === 'object' && sp.default_price.unit_amount) {
          product.price = sp.default_price.unit_amount / 100;
          product.currency = (sp.default_price.currency ?? 'USD').toUpperCase();
        }

        await FirestoreService.set(productsCollection, product.id, product, false);
        syncedCount++;
      }

      hasMore = data.has_more;
      if (data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id;
      }
    }

    this.log('INFO', `Stripe sync complete: ${syncedCount} products synced`);
    return { success: true, action: 'sync_catalog', syncedCount };
  }

  /**
   * Sync products from Shopify REST API
   */
  private async syncFromShopify(): Promise<CatalogResult> {
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'shopify') as Record<string, string> | null;
    if (!keys?.accessToken && !keys?.access_token) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'Shopify API key not configured. Add it in Settings > API Keys.' };
    }
    if (!keys?.shopDomain && !keys?.shop_domain) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'Shopify shop domain not configured. Add shopDomain in Settings > API Keys.' };
    }

    const accessToken = keys.accessToken ?? keys.access_token;
    const shopDomain = keys.shopDomain ?? keys.shop_domain;
    const productsCollection = getSubCollection('products');
    let syncedCount = 0;
    let pageInfo: string | null = null;
    let hasNext = true;

    while (hasNext) {
      const params = new URLSearchParams({ limit: '250' });
      if (pageInfo) { params.set('page_info', pageInfo); }

      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json?${params}`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Shopify API error: ${errBody}`);
      }

      interface ShopifyVariant {
        id: number;
        title: string;
        sku: string;
        price: string;
        compare_at_price: string | null;
        inventory_quantity: number;
        weight: number;
        image_id: number | null;
      }

      interface ShopifyImage {
        id: number;
        src: string;
      }

      interface ShopifyProduct {
        id: number;
        title: string;
        body_html: string;
        status: string;
        product_type: string;
        tags: string;
        variants: ShopifyVariant[];
        images: ShopifyImage[];
        created_at: string;
        updated_at: string;
      }

      const data = await response.json() as { products: ShopifyProduct[] };

      for (const sp of data.products) {
        const firstVariant = sp.variants[0];
        const product: Product = {
          id: `shopify_${sp.id}`,
          name: sp.title,
          description: sp.body_html?.replace(/<[^>]*>/g, '') ?? undefined,
          sku: firstVariant?.sku ?? undefined,
          price: parseFloat(firstVariant?.price ?? '0'),
          compareAtPrice: firstVariant?.compare_at_price ? parseFloat(firstVariant.compare_at_price) : undefined,
          currency: 'USD',
          status: sp.status === 'active' ? 'active' : sp.status === 'archived' ? 'archived' : 'draft',
          type: 'physical',
          variants: sp.variants.map((v) => ({
            id: `shopify_v_${v.id}`,
            sku: v.sku,
            name: v.title,
            options: {},
            price: parseFloat(v.price),
            compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : undefined,
            inventory: v.inventory_quantity,
            weight: v.weight,
          })),
          images: sp.images.map((img) => img.src),
          tags: sp.tags ? sp.tags.split(', ') : [],
          categories: sp.product_type ? [sp.product_type] : [],
          inventory: firstVariant ? {
            tracked: true,
            quantity: firstVariant.inventory_quantity,
          } : undefined,
          metadata: { shopifyId: String(sp.id) },
          createdAt: sp.created_at,
          updatedAt: sp.updated_at,
        };

        await FirestoreService.set(productsCollection, product.id, product, false);
        syncedCount++;
      }

      // Pagination via Link header
      const linkHeader = response.headers.get('Link');
      if (linkHeader?.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^>&]*)/);
        pageInfo = match ? match[1] : null;
        hasNext = pageInfo !== null;
      } else {
        hasNext = false;
      }
    }

    this.log('INFO', `Shopify sync complete: ${syncedCount} products synced`);
    return { success: true, action: 'sync_catalog', syncedCount };
  }

  /**
   * Sync products from WooCommerce REST API
   */
  private async syncFromWooCommerce(): Promise<CatalogResult> {
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'woocommerce') as Record<string, string> | null;
    if (!keys?.consumerKey && !keys?.consumer_key) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'WooCommerce API key not configured. Add it in Settings > API Keys.' };
    }
    if (!keys?.siteUrl && !keys?.site_url) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'WooCommerce site URL not configured. Add siteUrl in Settings > API Keys.' };
    }

    const consumerKey = keys.consumerKey ?? keys.consumer_key;
    const consumerSecret = keys.consumerSecret ?? keys.consumer_secret ?? '';
    const siteUrl = keys.siteUrl ?? keys.site_url;
    const productsCollection = getSubCollection('products');
    let syncedCount = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        per_page: '100',
        page: String(page),
      });

      const response = await fetch(`${siteUrl}/wp-json/wc/v3/products?${params}`);

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`WooCommerce API error: ${errBody}`);
      }

      interface WooImage {
        id: number;
        src: string;
      }

      interface WooCategory {
        id: number;
        name: string;
      }

      interface WooProduct {
        id: number;
        name: string;
        description: string;
        short_description: string;
        sku: string;
        price: string;
        regular_price: string;
        sale_price: string;
        status: string;
        type: string;
        categories: WooCategory[];
        tags: Array<{ name: string }>;
        images: WooImage[];
        stock_quantity: number | null;
        manage_stock: boolean;
        date_created: string;
        date_modified: string;
      }

      const products = await response.json() as WooProduct[];

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const wp of products) {
        const product: Product = {
          id: `woo_${wp.id}`,
          name: wp.name,
          description: wp.description?.replace(/<[^>]*>/g, '') ?? undefined,
          shortDescription: wp.short_description?.replace(/<[^>]*>/g, '') ?? undefined,
          sku: wp.sku ?? undefined,
          price: parseFloat(wp.price || wp.regular_price || '0'),
          compareAtPrice: wp.sale_price ? parseFloat(wp.regular_price) : undefined,
          currency: 'USD',
          status: wp.status === 'publish' ? 'active' : wp.status === 'draft' ? 'draft' : 'archived',
          type: wp.type === 'virtual' ? 'digital' : 'physical',
          images: wp.images.map((img) => img.src),
          categories: wp.categories.map((c) => c.name),
          tags: wp.tags.map((t) => t.name),
          inventory: wp.manage_stock ? {
            tracked: true,
            quantity: wp.stock_quantity ?? 0,
          } : undefined,
          metadata: { woocommerceId: String(wp.id) },
          createdAt: wp.date_created,
          updatedAt: wp.date_modified,
        };

        await FirestoreService.set(productsCollection, product.id, product, false);
        syncedCount++;
      }

      // WooCommerce uses X-WP-TotalPages header
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') ?? '1');
      hasMore = page < totalPages;
      page++;
    }

    this.log('INFO', `WooCommerce sync complete: ${syncedCount} products synced`);
    return { success: true, action: 'sync_catalog', syncedCount };
  }

  /**
   * Manual catalog sync — bulk-write products from payload
   */
  private async syncManual(
    products: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<CatalogResult> {
    if (products.length === 0) {
      return { success: false, action: 'sync_catalog', syncedCount: 0, error: 'No products provided for manual sync' };
    }

    const productsCollection = getSubCollection('products');
    let syncedCount = 0;
    const now = new Date().toISOString();

    for (const p of products) {
      const id = `manual_${Date.now()}_${syncedCount}`;
      const product: Product = {
        ...p,
        id,
        createdAt: now,
        updatedAt: now,
      };

      await FirestoreService.set(productsCollection, id, product, false);
      syncedCount++;
    }

    this.log('INFO', `Manual sync complete: ${syncedCount} products synced`);
    return { success: true, action: 'sync_catalog', syncedCount };
  }

  /**
   * Get a mapped field value from record
   */
  private getMappedValue(
    record: Record<string, unknown>,
    mappings: Record<string, string>,
    field: string,
    fallback: string
  ): unknown {
    const mappedKey = mappings[field];
    if (mappedKey && record[mappedKey] !== undefined) {
      return record[mappedKey];
    }
    return record[fallback];
  }

  /**
   * Safely extract mappings from ecommerce config with explicit typing
   */
  private extractMappings(config: { productMappings?: unknown }): Record<string, string> {
    const raw = config.productMappings;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      return raw as Record<string, string>;
    }
    return {};
  }

  /**
   * Safely extract categories from a product with explicit typing
   */
  private extractCategories(product: Product): string[] {
    const cats: unknown = product.categories;
    if (Array.isArray(cats)) {
      return cats.map((c: unknown) => String(c));
    }
    return [];
  }

  /**
   * Map entity record to Product format using field mappings
   */
  private mapRecordToProduct(
    record: Record<string, unknown>,
    mappings: Record<string, string>
  ): Product {
    const getValue = (field: string, fallback: string): unknown =>
      this.getMappedValue(record, mappings, field, fallback);

    return {
      id: String(record.id ?? record._id ?? ''),
      name: String(getValue('name', 'name') ?? 'Unnamed Product'),
      description: getValue('description', 'description') as string | undefined,
      sku: getValue('sku', 'sku') as string | undefined,
      price: parseFloat(String(getValue('price', 'price') ?? 0)),
      compareAtPrice: getValue('compareAtPrice', 'compareAtPrice') as number | undefined,
      currency: String(getValue('currency', 'currency') ?? 'USD'),
      status: (getValue('status', 'status') ?? 'active') as Product['status'],
      type: (getValue('type', 'type') ?? 'physical') as Product['type'],
      categories: getValue('categories', 'categories') as string[] | undefined,
      images: getValue('images', 'images') as string[] | undefined,
      inventory: getValue('inventory', 'inventory') as Product['inventory'] | undefined,
      metadata: record.metadata as Record<string, unknown> | undefined,
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? new Date().toISOString()),
    };
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };

    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 380, boilerplate: 60 };
  }
}

// Factory function for SwarmRegistry pattern
export function getCatalogManager(): CatalogManagerSpecialist {
  return new CatalogManagerSpecialist();
}
