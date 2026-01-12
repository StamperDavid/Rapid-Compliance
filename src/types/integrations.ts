/**
 * Type definitions for External Service Integrations
 * Purpose: Replace 'any' type usage in integration adapters
 */

// Google Calendar Types
export interface GoogleCalendarTimeSlot {
  start: string;
  end: string;
  available?: boolean;
}

export interface GoogleCalendarBusySlot {
  start: string;
  end: string;
}

export interface GoogleCalendarReminderSettings {
  defaultReminderMinutes: number;
}

export interface GoogleCalendarSettings {
  autoCreateEvents: boolean;
  defaultReminder?: number;
  syncCalendars?: string[];
  twoWaySync?: boolean;
  reminderSettings?: GoogleCalendarReminderSettings;
}

export interface GoogleCalendarIntegration {
  id: string;
  type: 'google-calendar';
  status: 'active' | 'inactive' | 'error';
  settings: GoogleCalendarSettings;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Microsoft Outlook Types
export interface OutlookEmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  body: string;
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface OutlookRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

export interface OutlookCalendarReminderSettings {
  defaultReminderMinutes: number;
}

export interface OutlookCalendarSettings {
  autoCreateEvents: boolean;
  syncCalendars?: string[];
  twoWaySync?: boolean;
  reminderSettings?: OutlookCalendarReminderSettings;
}

export interface OutlookCalendarIntegration {
  id: string;
  type: 'outlook-calendar';
  status: 'active' | 'inactive' | 'error';
  settings: OutlookCalendarSettings;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface OutlookEmailSettings {
  trackOpens: boolean;
  trackClicks: boolean;
  autoCreateContacts: boolean;
}

export interface OutlookIntegration {
  id: string;
  type: 'outlook-email';
  status: 'active' | 'inactive' | 'error';
  settings: OutlookEmailSettings;
  email?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Payment Integration Types
export interface PaymentIntegrationSettings {
  autoCreateCustomers: boolean;
  autoCreateInvoices: boolean;
}

export interface PayPalIntegration {
  id: string;
  type?: 'paypal';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  status: 'active' | 'inactive' | 'error';
  settings: PaymentIntegrationSettings;
  clientId?: string;
  clientSecret?: string;
  mode?: 'sandbox' | 'live';
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface StripeIntegration {
  id: string;
  type?: 'stripe';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  status: 'active' | 'inactive' | 'error';
  settings: PaymentIntegrationSettings;
  apiKey?: string;
  accountId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Accounting Integration Types
export interface XeroSyncSettings {
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncContacts?: boolean;
  syncItems?: boolean;
  syncDirection?: 'bidirectional' | 'to-crm' | 'from-crm';
}

export interface XeroIntegration {
  id: string;
  type?: 'xero';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  organizationName?: string;
  status: 'active' | 'inactive' | 'error';
  settings?: Record<string, unknown>;
  syncSettings?: XeroSyncSettings;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface AccountingSyncSettings {
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncCustomers?: boolean;
  syncItems?: boolean;
  syncDirection?: 'bidirectional' | 'to-crm' | 'from-crm';
}

export interface QuickBooksIntegration {
  id: string;
  type?: 'quickbooks';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  status: 'active' | 'inactive' | 'error';
  settings?: Record<string, unknown>;
  syncSettings?: AccountingSyncSettings;
  companyName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Communication Integration Types
export interface NotificationSettings {
  newDeal?: boolean;
  dealWon?: boolean;
  dealLost?: boolean;
  newLead?: boolean;
  taskDue?: boolean;
}

export interface SlackIntegrationSettings {
  notifications?: NotificationSettings;
  channelId?: string;
}

export interface SlackIntegration {
  id: string;
  type?: 'slack';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  status: 'active' | 'inactive' | 'error';
  settings: SlackIntegrationSettings;
  teamName?: string;
  workspaceName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TeamsIntegrationSettings {
  notifications?: NotificationSettings;
  channelId?: string;
}

export interface TeamsIntegration {
  id: string;
  type: 'teams';
  status: 'active' | 'inactive' | 'error';
  settings: TeamsIntegrationSettings;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Automation Integration Types
export interface WebhookSecuritySettings {
  enabled?: boolean;
  secret?: string;
}

export interface ZapierIntegrationSettings {
  webhookSecurity?: WebhookSecuritySettings;
  enabledZaps?: string[];
}

export interface ZapierIntegration {
  id: string;
  type?: 'zapier';
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  organizationId?: string;
  status: 'active' | 'inactive' | 'error';
  settings: ZapierIntegrationSettings;
  webhookUrl?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Shopify Types
export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  totalPrice: number;
  currency: string;
  customer: ShopifyCustomer;
  lineItems: ShopifyLineItem[];
  createdAt: string;
  status: string;
}

export interface ShopifyLineItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  quantity: number;
  price: number;
  sku?: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: number;
  sku?: string;
  inventoryQuantity: number;
}

export interface ShopifyImage {
  src: string;
  alt?: string;
}

// Calendly Types
export interface CalendlyTimeSlot {
  start: string;
  end: string;
  available: boolean;
  status?: string;
}

// LinkedIn Types
export interface LinkedInJobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  postedDate: string;
  url: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

// News API Types
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  author?: string;
  content?: string;
  imageUrl?: string;
}

// Generic Search Result Types
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

// Campaign Manager Types
export interface CampaignData {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate?: string;
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
  [key: string]: unknown;
}

// Workflow Execution Types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

// Scraper Intelligence Types
export interface ScraperSignal {
  type: string;
  content: string;
  confidence: number;
  timestamp: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

// Golden Master Product Type
export interface GoldenMasterProduct {
  id?: string;
  name: string;
  description: string;
  price: number | string;
  category?: string;
  features?: string[];
  [key: string]: unknown;
}

// User Profile Type
export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  role?: string;
  organizationId?: string;
  [key: string]: unknown;
}

// Organization Type
export interface OrganizationData {
  id: string;
  name: string;
  plan?: string;
  status?: string;
  createdAt?: number;
  industry?: string;
  size?: string;
  [key: string]: unknown;
}

// Integration Provider Types
export interface IntegrationParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface IntegrationCapability {
  id: string;
  name: string;
  functionName: string;
  description: string;
  parameters: IntegrationParameter[];
}

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'scheduling' | 'ecommerce' | 'crm' | 'communication' | 'email' | 'messaging' | 'accounting' | 'video';
  requiresOAuth: boolean;
  requiresAPIKey: boolean;
  isPopular?: boolean;
  capabilities: IntegrationCapability[];
}

export interface ConnectedIntegration {
  id: string;
  organizationId: string;
  provider: string;
  providerId: string;
  providerName: string;
  category: string;
  authType: 'oauth' | 'api_key';
  config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  usageCount: number;
  connectedAt: string;
  connectedBy: string;
  lastUsedAt?: string;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  settings?: Record<string, unknown>;
}

export interface FunctionCallRequest {
  organizationId: string;
  integrationId: string;
  functionName: string;
  parameters: Record<string, unknown>;
  conversationId?: string;
  customerId?: string;
  conversationContext?: string;
  userMessage?: string;
  timestamp?: string;
}

export interface FunctionCallResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  humanReadableResult: string;
  executionTime: number;
  timestamp: string;
}

// Integration Providers Constant
export const INTEGRATION_PROVIDERS: Record<string, IntegrationProvider> = {
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept payments and manage subscriptions',
    category: 'payment',
    requiresOAuth: true,
    requiresAPIKey: false,
    isPopular: true,
    capabilities: [
      {
        id: 'create_checkout',
        name: 'Create Checkout',
        functionName: 'createStripeCheckout',
        description: 'Create a Stripe checkout session',
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount in cents', required: true },
          { name: 'currency', type: 'string', description: 'Currency code (e.g., USD)', required: true },
          { name: 'description', type: 'string', description: 'Payment description', required: false },
        ],
      },
      {
        id: 'create_payment_link',
        name: 'Create Payment Link',
        functionName: 'createStripePaymentLink',
        description: 'Create a reusable payment link',
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount in cents', required: true },
          { name: 'productName', type: 'string', description: 'Product name', required: true },
        ],
      },
    ],
  },
  calendly: {
    id: 'calendly',
    name: 'Calendly',
    description: 'Schedule meetings and check availability',
    category: 'scheduling',
    requiresOAuth: true,
    requiresAPIKey: false,
    isPopular: true,
    capabilities: [
      {
        id: 'check_availability',
        name: 'Check Availability',
        functionName: 'checkCalendlyAvailability',
        description: 'Check available time slots',
        parameters: [
          { name: 'startDate', type: 'string', description: 'Start date (ISO format)', required: true },
          { name: 'endDate', type: 'string', description: 'End date (ISO format)', required: true },
        ],
      },
      {
        id: 'book_appointment',
        name: 'Book Appointment',
        functionName: 'bookCalendlyAppointment',
        description: 'Book a new appointment',
        parameters: [
          { name: 'eventTypeId', type: 'string', description: 'Event type ID', required: true },
          { name: 'startTime', type: 'string', description: 'Start time (ISO format)', required: true },
          { name: 'email', type: 'string', description: 'Attendee email', required: true },
          { name: 'name', type: 'string', description: 'Attendee name', required: true },
        ],
      },
    ],
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    description: 'Manage products, inventory, and orders',
    category: 'ecommerce',
    requiresOAuth: true,
    requiresAPIKey: false,
    isPopular: true,
    capabilities: [
      {
        id: 'check_inventory',
        name: 'Check Inventory',
        functionName: 'checkShopifyInventory',
        description: 'Check product inventory',
        parameters: [
          { name: 'productId', type: 'string', description: 'Product ID', required: true },
        ],
      },
      {
        id: 'get_product',
        name: 'Get Product',
        functionName: 'getShopifyProduct',
        description: 'Get product details',
        parameters: [
          { name: 'productId', type: 'string', description: 'Product ID', required: true },
        ],
      },
      {
        id: 'add_to_cart',
        name: 'Add to Cart',
        functionName: 'addToShopifyCart',
        description: 'Add item to shopping cart',
        parameters: [
          { name: 'productId', type: 'string', description: 'Product ID', required: true },
          { name: 'quantity', type: 'number', description: 'Quantity', required: true },
        ],
      },
    ],
  },
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Manage leads, contacts, and opportunities',
    category: 'crm',
    requiresOAuth: true,
    requiresAPIKey: false,
    isPopular: true,
    capabilities: [
      {
        id: 'create_lead',
        name: 'Create Lead',
        functionName: 'createSalesforceLead',
        description: 'Create a new lead',
        parameters: [
          { name: 'firstName', type: 'string', description: 'First name', required: true },
          { name: 'lastName', type: 'string', description: 'Last name', required: true },
          { name: 'email', type: 'string', description: 'Email address', required: true },
          { name: 'company', type: 'string', description: 'Company name', required: true },
        ],
      },
    ],
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM, marketing automation, and sales tools',
    category: 'crm',
    requiresOAuth: true,
    requiresAPIKey: false,
    isPopular: true,
    capabilities: [
      {
        id: 'create_contact',
        name: 'Create Contact',
        functionName: 'createHubSpotContact',
        description: 'Create a new contact',
        parameters: [
          { name: 'email', type: 'string', description: 'Email address', required: true },
          { name: 'firstName', type: 'string', description: 'First name', required: false },
          { name: 'lastName', type: 'string', description: 'Last name', required: false },
        ],
      },
    ],
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send and receive emails',
    category: 'email',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'send_email',
        name: 'Send Email',
        functionName: 'sendEmail',
        description: 'Send an email',
        parameters: [
          { name: 'to', type: 'string', description: 'Recipient email', required: true },
          { name: 'subject', type: 'string', description: 'Email subject', required: true },
          { name: 'body', type: 'string', description: 'Email body', required: true },
        ],
      },
      {
        id: 'search_emails',
        name: 'Search Emails',
        functionName: 'searchEmails',
        description: 'Search for emails',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
        ],
      },
    ],
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    description: 'Email and calendar management',
    category: 'email',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'get_calendar',
        name: 'Get Calendar',
        functionName: 'getCalendar',
        description: 'Get calendar events',
        parameters: [
          { name: 'startDate', type: 'string', description: 'Start date', required: true },
          { name: 'endDate', type: 'string', description: 'End date', required: true },
        ],
      },
      {
        id: 'create_event',
        name: 'Create Event',
        functionName: 'createCalendarEvent',
        description: 'Create a calendar event',
        parameters: [
          { name: 'subject', type: 'string', description: 'Event subject', required: true },
          { name: 'startTime', type: 'string', description: 'Start time', required: true },
          { name: 'endTime', type: 'string', description: 'End time', required: true },
        ],
      },
    ],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Team messaging and collaboration',
    category: 'messaging',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'send_message',
        name: 'Send Message',
        functionName: 'sendMessage',
        description: 'Send a message to a channel',
        parameters: [
          { name: 'channel', type: 'string', description: 'Channel ID', required: true },
          { name: 'message', type: 'string', description: 'Message text', required: true },
        ],
      },
    ],
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Team collaboration and meetings',
    category: 'messaging',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'list_teams',
        name: 'List Teams',
        functionName: 'listTeams',
        description: 'List all teams',
        parameters: [],
      },
    ],
  },
  quickbooks: {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and invoicing',
    category: 'accounting',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'create_invoice',
        name: 'Create Invoice',
        functionName: 'createInvoice',
        description: 'Create a new invoice',
        parameters: [
          { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
          { name: 'amount', type: 'number', description: 'Invoice amount', required: true },
        ],
      },
    ],
  },
  xero: {
    id: 'xero',
    name: 'Xero',
    description: 'Cloud accounting software',
    category: 'accounting',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'list_invoices',
        name: 'List Invoices',
        functionName: 'listInvoices',
        description: 'List all invoices',
        parameters: [],
      },
    ],
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal',
    description: 'Online payment processing',
    category: 'payment',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'create_payment',
        name: 'Create Payment',
        functionName: 'createPayment',
        description: 'Create a payment',
        parameters: [
          { name: 'amount', type: 'number', description: 'Payment amount', required: true },
          { name: 'currency', type: 'string', description: 'Currency code', required: true },
        ],
      },
    ],
  },
  square: {
    id: 'square',
    name: 'Square',
    description: 'Payment processing and POS',
    category: 'payment',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'process_payment',
        name: 'Process Payment',
        functionName: 'processPayment',
        description: 'Process a payment',
        parameters: [
          { name: 'amount', type: 'number', description: 'Payment amount', required: true },
          { name: 'sourceId', type: 'string', description: 'Payment source ID', required: true },
        ],
      },
    ],
  },
  zoom: {
    id: 'zoom',
    name: 'Zoom',
    description: 'Video conferencing and meetings',
    category: 'video',
    requiresOAuth: true,
    requiresAPIKey: false,
    capabilities: [
      {
        id: 'create_meeting',
        name: 'Create Meeting',
        functionName: 'createMeeting',
        description: 'Create a Zoom meeting',
        parameters: [
          { name: 'topic', type: 'string', description: 'Meeting topic', required: true },
          { name: 'startTime', type: 'string', description: 'Start time', required: true },
          { name: 'duration', type: 'number', description: 'Duration in minutes', required: true },
        ],
      },
    ],
  },
};
