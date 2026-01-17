import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * React SDK for CRM Store Widgets
 */

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
}

interface CartItem {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Cart {
  items: CartItem[];
  total: number;
}

interface CRMStoreAPI {
  init: (config: Record<string, unknown>) => unknown;
  on: (event: string, handler: (data: unknown) => void) => void;
  off: (event: string, handler: (data: unknown) => void) => void;
  destroy: (widgetId: string) => void;
  getCart: (widgetId: string) => Cart | null;
  addToCart: (widgetId: string, product: Product) => Promise<void>;
  removeFromCart: (widgetId: string, itemId: string) => Promise<void>;
  openCheckout: (widgetId: string) => void;
}

declare global {
  interface Window {
    CRMStore?: CRMStoreAPI;
  }
}

interface CRMStoreWidgetProps {
  widgetId: string;
  type?: 'full_store' | 'product_grid' | 'buy_button' | 'cart' | 'product_card' | 'featured' | 'category' | 'search';
  config?: WidgetConfig;
  onAddToCart?: (product: Product) => void;
  onCheckout?: (cart: Cart) => void;
  onPurchase?: (order: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

interface WidgetConfig {
  width?: string;
  height?: string;
  maxWidth?: string;
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  [key: string]: unknown;
}

export const CRMStoreWidget: React.FC<CRMStoreWidgetProps> = ({
  widgetId,
  type = 'full_store',
  config = {},
  onAddToCart,
  onCheckout,
  onPurchase,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Ensure CRMStore SDK is loaded
    const script = document.createElement('script');
    script.src = 'https://yourplatform.com/embed.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current || !window.CRMStore) {return;}

    // Initialize widget
    const widget = window.CRMStore.init({
      widgetId,
      container: containerRef.current,
      type,
      config
    });

    // Set up event listeners
    if (onAddToCart && window.CRMStore) {
      window.CRMStore.on('cart:add', (data: unknown) => {
        onAddToCart(data as Product);
      });
    }
    if (onCheckout && window.CRMStore) {
      window.CRMStore.on('checkout', (data: unknown) => {
        onCheckout(data as Cart);
      });
    }
    if (onPurchase && window.CRMStore) {
      window.CRMStore.on('purchase', (data: unknown) => {
        onPurchase(data as Record<string, unknown>);
      });
    }
    if (onError && window.CRMStore) {
      window.CRMStore.on('error', (data: unknown) => {
        onError(data as Error);
      });
    }

    return () => {
      // Cleanup
      if (widget && window.CRMStore) {
        window.CRMStore.destroy(widgetId);
      }
    };
  }, [loaded, widgetId, type, config, onAddToCart, onCheckout, onPurchase, onError]);

  return <div ref={containerRef} data-crm-widget={widgetId} />;
};

/**
 * Hook to access cart state
 */
export const useCart = (widgetId: string) => {
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.CRMStore) {return;}

    // Get initial cart
    const initialCart = window.CRMStore.getCart(widgetId);
    setCart(initialCart);

    // Listen for cart updates
    const handleCartUpdate = (data: unknown) => {
      const event = data as { widgetId: string; cart: Cart };
      if (event.widgetId === widgetId) {
        setCart(event.cart);
      }
    };

    window.CRMStore.on('cart:updated', handleCartUpdate);

    return () => {
      if (window.CRMStore) {
        window.CRMStore.off('cart:updated', handleCartUpdate);
      }
    };
  }, [widgetId]);

  const addToCart = async (product: Product) => {
    if (window.CRMStore) {
      await window.CRMStore.addToCart(widgetId, product);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (window.CRMStore) {
      await window.CRMStore.removeFromCart(widgetId, itemId);
    }
  };

  const openCheckout = () => {
    if (window.CRMStore) {
      window.CRMStore.openCheckout(widgetId);
    }
  };

  return {
    cart,
    addToCart,
    removeFromCart,
    openCheckout,
    itemCount: cart?.items?.length ?? 0,
    total: cart?.total ?? 0
  };
};

/**
 * Hook to access CRM Store data
 */
export const useCRMStore = (widgetId: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://api.yourplatform.com/v1/widgets/${widgetId}/products`);

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json() as { products?: Product[] };
        setProducts(data.products ?? []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, [widgetId]);

  return { products, loading, error };
};

/**
 * Product Card Component
 */
export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div className="product-card">
      {product.image && (
        <Image src={product.image} alt={product.name} width={300} height={300} className="product-image" />
      )}
      <h3 className="product-name">{product.name}</h3>
      <p className="product-price">${(product.price / 100).toFixed(2)}</p>
      {product.description && (
        <p className="product-description">{product.description}</p>
      )}
      {onAddToCart && (
        <button onClick={() => onAddToCart(product)} className="add-to-cart-button">
          Add to Cart
        </button>
      )}
    </div>
  );
};

/**
 * Cart Component
 */
export interface CartProps {
  items: CartItem[];
  onRemove?: (itemId: string) => void;
  onCheckout?: () => void;
}

export const Cart: React.FC<CartProps> = ({ items, onRemove, onCheckout }) => {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="cart">
      <h2>Shopping Cart ({items.length})</h2>

      {items.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.id} className="cart-item">
                {item.image && (
                  <Image src={item.image} alt={item.productName} width={80} height={80} />
                )}
                <div className="cart-item-details">
                  <h4>{item.productName}</h4>
                  <p>Quantity: {item.quantity}</p>
                  <p>${((item.price * item.quantity) / 100).toFixed(2)}</p>
                </div>
                {onRemove && (
                  <button onClick={() => onRemove(item.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>

          <div className="cart-total">
            <strong>Total: ${(total / 100).toFixed(2)}</strong>
          </div>

          {onCheckout && (
            <button onClick={onCheckout} className="checkout-button">
              Proceed to Checkout
            </button>
          )}
        </>
      )}
    </div>
  );
};


