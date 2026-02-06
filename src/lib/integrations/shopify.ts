/**
 * Shopify Integration
 * - Sync products
 * - Track orders
 * - Manage customers
 * - Inventory sync
 */

import { logger } from '@/lib/logger/logger';

interface ShopifyProduct {
  id?: string;
  title: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  inventory?: number;
  images?: string[];
}

interface ShopifyOrder {
  id: string;
  orderNumber: string;
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  lineItems: Array<{
    productId: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  createdAt: Date;
  financialStatus: 'pending' | 'paid' | 'refunded';
}

/**
 * Sync product to Shopify
 */
export async function syncProductToShopify(
  product: ShopifyProduct
): Promise<string> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('shopify');
    
    if (!credentials?.accessToken) {
      throw new Error('Shopify not connected');
    }

    const shopDomain = credentials.metadata?.shopDomain;
    if (!shopDomain) {
      throw new Error('Shopify shop domain not found');
    }

    const shopifyProduct = {
      product: {
        title: product.title,
        body_html: product.description,
        variants: [{
          price: product.price.toString(),
          compare_at_price: product.compareAtPrice?.toString(),
          sku: product.sku,
          inventory_quantity: product.inventory ?? 0,
        }],
        images: product.images?.map(url => ({ src: url })) ?? [],
      },
    };

    const response = await fetch(
      `https://${shopDomain}/admin/api/2024-01/products.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopifyProduct),
      }
    );

    interface ShopifyErrorResponse {
      errors?: Record<string, unknown>;
      [key: string]: unknown;
    }

    interface ShopifyProductResponse {
      product: {
        id: number;
      };
    }

    if (!response.ok) {
      const error = await response.json() as ShopifyErrorResponse;
      throw new Error(`Shopify API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as ShopifyProductResponse;
    const productId = data.product.id.toString();

    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.info('Product synced to Shopify', { organizationId: DEFAULT_ORG_ID, productId });

    return productId;

  } catch (error) {
    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.error('Failed to sync product to Shopify', error as Error, { organizationId: DEFAULT_ORG_ID });
    throw error;
  }
}

/**
 * Fetch orders from Shopify
 */
export async function fetchShopifyOrders(
  since?: Date
): Promise<ShopifyOrder[]> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('shopify');
    
    if (!credentials?.accessToken) {
      throw new Error('Shopify not connected');
    }

    const shopDomain = credentials.metadata?.shopDomain;
    if (!shopDomain) {
      throw new Error('Shopify shop domain not found');
    }

    const params = new URLSearchParams({
      status: 'any',
      limit: '250',
    });

    if (since) {
      params.append('created_at_min', since.toISOString());
    }

    const response = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders.json?${params}`,
      {
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Shopify orders');
    }

    interface ShopifyOrdersResponse {
      orders: ShopifyOrderResponse[];
    }

    interface ShopifyOrderResponse {
      id: number;
      order_number: number;
      email?: string;
      customer?: {
        email?: string;
        first_name?: string;
        last_name?: string;
      };
      line_items: Array<{
        product_id?: number;
        title: string;
        quantity: number;
        price: string;
      }>;
      total_price: string;
      created_at: string;
      financial_status?: string;
    }

    const data = await response.json() as ShopifyOrdersResponse;

    const orders = data.orders.map((order: ShopifyOrderResponse): ShopifyOrder => ({
      id: order.id.toString(),
      orderNumber: order.order_number.toString(),
      customer: {
        email: (order.customer?.email !== '' && order.customer?.email != null)
          ? order.customer.email
          : (order.email !== '' && order.email != null)
            ? order.email
            : '',
        firstName: order.customer?.first_name,
        lastName: order.customer?.last_name,
      },
      lineItems: order.line_items.map((item) => ({
        productId: item.product_id?.toString() ?? '',
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
      totalPrice: parseFloat(order.total_price),
      createdAt: new Date(order.created_at),
      financialStatus: order.financial_status === 'paid' || order.financial_status === 'refunded' ? order.financial_status : 'pending',
    }));

    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.info('Shopify orders fetched', {
      organizationId: DEFAULT_ORG_ID,
      count: orders.length,
    });

    return orders;

  } catch (error) {
    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.error('Failed to fetch Shopify orders', error as Error, { organizationId: DEFAULT_ORG_ID });
    throw error;
  }
}

/**
 * Sync Shopify orders to CRM as deals
 */
export async function syncShopifyOrdersToCRM(
  workspaceId: string = 'default'
): Promise<number> {
  try {
    // Get orders from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const orders = await fetchShopifyOrders(since);

    // Create deals in CRM
    const { createDeal } = await import('@/lib/crm/deal-service');
    const { createLead } = await import('@/lib/crm/lead-service');

    let synced = 0;

    for (const order of orders) {
      try {
        // Create or update customer as lead
        if (order.customer.email) {
          await createLead(
            {
              firstName: (order.customer.firstName !== '' && order.customer.firstName != null) ? order.customer.firstName : 'Shopify',
              lastName: (order.customer.lastName !== '' && order.customer.lastName != null) ? order.customer.lastName : 'Customer',
              email: order.customer.email,
              source: 'Shopify',
              status: 'converted',
            },
            workspaceId,
            { skipDuplicateCheck: true }
          );
        }

        // Create deal for order
        await createDeal({
          name: `Shopify Order #${order.orderNumber}`,
          value: order.totalPrice,
          stage: order.financialStatus === 'paid' ? 'closed_won' : 'negotiation',
          probability: order.financialStatus === 'paid' ? 100 : 80,
          source: 'Shopify',
          companyName: 'Shopify Customer',
        }, workspaceId);

        synced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to sync individual Shopify order', { orderId: order.id, error: errorMessage });
      }
    }

    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.info('Shopify orders synced to CRM', { organizationId: DEFAULT_ORG_ID, synced });

    return synced;

  } catch (error) {
    const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
    logger.error('Failed to sync Shopify orders to CRM', error as Error, { organizationId: DEFAULT_ORG_ID });
    throw error;
  }
}

/**
 * Get Shopify OAuth URL
 */
export function getShopifyAuthUrl(shopDomain: string, redirectUri: string): string {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    throw new Error('SHOPIFY_API_KEY not configured');
  }

  const scopes = 'read_products,write_products,read_orders,read_customers';

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeShopifyCode(
  shopDomain: string,
  code: string
): Promise<{ accessToken: string; scope: string; shopDomain: string }> {
  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Shopify credentials not configured');
    }

    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Shopify code');
    }

    interface ShopifyTokenResponse {
      access_token: string;
      scope: string;
    }

    const data = await response.json() as ShopifyTokenResponse;

    return {
      accessToken: data.access_token,
      scope: data.scope,
      shopDomain,
    };

  } catch (error) {
    logger.error('Shopify OAuth exchange failed', error as Error);
    throw error;
  }
}

