import React, { useEffect, useRef, useState } from 'react';

/**
 * React SDK for CRM Store Widgets
 */

interface CRMStoreWidgetProps {
  widgetId: string;
  type?: 'full_store' | 'product_grid' | 'buy_button' | 'cart' | 'product_card' | 'featured' | 'category' | 'search';
  config?: WidgetConfig;
  onAddToCart?: (product: any) => void;
  onCheckout?: (cart: any) => void;
  onPurchase?: (order: any) => void;
  onError?: (error: any) => void;
}

interface WidgetConfig {
  width?: string;
  height?: string;
  maxWidth?: string;
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  [key: string]: any;
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
    if (!loaded || !containerRef.current) {return;}

    // Initialize widget
    const widget = (window as any).CRMStore.init({
      widgetId,
      container: containerRef.current,
      type,
      config
    });

    // Set up event listeners
    if (onAddToCart) {
      (window as any).CRMStore.on('cart:add', onAddToCart);
    }
    if (onCheckout) {
      (window as any).CRMStore.on('checkout', onCheckout);
    }
    if (onPurchase) {
      (window as any).CRMStore.on('purchase', onPurchase);
    }
    if (onError) {
      (window as any).CRMStore.on('error', onError);
    }

    return () => {
      // Cleanup
      if (widget) {
        (window as any).CRMStore.destroy(widgetId);
      }
    };
  }, [loaded, widgetId, type, config, onAddToCart, onCheckout, onPurchase, onError]);

  return <div ref={containerRef} data-crm-widget={widgetId} />;
};

/**
 * Hook to access cart state
 */
export const useCart = (widgetId: string) => {
  const [cart, setCart] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).CRMStore) {return;}

    // Get initial cart
    const initialCart = (window as any).CRMStore.getCart(widgetId);
    setCart(initialCart);

    // Listen for cart updates
    const handleCartUpdate = (event: any) => {
      if (event.widgetId === widgetId) {
        setCart(event.cart);
      }
    };

    (window as any).CRMStore.on('cart:updated', handleCartUpdate);

    return () => {
      (window as any).CRMStore.off('cart:updated', handleCartUpdate);
    };
  }, [widgetId]);

  const addToCart = async (product: any) => {
    if ((window as any).CRMStore) {
      await (window as any).CRMStore.addToCart(widgetId, product);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if ((window as any).CRMStore) {
      await (window as any).CRMStore.removeFromCart(widgetId, itemId);
    }
  };

  const openCheckout = () => {
    if ((window as any).CRMStore) {
      (window as any).CRMStore.openCheckout(widgetId);
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
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://api.yourplatform.com/v1/widgets/${widgetId}/products`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        
        const data = await response.json();
        setProducts(data.products ?? []);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [widgetId]);

  return { products, loading, error };
};

/**
 * Product Card Component
 */
export interface ProductCardProps {
  product: any;
  onAddToCart?: (product: any) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div className="product-card">
      {product.image && (
        <img src={product.image} alt={product.name} className="product-image" />
      )}
      <h3 className="product-name">{product.name}</h3>
      <p className="product-price">${product.price.toFixed(2)}</p>
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
  items: any[];
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
                <img src={item.image} alt={item.productName} />
                <div className="cart-item-details">
                  <h4>{item.productName}</h4>
                  <p>Quantity: {item.quantity}</p>
                  <p>${(item.price * item.quantity).toFixed(2)}</p>
                </div>
                {onRemove && (
                  <button onClick={() => onRemove(item.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
          
          <div className="cart-total">
            <strong>Total: ${total.toFixed(2)}</strong>
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


