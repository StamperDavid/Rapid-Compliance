/**
 * Shopify Integration
 * E-commerce functions for Shopify stores
 */

import type { ConnectedIntegration } from '@/types/integrations';

// Shopify API Response Types
interface ShopifyVariant {
  id: string;
  price: string;
  inventory_quantity: number;
}

interface ShopifyImage {
  src: string;
}

interface ShopifyProduct {
  title: string;
  body_html?: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyProductResponse {
  product: ShopifyProduct;
}

// Function Result Types
interface CheckInventoryResult {
  inventory: number;
}

interface AddToCartResult {
  cartUrl: string;
  itemAdded: boolean;
}

interface GetProductResult {
  title: string;
  description: string;
  price: number;
  images: string[];
  inStock: boolean;
}

type ShopifyFunctionResult = CheckInventoryResult | AddToCartResult | GetProductResult;

/**
 * Execute a Shopify function
 */
export async function executeShopifyFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<ShopifyFunctionResult> {
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
): Promise<CheckInventoryResult> {
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

  const data = await response.json() as ShopifyProductResponse;
  const product = data.product;

  // Sum up inventory across all variants
  const totalInventory = product.variants.reduce(
    (sum: number, variant: ShopifyVariant) => sum + (variant.inventory_quantity ?? 0),
    0
  );

  return { inventory: totalInventory };
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
): Promise<AddToCartResult> {
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

    const productData = await productResponse.json() as ShopifyProductResponse;
    const firstVariant = productData.product.variants[0];
    if (!firstVariant) {
      throw new Error('Product has no variants');
    }
    variantId = firstVariant.id;
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
): Promise<GetProductResult> {
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

  const data = await response.json() as ShopifyProductResponse;
  const product = data.product;

  const totalInventory = product.variants.reduce(
    (sum: number, variant: ShopifyVariant) => sum + (variant.inventory_quantity ?? 0),
    0
  );

  const descriptionHtml = product.body_html?.replace(/<[^>]*>/g, '') ?? '';
  const firstVariant = product.variants[0];
  if (!firstVariant) {
    throw new Error('Product has no variants');
  }

  return {
    title: product.title,
    description: descriptionHtml !== '' ? descriptionHtml : '',
    price: parseFloat(firstVariant.price),
    images: product.images.map((img: ShopifyImage) => img.src),
    inStock: totalInventory > 0,
  };
}

