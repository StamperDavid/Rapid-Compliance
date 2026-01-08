/**
 * Shopify Integration
 * E-commerce functions for Shopify stores
 */

import type { ConnectedIntegration } from '@/types/integrations';

/**
 * Execute a Shopify function
 */
export async function executeShopifyFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  if (!integration.config) {
    throw new Error('Shopify configuration missing');
  }
  
  const shopDomain = integration.config.shopDomain as string;
  const accessToken = integration.config.accessToken as string;
  
  if (!shopDomain || !accessToken) {
    throw new Error('Shopify credentials not configured');
  }
  
  switch (functionName) {
    case 'checkShopifyInventory':
      // Validate parameters for checkInventory
      if (!parameters.productId || typeof parameters.productId !== 'string') {
        throw new Error('productId (string) is required for checkShopifyInventory');
      }
      return checkInventory(
        { productId: parameters.productId },
        shopDomain,
        accessToken
      );
      
    case 'addToShopifyCart':
      // Validate parameters for addToCart
      if (!parameters.productId || typeof parameters.productId !== 'string') {
        throw new Error('productId (string) is required for addToShopifyCart');
      }
      if (!parameters.quantity || typeof parameters.quantity !== 'number') {
        throw new Error('quantity (number) is required for addToShopifyCart');
      }
      if (parameters.variantId && typeof parameters.variantId !== 'string') {
        throw new Error('variantId must be a string');
      }
      return addToCart(
        {
          productId: parameters.productId,
          quantity: parameters.quantity,
          variantId: parameters.variantId,
        },
        shopDomain,
        accessToken
      );
      
    case 'getShopifyProduct':
      // Validate parameters for getProduct
      if (!parameters.productId || typeof parameters.productId !== 'string') {
        throw new Error('productId (string) is required for getShopifyProduct');
      }
      return getProduct(
        { productId: parameters.productId },
        shopDomain,
        accessToken
      );
      
    default:
      throw new Error(`Unknown Shopify function: ${functionName}`);
  }
}

/**
 * Check product inventory
 */
async function checkInventory(
  params: { productId: string },
  shopDomain: string,
  accessToken: string
): Promise<number> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-01/products/${params.productId}.json`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  
  const data = await response.json();
  const product = data.product;
  
  // Sum up inventory across all variants
  const totalInventory = product.variants.reduce(
    (sum: number, variant: any) => sum + (variant.inventory_quantity ?? 0),
    0
  );
  
  return totalInventory;
}

/**
 * Add product to cart
 */
async function addToCart(
  params: {
    productId: string;
    quantity: number;
    variantId?: string;
  },
  shopDomain: string,
  accessToken: string
): Promise<{ cartUrl: string; itemAdded: boolean }> {
  // Get product to get variant ID if not provided
  let variantId = params.variantId;
  
  if (!variantId) {
    const productResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/products/${params.productId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const productData = await productResponse.json();
    variantId = productData.product.variants[0].id;
  }
  
  // Create cart URL with variant
  const cartUrl = `https://${shopDomain}/cart/${variantId}:${params.quantity}`;
  
  return {
    cartUrl,
    itemAdded: true,
  };
}

/**
 * Get product details
 */
async function getProduct(
  params: { productId: string },
  shopDomain: string,
  accessToken: string
): Promise<{
  title: string;
  description: string;
  price: number;
  images: string[];
  inStock: boolean;
}> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-01/products/${params.productId}.json`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  
  const data = await response.json();
  const product = data.product;
  
  const totalInventory = product.variants.reduce(
    (sum: number, variant: any) => sum + (variant.inventory_quantity ?? 0),
    0
  );

  const descriptionHtml = product.body_html?.replace(/<[^>]*>/g, '');
  return {
    title: product.title,
    description: (descriptionHtml !== '' && descriptionHtml != null) ? descriptionHtml : '',
    price: parseFloat(product.variants[0].price),
    images: product.images.map((img: any) => img.src),
    inStock: totalInventory > 0,
  };
}

