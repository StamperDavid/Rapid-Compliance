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
  const { shopDomain, accessToken } = integration.config;
  
  if (!shopDomain || !accessToken) {
    throw new Error('Shopify credentials not configured');
  }
  
  switch (functionName) {
    case 'checkShopifyInventory':
      return await checkInventory(parameters, shopDomain, accessToken);
      
    case 'addToShopifyCart':
      return await addToCart(parameters, shopDomain, accessToken);
      
    case 'getShopifyProduct':
      return await getProduct(parameters, shopDomain, accessToken);
      
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
    (sum: number, variant: any) => sum + (variant.inventory_quantity || 0),
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
    (sum: number, variant: any) => sum + (variant.inventory_quantity || 0),
    0
  );
  
  return {
    title: product.title,
    description: product.body_html?.replace(/<[^>]*>/g, '') || '',
    price: parseFloat(product.variants[0].price),
    images: product.images.map((img: any) => img.src),
    inStock: totalInventory > 0,
  };
}

