import type { Timestamp } from 'firebase/firestore';
import type { EntityFilter } from './entity';

/**
 * E-Commerce Configuration
 * Turn any workspace into a storefront with embeddable widgets
 */
export interface EcommerceConfig {
  id: string;

  // Status
  enabled: boolean;
  
  // Product Configuration
  productSchema: string; // Which schema represents products
  productMappings: ProductFieldMappings;
  
  // Storefront
  storefront: StorefrontConfig;
  
  // Checkout
  checkout: CheckoutConfig;
  
  // Payment Processing
  payments: PaymentConfig;
  
  // Shipping
  shipping: ShippingConfig;
  
  // Tax
  tax: TaxConfig;
  
  // Inventory
  inventory: InventoryConfig;
  
  // Notifications
  notifications: EcommerceNotifications;
  
  // Integration with CRM
  integration: {
    createCustomerEntity: boolean; // Auto-create customer records
    customerSchema?: string; // Which schema for customers
    
    createOrderEntity: boolean; // Auto-create order records
    orderSchema?: string; // Which schema for orders
    
    triggerWorkflows: boolean; // Trigger workflows on orders
    assignSalesRep: boolean; // Auto-assign to sales rep
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Product Field Mappings
 * Map CRM fields to e-commerce product fields
 */
export interface ProductFieldMappings {
  // Required fields
  name: string;          // Field key for product name
  price: string;         // Field key for price
  description: string;   // Field key for description
  images: string;        // Field key for product images
  
  // Optional fields
  sku?: string;
  category?: string;
  variants?: string;     // For product variations
  inventory?: string;    // Stock quantity field
  weight?: string;
  dimensions?: string;
  
  // SEO
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  
  // Custom fields
  customFields?: Record<string, string>; // Display name -> field key
}

/**
 * Storefront Configuration
 */
export interface StorefrontConfig {
  // Basic info
  name: string;
  tagline?: string;
  description?: string;
  logo?: string;
  favicon?: string;
  
  // Domain
  customDomain?: string;
  subdomain: string; // e.g., mystore.yourplatform.com
  
  // Theme
  themeId: string; // References Theme
  layout: StorefrontLayout;
  
  // Pages
  pages: StorefrontPage[];
  
  // Product Display
  productDisplay: ProductDisplayConfig;
  
  // Categories/Collections
  categories: ProductCategory[];
  featuredProducts?: string[]; // Product IDs
  
  // Search & Filtering
  searchEnabled: boolean;
  filters: ProductFilter[];
  
  // Social
  socialLinks?: SocialLinks;
  
  // SEO
  seo: StorefrontSEO;
  
  // Analytics
  analytics?: {
    googleAnalyticsId?: string;
    facebookPixelId?: string;
    customScripts?: string[];
  };
  
  // Localization
  localization: {
    defaultLanguage: string;
    defaultCurrency: string;
    supportedLanguages: string[];
    supportedCurrencies: string[];
  };
}

export interface StorefrontLayout {
  type: 'grid' | 'list' | 'masonry' | 'custom';
  
  // Header
  header: {
    style: 'fixed' | 'sticky' | 'static';
    showSearch: boolean;
    showCart: boolean;
    showAccount: boolean;
    announcementBar?: string;
    navigation: NavigationItem[];
  };
  
  // Footer
  footer: {
    show: boolean;
    columns: FooterColumn[];
    copyrightText?: string;
    paymentIcons?: string[]; // visa, mastercard, etc.
  };
  
  // Product Grid
  productsPerPage: number;
  columnsDesktop: number;
  columnsTablet: number;
  columnsMobile: number;
}

export interface NavigationItem {
  label: string;
  type: 'category' | 'page' | 'url';
  target: string; // Category ID, page ID, or URL
  children?: NavigationItem[];
  icon?: string;
}

export interface FooterColumn {
  title: string;
  links: {
    label: string;
    url: string;
    openInNewTab?: boolean;
  }[];
}

export interface StorefrontPage {
  id: string;
  slug: string;
  title: string;
  content: string; // Rich text/HTML
  showInMenu: boolean;
  menuOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ProductDisplayConfig {
  showPricing: boolean;
  showInventoryStatus: boolean;
  showSKU: boolean;
  showCategories: boolean;
  showReviews: boolean;
  
  // Image settings
  imageAspectRatio: string; // e.g., "1:1", "4:3"
  enableImageZoom: boolean;
  enableImageGallery: boolean;
  
  // Quick view
  enableQuickView: boolean;
  
  // Variants
  variantDisplayType: 'dropdown' | 'buttons' | 'swatches';
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string; // For nested categories
  order: number;
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  
  // Filter to auto-populate
  autoPopulateFilter?: EntityFilter;
}

export interface ProductFilter {
  id: string;
  label: string;
  fieldKey: string; // Field to filter on
  type: 'checkbox' | 'range' | 'color' | 'size';
  options?: FilterOption[];
  enabled: boolean;
}

export interface FilterOption {
  label: string;
  value: unknown;
  count?: number; // Number of products
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  pinterest?: string;
}

export interface StorefrontSEO {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  favicon?: string;
  
  // Structured data
  enableStructuredData: boolean;
}

/**
 * Checkout Configuration
 */
export interface CheckoutConfig {
  // Checkout flow
  checkoutType: 'single_page' | 'multi_step' | 'side_cart';
  
  // Guest checkout
  allowGuestCheckout: boolean;
  requireAccountCreation: boolean;
  
  // Fields
  requiredFields: CheckoutField[];
  optionalFields: CheckoutField[];
  
  // Cart
  cart: {
    enableCartNotes: boolean;
    enableGiftMessage: boolean;
    enableDiscountCodes: boolean;
    enableTipOption: boolean;
    showShippingEstimate: boolean;
    
    // Cart abandonment
    sendAbandonmentEmails: boolean;
    abandonmentDelayMinutes?: number;
  };
  
  // Order Processing
  orderProcessing: {
    autoConfirmOrders: boolean;
    requireAdminApproval: boolean;
    
    // Order numbering
    orderNumberPrefix?: string;
    orderNumberStartFrom?: number;
  };
  
  // Post-purchase
  postPurchase: {
    showOrderTracking: boolean;
    showRecommendations: boolean;
    showReviewPrompt: boolean;
    
    thankYouPageUrl?: string; // Custom thank you page
    redirectUrl?: string; // Redirect after purchase
  };
}

export type CheckoutField =
  | 'email'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'address1'
  | 'address2'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'orderNotes';

/**
 * Payment Configuration
 */
export interface PaymentConfig {
  // Enabled payment methods
  methods: PaymentMethod[];
  
  // Currency
  currency: string;
  
  // Test mode
  testMode: boolean;
  
  // Payment providers
  providers: PaymentProvider[];
}

export interface PaymentMethod {
  type: PaymentMethodType;
  enabled: boolean;
  displayName: string;
  description?: string;
  icon?: string;
  order: number;
  
  // Restrictions
  minAmount?: number;
  maxAmount?: number;
  allowedCountries?: string[];
}

export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay'
  | 'stripe'
  | 'square'
  | 'bank_transfer'
  | 'cash_on_delivery'
  | 'cryptocurrency'
  | 'buy_now_pay_later'; // Afterpay, Klarna, etc.

export interface PaymentProvider {
  provider: 'stripe' | 'square' | 'paypal' | 'authorize_net' | 'braintree' | 'custom';
  
  // Credentials (stored in Secret Manager)
  credentialsSecretId: string;
  
  // Settings
  settings: {
    captureMethod?: 'automatic' | 'manual';
    statementDescriptor?: string;
    
    // 3D Secure
    require3DSecure?: boolean;
    
    // Webhooks
    webhookUrl?: string;
  };
  
  // Status
  isDefault: boolean;
  enabled: boolean;
}

/**
 * Shipping Configuration
 */
export interface ShippingConfig {
  // Shipping methods
  methods: ShippingMethod[];
  
  // Zones
  zones: ShippingZone[];
  
  // Settings
  settings: {
    showShippingRates: boolean;
    requireShippingAddress: boolean;
    
    // Dimensional weight
    useDimensionalWeight: boolean;
    weightUnit: 'lb' | 'kg' | 'oz' | 'g';
    dimensionUnit: 'in' | 'cm';
    
    // Packaging
    defaultPackageWeight?: number;
    defaultPackageSize?: {
      length: number;
      width: number;
      height: number;
    };
  };
  
  // Free shipping
  freeShipping?: {
    enabled: boolean;
    minOrderAmount?: number;
    countries?: string[];
    promoCode?: string;
  };
  
  // Fulfillment integration
  fulfillmentProvider?: {
    provider: 'shipstation' | 'shippo' | 'easypost' | 'custom';
    credentialsSecretId: string;
    autoCreateShipments: boolean;
  };
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  
  // Calculation
  rateType: 'flat' | 'calculated' | 'free' | 'pickup';
  flatRate?: number;
  
  // Calculated shipping (via carrier API)
  carrier?: 'usps' | 'ups' | 'fedex' | 'dhl' | 'custom';
  service?: string; // e.g., "Priority Mail", "Ground"
  
  // Delivery time
  estimatedDays?: {
    min: number;
    max: number;
  };
  
  // Restrictions
  minWeight?: number;
  maxWeight?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  
  enabled: boolean;
  order: number;
}

export interface ShippingZone {
  id: string;
  name: string;
  
  // Geographic coverage
  countries: string[];
  states?: string[]; // For specific states/provinces
  zipCodes?: string[]; // Specific zip/postal codes
  
  // Available shipping methods in this zone
  methods: string[]; // Shipping method IDs
}

/**
 * Tax Configuration
 */
export interface TaxConfig {
  enabled: boolean;
  
  // Tax calculation
  calculationType: 'manual' | 'automated';
  
  // Manual tax rates
  taxRates: TaxRate[];
  
  // Automated tax (TaxJar, Avalara, etc.)
  automatedProvider?: {
    provider: 'taxjar' | 'avalara' | 'stripe_tax';
    credentialsSecretId: string;
  };
  
  // Settings
  settings: {
    pricesIncludeTax: boolean;
    displayTaxSeparately: boolean;
    
    // Nexus (where you collect tax)
    taxNexus: TaxNexus[];
    
    // Product tax categories
    useProductTaxCategories: boolean;
  };
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number; // Percentage (e.g., 8.5 for 8.5%)
  
  // Geographic scope
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  
  // Applicability
  applyToShipping: boolean;
  compound: boolean; // Tax on tax
  
  priority: number;
  enabled: boolean;
}

export interface TaxNexus {
  country: string;
  state?: string;
  taxId?: string; // Business tax ID for this location
}

/**
 * Inventory Configuration
 */
export interface InventoryConfig {
  // Tracking
  trackInventory: boolean;
  inventoryField: string; // Field key for stock quantity
  
  // Low stock
  lowStockThreshold: number;
  notifyOnLowStock: boolean;
  lowStockEmail?: string;
  
  // Out of stock
  allowBackorders: boolean;
  hideOutOfStock: boolean;
  outOfStockMessage: string;
  
  // Reservations
  reserveInventoryMinutes: number; // Hold inventory during checkout
  
  // Multi-location (advanced)
  multiLocation?: {
    enabled: boolean;
    locations: InventoryLocation[];
    fulfillmentStrategy: 'nearest' | 'lowest_cost' | 'fastest' | 'manual';
  };
}

export interface InventoryLocation {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
  canFulfill: boolean;
}

/**
 * E-Commerce Notifications
 */
export interface EcommerceNotifications {
  // Customer notifications
  customer: {
    orderConfirmation: EmailTemplate;
    orderShipped: EmailTemplate;
    orderDelivered: EmailTemplate;
    orderCancelled: EmailTemplate;
    refundProcessed: EmailTemplate;
    cartAbandonment?: EmailTemplate;
  };
  
  // Admin notifications
  admin: {
    newOrder: boolean;
    lowStock: boolean;
    failedPayment: boolean;
    emails: string[];
  };
  
  // SMS notifications
  smsEnabled: boolean;
  smsProvider?: 'twilio' | 'vonage';
}

export interface EmailTemplate {
  enabled: boolean;
  subject: string;
  body: string; // HTML template with variables
  
  // Customization
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

/**
 * Embeddable Widget
 * Shortcode for embedding storefront
 */
export interface EcommerceWidget {
  id: string;
  ecommerceConfigId: string;

  // Widget info
  name: string;
  description?: string;
  
  // Widget type
  type: WidgetType;
  
  // Configuration
  config: EcommerceWidgetConfig;
  
  // Shortcode
  shortcode: string; // e.g., [crm-store id="abc123" type="full"]
  embedCode: string; // JavaScript embed code
  
  // Iframe URL
  iframeUrl: string;
  
  // Styling
  customCSS?: string;
  
  // Permissions
  allowedDomains: string[]; // CORS whitelist
  
  // Analytics
  views: number;
  clicks: number;
  conversions: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastUsedAt?: Timestamp;
  
  status: 'active' | 'paused';
}

export type WidgetType =
  | 'full_store'        // Complete storefront
  | 'product_grid'      // Grid of products
  | 'product_card'      // Single product
  | 'cart'              // Shopping cart
  | 'checkout'          // Checkout only
  | 'category'          // Specific category
  | 'search'            // Product search
  | 'featured'          // Featured products
  | 'buy_button';       // Simple buy button

export interface EcommerceWidgetConfig {
  // Display options
  width?: string; // e.g., "100%", "800px"
  height?: string;
  maxWidth?: string;
  
  // Product selection (for grid/featured)
  productIds?: string[];
  categoryId?: string;
  filters?: EntityFilter[];
  limit?: number;
  
  // Layout
  layout?: 'grid' | 'list' | 'carousel' | 'slider';
  columns?: number;
  
  // Features
  showPrices?: boolean;
  showAddToCart?: boolean;
  showQuickView?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  
  // Behavior
  openInModal?: boolean; // Open product details in modal vs. navigate
  directCheckout?: boolean; // Skip cart, go straight to checkout
  
  // Styling
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

/**
 * Shopping Cart
 */
export interface Cart {
  id: string;
  sessionId: string;
  userId?: string; // If logged in

  // Items
  items: CartItem[];
  
  // Totals
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  
  // Discounts
  discountCodes: AppliedDiscount[];
  
  // Shipping
  shippingAddress?: Address;
  shippingMethodId?: string;
  
  // Notes
  notes?: string;
  giftMessage?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  
  // Status
  status: 'active' | 'abandoned' | 'converted' | 'expired';
  convertedOrderId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  
  // Variant
  variantId?: string;
  variantOptions?: Record<string, string>; // e.g., { "Size": "Large", "Color": "Blue" }
  
  // Pricing
  price: number;
  quantity: number;
  subtotal: number;
  
  // Images
  image?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
  addedAt: Timestamp;
}

export interface AppliedDiscount {
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  amount: number; // Actual discount amount
}

/**
 * Order
 */
export interface Order {
  id: string;
  orderNumber: string; // Human-readable order number
  userId?: string; // Firebase UID — used for order listing filter

  // Customer
  customerId?: string; // CRM entity ID
  customerEmail: string;
  customer: CustomerInfo;
  
  // Items
  items: OrderItem[];
  
  // Addresses
  billingAddress: Address;
  shippingAddress: Address;
  
  // Totals
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  tip?: number;
  total: number;
  
  // Payment
  payment: OrderPayment;
  paymentIntentId?: string; // Stripe payment intent ID — used for webhook correlation
  
  // Shipping Info
  shippingInfo: OrderShipping;
  
  // Status
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  
  // Notes
  customerNotes?: string;
  internalNotes?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  
  // Source
  source: 'web' | 'mobile' | 'pos' | 'api' | 'admin';

  // Attribution tracking
  dealId?: string;
  leadId?: string;
  formId?: string;
  attributionSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // Tags
  tags?: string[];
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  
  // Variant
  variantId?: string;
  variantOptions?: Record<string, string>;
  
  // Pricing
  price: number;
  quantity: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  
  // Fulfillment
  fulfillmentStatus: 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
  quantityFulfilled: number;
  
  // Images
  image?: string;
  
  // Refund
  refunded: boolean;
  refundAmount?: number;
}

export interface OrderPayment {
  method: PaymentMethodType;
  provider: string;
  
  // Transaction
  transactionId?: string;
  status: PaymentStatus;
  
  // Card details (last 4 digits only)
  cardLast4?: string;
  cardBrand?: string;
  
  // Processing
  processedAt?: Timestamp;
  capturedAt?: Timestamp;
  refundedAt?: Timestamp;
  
  // Amounts
  amountCharged: number;
  amountRefunded: number;
  
  // Fees
  processingFee?: number;
}

export interface OrderShipping {
  method: string;
  methodId: string;
  carrier?: string;
  service?: string;
  
  // Cost
  cost: number;
  
  // Tracking
  trackingNumber?: string;
  trackingUrl?: string;
  
  // Dates
  estimatedDelivery?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
}

export type OrderStatus =
  | 'pending'        // Order created, awaiting payment
  | 'processing'     // Payment received, preparing order
  | 'on_hold'        // Awaiting action (payment failed, stock issue)
  | 'completed'      // Order fulfilled and closed
  | 'cancelled'      // Order cancelled
  | 'refunded';      // Order refunded

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'on_hold'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled';

/**
 * Discount/Promo Code
 */
export interface DiscountCode {
  id: string;

  // Code
  code: string; // e.g., "SUMMER20"
  
  // Type
  type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value: number; // Percentage or fixed amount
  
  // Applies to
  appliesTo: 'entire_order' | 'specific_products' | 'specific_categories';
  productIds?: string[];
  categoryIds?: string[];
  
  // Restrictions
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number; // Total uses
  usageLimitPerCustomer?: number;
  
  // Date range
  startsAt?: Timestamp;
  expiresAt?: Timestamp;
  
  // Usage
  usageCount: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  status: 'active' | 'scheduled' | 'expired' | 'disabled';
}

/**
 * Product Review
 */
export interface ProductReview {
  id: string;
  productId: string;

  // Reviewer
  customerId?: string;
  customerName: string;
  customerEmail: string;
  
  // Review
  rating: number; // 1-5
  title?: string;
  review: string;
  
  // Images
  images?: string[];
  
  // Verification
  verified: boolean; // Verified purchase
  
  // Moderation
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  moderatedBy?: string;
  moderatedAt?: Timestamp;
  
  // Response
  response?: {
    text: string;
    respondedBy: string;
    respondedAt: Timestamp;
  };
  
  // Helpful votes
  helpfulCount: number;
  unhelpfulCount: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


