# E-Commerce Embeddable Storefront

## Overview

Transform any CRM workspace into a fully functional e-commerce platform with embeddable widgets. Similar to Dutchy's shortcode system, users can generate embeddable storefronts that work on any website.

## Key Features

### 1. **One-Click E-Commerce Activation**
- Enable e-commerce mode for any workspace
- Map existing CRM objects (Products, Inventory, Customers) to storefront
- No need to recreate data - use what's already in the CRM

### 2. **Embeddable Widgets**
Generate shortcodes for:
- **Full Storefront**: Complete online store
- **Product Grid**: Grid of products
- **Buy Button**: Single product purchase
- **Shopping Cart**: Standalone cart
- **Product Search**: Search widget
- **Featured Products**: Curated product showcase

### 3. **Universal Compatibility**
Embed anywhere:
- WordPress
- Wix
- Squarespace
- Webflow
- Static HTML sites
- React/Vue/Angular apps
- Custom platforms

---

## Quick Start

### Step 1: Enable E-Commerce

```typescript
// Admin enables e-commerce for workspace
const ecommerceConfig = {
  enabled: true,
  productSchema: 'products_schema_id',
  productMappings: {
    name: 'product_name',
    price: 'price',
    description: 'description',
    images: 'images',
    sku: 'sku',
    inventory: 'stock_quantity'
  },
  storefront: {
    name: 'My Store',
    subdomain: 'mystore',
    // ... configuration
  },
  payments: {
    methods: [
      { type: 'credit_card', enabled: true },
      { type: 'paypal', enabled: true }
    ],
    providers: [
      {
        provider: 'stripe',
        credentialsSecretId: 'stripe_secret_id',
        isDefault: true
      }
    ]
  }
};
```

### Step 2: Generate Embeddable Widget

```typescript
// Create widget
const widget = {
  type: 'full_store',
  config: {
    width: '100%',
    showFilters: true,
    showSearch: true,
    primaryColor: '#FF6B35'
  }
};

// System generates:
const shortcode = '[crm-store id="abc123" type="full"]';
const embedCode = `<script src="https://yourplatform.com/embed.js"></script>
<div data-crm-widget="abc123"></div>`;
```

### Step 3: Embed on Website

#### Option A: WordPress Shortcode
```
[crm-store id="abc123" type="full"]
```

#### Option B: HTML/JavaScript
```html
<!-- Add script once in <head> -->
<script src="https://yourplatform.com/embed.js" async></script>

<!-- Add widget anywhere -->
<div data-crm-widget="abc123" 
     data-type="full_store"
     data-primary-color="#FF6B35"></div>
```

#### Option C: React Component
```typescript
import { CRMStoreWidget } from '@your-platform/react-widgets';

function MyPage() {
  return (
    <CRMStoreWidget 
      widgetId="abc123"
      type="full_store"
      config={{ primaryColor: '#FF6B35' }}
    />
  );
}
```

#### Option D: iframe (No JavaScript)
```html
<iframe 
  src="https://store.yourplatform.com/abc123"
  width="100%"
  height="800px"
  frameborder="0">
</iframe>
```

---

## Widget Types

### 1. Full Storefront
Complete e-commerce experience with all features.

```html
<div data-crm-widget="abc123" 
     data-type="full_store"
     data-width="100%"
     data-max-width="1200px"></div>
```

**Features**:
- Product browsing
- Categories & filters
- Search
- Shopping cart
- Checkout
- Account management

---

### 2. Product Grid
Display a grid of products.

```html
<div data-crm-widget="abc123" 
     data-type="product_grid"
     data-category="electronics"
     data-limit="12"
     data-columns="3"></div>
```

**Configuration**:
- `category`: Filter by category ID
- `limit`: Number of products
- `columns`: Grid columns
- `show-prices`: Show/hide pricing
- `show-cart`: Show "Add to Cart" buttons

---

### 3. Buy Button
Single product purchase button.

```html
<div data-crm-widget="abc123" 
     data-type="buy_button"
     data-product-id="prod_123"
     data-button-text="Buy Now"
     data-direct-checkout="true"></div>
```

**Features**:
- Instant purchase
- Can skip cart (direct checkout)
- Customizable button styling
- Modal or redirect checkout

---

### 4. Shopping Cart
Standalone cart widget (for custom implementations).

```html
<div data-crm-widget="abc123" 
     data-type="cart"
     data-show-checkout="true"></div>
```

---

### 5. Product Card
Single product display.

```html
<div data-crm-widget="abc123" 
     data-type="product_card"
     data-product-id="prod_123"
     data-layout="horizontal"></div>
```

---

### 6. Featured Products
Showcase specific products.

```html
<div data-crm-widget="abc123" 
     data-type="featured"
     data-products="prod_1,prod_2,prod_3"
     data-layout="carousel"></div>
```

---

### 7. Category View
Display products from a specific category.

```html
<div data-crm-widget="abc123" 
     data-type="category"
     data-category-id="cat_123"
     data-columns="4"></div>
```

---

## Advanced Configuration

### Custom Styling

```html
<div data-crm-widget="abc123" 
     data-type="full_store"
     data-primary-color="#FF6B35"
     data-accent-color="#004E89"
     data-border-radius="12px"
     data-font-family="Inter, sans-serif"></div>
```

### Behavior Options

```html
<div data-crm-widget="abc123" 
     data-type="product_grid"
     data-open-in-modal="true"
     data-direct-checkout="false"
     data-show-quick-view="true"></div>
```

### Filters & Search

```html
<div data-crm-widget="abc123" 
     data-type="full_store"
     data-show-filters="true"
     data-show-search="true"
     data-show-categories="true"></div>
```

---

## JavaScript API

For advanced customization, use the JavaScript API:

```javascript
// Initialize widget programmatically
CRMStore.init({
  widgetId: 'abc123',
  containerId: 'store-container',
  type: 'full_store',
  config: {
    primaryColor: '#FF6B35',
    onAddToCart: (product) => {
      console.log('Added to cart:', product);
    },
    onCheckout: (cart) => {
      console.log('Checkout initiated:', cart);
    },
    onPurchase: (order) => {
      console.log('Purchase completed:', order);
      // Track in your analytics
      gtag('event', 'purchase', { value: order.total });
    }
  }
});

// Access cart
const cart = CRMStore.getCart('abc123');
console.log('Cart items:', cart.items);

// Add product to cart
CRMStore.addToCart('abc123', {
  productId: 'prod_123',
  quantity: 1
});

// Open checkout
CRMStore.openCheckout('abc123');

// Listen to events
CRMStore.on('cart:updated', (event) => {
  console.log('Cart updated:', event.detail);
});
```

---

## React SDK

```typescript
import { 
  CRMStoreWidget, 
  useCart, 
  useCRMStore 
} from '@your-platform/react-widgets';

function MyStorefront() {
  const { cart, addToCart, removeFromCart } = useCart('abc123');
  const { products, loading } = useCRMStore('abc123');

  return (
    <div>
      {/* Full widget */}
      <CRMStoreWidget 
        widgetId="abc123"
        type="full_store"
      />

      {/* Or build custom UI */}
      <div>
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={() => addToCart(product.id)}
          />
        ))}
      </div>

      <Cart items={cart.items} />
    </div>
  );
}
```

---

## WordPress Plugin

Auto-generated WordPress plugin for each workspace:

### Installation
1. Download plugin from CRM admin
2. Upload to WordPress `/wp-content/plugins/`
3. Activate plugin
4. Add API key in settings

### Usage
```
[crm-store type="full"]
[crm-store type="grid" category="electronics" limit="12"]
[crm-store type="buy_button" product="prod_123"]
```

### Gutenberg Block
Includes visual block editor for drag-and-drop widget placement.

---

## Checkout Flow

### Embedded Checkout
Checkout happens within the embedded widget (modal or inline).

### Redirect Checkout
Redirect to hosted checkout page for security/compliance.

```javascript
CRMStore.init({
  widgetId: 'abc123',
  checkoutMode: 'redirect', // or 'embedded'
  checkoutUrl: 'https://checkout.yourplatform.com/abc123'
});
```

---

## Payment Processing

### Supported Processors
- Stripe
- Square
- PayPal
- Authorize.net
- Braintree
- Custom gateway

### PCI Compliance
- All card data handled by payment processor
- No sensitive data touches your servers
- Fully PCI DSS compliant

### Payment Methods
- Credit/Debit cards
- Apple Pay
- Google Pay
- PayPal
- Buy Now Pay Later (Affirm, Afterpay, Klarna)
- Bank transfer
- Cash on delivery
- Cryptocurrency (via Stripe/Coinbase)

---

## Shipping & Tax

### Shipping Calculation
- Flat rate
- Free shipping (with minimum)
- Real-time carrier rates (USPS, UPS, FedEx, DHL)
- Local pickup
- Multiple shipping zones

### Tax Calculation
- Manual tax rates
- Automated tax (TaxJar, Avalara, Stripe Tax)
- Tax nexus management
- Product tax categories

---

## Order Management

All orders sync back to CRM:
- Auto-create Customer entity
- Auto-create Order entity
- Trigger workflows
- Assign to sales rep
- Send notifications
- Update inventory

### Order Status Tracking
Customers get tracking page:
```
https://track.yourplatform.com/abc123/order_456
```

---

## Inventory Sync

Real-time inventory sync:
- Update product stock in CRM
- Instantly reflects in storefront
- Low stock alerts
- Out of stock handling
- Backorder support

---

## Multi-Currency & Localization

Support multiple currencies and languages:

```javascript
CRMStore.init({
  widgetId: 'abc123',
  currency: 'USD', // or 'EUR', 'GBP', etc.
  language: 'en',   // or 'es', 'fr', etc.
  autoDetect: true  // Auto-detect from browser
});
```

---

## Analytics & Tracking

### Built-in Analytics
- Product views
- Cart additions
- Checkout initiations
- Purchases
- Revenue
- Conversion rates

### Third-Party Integration
- Google Analytics
- Facebook Pixel
- Google Tag Manager
- Custom tracking scripts

```javascript
CRMStore.init({
  widgetId: 'abc123',
  analytics: {
    googleAnalytics: 'G-XXXXXXXXXX',
    facebookPixel: '123456789',
    customScripts: [
      'https://example.com/tracking.js'
    ]
  }
});
```

---

## Security

### CORS
Whitelist allowed domains:

```typescript
widget.allowedDomains = [
  'mywebsite.com',
  'www.mywebsite.com',
  'staging.mywebsite.com'
];
```

### Rate Limiting
Prevent abuse with built-in rate limiting.

### Fraud Detection
Integration with Stripe Radar, Signifyd, or custom rules.

---

## Performance

### Optimizations
- Lazy loading
- Image optimization (WebP, responsive images)
- CDN delivery
- Edge caching
- Code splitting

### Lighthouse Score
Target: 90+ on all metrics

---

## Use Cases

### 1. **Service Business → Booking System**
- CRM objects: Services, Appointments
- Widget: Service catalog + booking form
- Payment: Deposits or full payment

### 2. **Transportation Compliance → Store**
- CRM objects: Compliance Services, Documents
- Widget: Service packages
- Payment: Subscription or one-time

### 3. **B2B Sales → Product Catalog**
- CRM objects: Products, Quotes
- Widget: Product grid + quote request
- Integration: Sales team gets notified

### 4. **Consulting → Service Packages**
- CRM objects: Service Packages, Hours
- Widget: Package selection
- Payment: Upfront + hourly billing

### 5. **E-Commerce → Full Store**
- CRM objects: Products, Inventory, Orders
- Widget: Complete storefront
- Features: All e-commerce capabilities

---

## Pricing Models

### For Platform Users
- **Free**: Up to $1,000/month GMV
- **Pro**: 1.5% + Stripe fees
- **Enterprise**: Custom pricing, wholesale rates

### For End Customers
- Standard payment processing fees (Stripe/Square rates)
- No additional platform fees at Enterprise level

---

## Developer API

Build custom integrations:

```typescript
// REST API
GET /api/v1/ecommerce/{widgetId}/products
GET /api/v1/ecommerce/{widgetId}/cart/{sessionId}
POST /api/v1/ecommerce/{widgetId}/cart/add
POST /api/v1/ecommerce/{widgetId}/checkout
GET /api/v1/ecommerce/{widgetId}/orders/{orderId}

// Webhooks
ecommerce.order.created
ecommerce.order.paid
ecommerce.order.fulfilled
ecommerce.order.cancelled
ecommerce.product.low_stock
ecommerce.product.out_of_stock
```

---

## Roadmap

### Phase 1 (MVP) ✓
- Product mapping from CRM
- Basic storefront
- Stripe integration
- Embeddable widgets

### Phase 2 (Q2 2024)
- WordPress plugin
- Advanced shipping
- Tax automation
- Product reviews

### Phase 3 (Q3 2024)
- Subscriptions
- Memberships
- Digital products
- Drop shipping integration

### Phase 4 (Q4 2024)
- Mobile app
- POS system
- Multi-vendor marketplace
- Wholesale portal

