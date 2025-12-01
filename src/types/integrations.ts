/**
 * Integration System Types
 * Complete type definitions for third-party integrations
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Integration Category
 */
export type IntegrationCategory =
  | 'payment'
  | 'scheduling'
  | 'calendar'
  | 'email'
  | 'ecommerce'
  | 'crm'
  | 'communication'
  | 'productivity'
  | 'analytics'
  | 'accounting'
  | 'automation'
  | 'other';

/**
 * Integration Provider
 */
export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  logo: string;
  website: string;
  
  // Capabilities
  capabilities: IntegrationCapability[];
  
  // Requirements
  requiresOAuth: boolean;
  requiresAPIKey: boolean;
  requiresWebhook: boolean;
  
  // Documentation
  docsUrl: string;
  setupInstructions: string;
  
  // Metadata
  isPopular: boolean;
  isPremium: boolean; // Requires higher plan
  isActive: boolean;
}

/**
 * Integration Capability
 * What the integration can do
 */
export interface IntegrationCapability {
  id: string;
  name: string;
  description: string;
  functionName: string; // The function name to call
  
  // Parameters
  parameters: IntegrationParameter[];
  
  // Response
  returnType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  
  // Examples
  exampleUsage: string;
}

export interface IntegrationParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
}

/**
 * Connected Integration
 * A customer's active integration
 */
export interface ConnectedIntegration {
  id: string;
  organizationId: string;
  
  // Provider
  provider: string;
  providerId?: string;
  providerName?: string;
  category?: IntegrationCategory;
  
  // Authentication
  authType?: 'oauth' | 'api_key' | 'webhook' | 'custom';
  
  // OAuth
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Timestamp | string;
  
  // API Key
  apiKey?: string;
  apiSecret?: string;
  
  // Webhook
  webhookUrl?: string;
  webhookSecret?: string;
  
  // Configuration
  config?: Record<string, any>;
  settings?: Record<string, any>;
  
  // Status
  status: 'active' | 'error' | 'disconnected';
  lastSyncAt?: Timestamp | string;
  lastError?: string;
  
  // Usage
  usageCount?: number;
  lastUsedAt?: Timestamp | string;
  
  // Metadata
  connectedAt: Timestamp | string;
  connectedBy?: string;
  
  // Common optional fields
  name?: string;
  description?: string;
  icon?: string;
  email?: string;
}

// Gmail Integration
export interface GmailIntegration extends ConnectedIntegration {
  provider: 'gmail';
  email: string;
  settings: {
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
    syncFolders?: string[];
    autoCreateContacts?: boolean;
    trackOpens?: boolean;
    trackClicks?: boolean;
  };
}

// Google Calendar Integration
export interface GoogleCalendarIntegration extends ConnectedIntegration {
  provider: 'google-calendar';
  email: string;
  calendarId?: string;
  settings: {
    defaultCalendar?: string;
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
    autoCreateEvents?: boolean;
    reminderMinutes?: number;
    reminderSettings?: {
      defaultReminderMinutes?: number;
      emailReminders?: boolean;
      popupReminders?: boolean;
    };
  };
}

// Slack Integration
export interface SlackIntegration extends ConnectedIntegration {
  provider: 'slack';
  teamName?: string;
  settings: {
    workspaceName?: string;
    defaultChannel?: string;
    notifyOnNewLeads?: boolean;
    notifyOnDeals?: boolean;
    notifications?: {
      newDeal?: boolean;
      dealWon?: boolean;
      dealLost?: boolean;
      newLead?: boolean;
      taskAssigned?: boolean;
      taskDue?: boolean;
    };
    channels?: {
      deals?: string;
      leads?: string;
      tasks?: string;
      general?: string;
    };
  };
}

// Microsoft Teams Integration
export interface TeamsIntegration extends ConnectedIntegration {
  provider: 'teams';
  teamName?: string;
  settings: {
    tenantId?: string;
    defaultTeam?: string;
    notifyOnNewLeads?: boolean;
    syncMeetings?: boolean;
    notifications?: {
      newDeal?: boolean;
      dealWon?: boolean;
      dealLost?: boolean;
      newLead?: boolean;
      taskDue?: boolean;
    };
    channels?: {
      deals?: string;
      leads?: string;
      tasks?: string;
      general?: string;
    };
  };
}

// Outlook Integration
export interface OutlookIntegration extends ConnectedIntegration {
  provider: 'outlook';
  email: string;
  settings: {
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
    syncFolders?: string[];
    autoCreateContacts?: boolean;
    trackOpens?: boolean;
    trackClicks?: boolean;
  };
}

// Outlook Calendar Integration
export interface OutlookCalendarIntegration extends ConnectedIntegration {
  provider: 'outlook-calendar';
  email: string;
  calendarId?: string;
  settings: {
    defaultCalendar?: string;
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
    syncCalendars?: string[];
    autoCreateEvents?: boolean;
    reminderSettings?: {
      defaultReminderMinutes?: number;
      emailReminders?: boolean;
      popupReminders?: boolean;
    };
  };
}

// Stripe Integration
export interface StripeIntegration extends ConnectedIntegration {
  provider: 'stripe';
  apiKey?: string;
  accountId?: string;
  settings: {
    accountId?: string;
    liveMode?: boolean;
    autoSyncPayments?: boolean;
    webhookSecret?: string;
    autoCreateCustomers?: boolean;
    autoCreateInvoices?: boolean;
  };
}

// PayPal Integration
export interface PayPalIntegration extends ConnectedIntegration {
  provider: 'paypal';
  clientId?: string;
  clientSecret?: string;
  mode?: 'sandbox' | 'live';
  settings: {
    merchantId?: string;
    mode?: 'sandbox' | 'live';
    autoSyncTransactions?: boolean;
    autoCreateCustomers?: boolean;
    autoCreateInvoices?: boolean;
  };
}

// QuickBooks Integration
export interface QuickBooksIntegration extends ConnectedIntegration {
  provider: 'quickbooks';
  realmId?: string;
  companyName?: string;
  settings: {
    companyId?: string;
    realmId?: string;
    autoSyncInvoices?: boolean;
    autoSyncPayments?: boolean;
  };
  syncSettings?: {
    syncCustomers?: boolean;
    syncInvoices?: boolean;
    syncPayments?: boolean;
    syncExpenses?: boolean;
    syncItems?: boolean;
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
  };
}

// Xero Integration
export interface XeroIntegration extends ConnectedIntegration {
  provider: 'xero';
  organizationName?: string;
  settings: {
    tenantId?: string;
    organizationName?: string;
    autoSyncInvoices?: boolean;
    autoSyncContacts?: boolean;
  };
  syncSettings?: {
    syncCustomers?: boolean;
    syncInvoices?: boolean;
    syncPayments?: boolean;
    syncContacts?: boolean;
    syncItems?: boolean;
    syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
  };
}

// Zapier Integration
export interface ZapierIntegration extends ConnectedIntegration {
  provider: 'zapier';
  webhookUrl?: string;
  settings: {
    apiKey?: string;
    activeZaps?: number;
    webhookUrl?: string;
    enabledZaps?: any[];
    webhookSecurity?: {
      enabled?: boolean;
      secret?: string;
      ipWhitelist?: string[];
      requiresAuth?: boolean;
    };
  };
}

/**
 * Function Call Request
 * When AI agent wants to call an integration function
 */
export interface FunctionCallRequest {
  // Context
  organizationId: string;
  conversationId: string;
  customerId: string;
  
  // Function
  integrationId: string;
  functionName: string;
  parameters: Record<string, any>;
  
  // AI Context
  conversationContext: string;
  userMessage: string;
  
  // Metadata
  timestamp: string;
}

/**
 * Function Call Response
 */
export interface FunctionCallResponse {
  success: boolean;
  result?: any;
  error?: string;
  
  // For AI to understand
  humanReadableResult: string;
  
  // Metadata
  executionTime: number;
  timestamp: string;
}

/**
 * Integration Action Log
 * Track all actions taken through integrations
 */
export interface IntegrationActionLog {
  id: string;
  organizationId: string;
  integrationId: string;
  
  // Action
  functionName: string;
  parameters: Record<string, any>;
  
  // Result
  success: boolean;
  result?: any;
  error?: string;
  
  // Context
  conversationId?: string;
  customerId?: string;
  triggeredBy: 'agent' | 'user' | 'automation';
  
  // Metadata
  executionTime: number;
  createdAt: Timestamp | string;
}

/**
 * Available Integrations by Category
 */
export const INTEGRATION_PROVIDERS: Record<string, IntegrationProvider> = {
  // Payment Processing
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept payments, create checkout sessions, manage subscriptions',
    category: 'payment',
    logo: '/integrations/stripe.svg',
    website: 'https://stripe.com',
    capabilities: [
      {
        id: 'create_checkout',
        name: 'Create Checkout Session',
        description: 'Create a Stripe checkout session for payment',
        functionName: 'createStripeCheckout',
        parameters: [
          { name: 'amount', type: 'number', required: true, description: 'Amount in cents' },
          { name: 'currency', type: 'string', required: false, description: 'Currency code', default: 'usd' },
          { name: 'description', type: 'string', required: true, description: 'Payment description' },
          { name: 'customerEmail', type: 'string', required: false, description: 'Customer email' },
        ],
        returnType: 'object',
        exampleUsage: 'Customer wants to purchase Pro plan for $149',
      },
      {
        id: 'create_payment_link',
        name: 'Create Payment Link',
        description: 'Generate a payment link for a specific amount',
        functionName: 'createStripePaymentLink',
        parameters: [
          { name: 'amount', type: 'number', required: true, description: 'Amount in cents' },
          { name: 'description', type: 'string', required: true, description: 'What they are paying for' },
        ],
        returnType: 'string',
        exampleUsage: 'Customer wants to pay for a service',
      },
    ],
    requiresOAuth: false,
    requiresAPIKey: true,
    requiresWebhook: false,
    docsUrl: 'https://stripe.com/docs',
    setupInstructions: 'Get your API keys from the Stripe Dashboard',
    isPopular: true,
    isPremium: false,
    isActive: true,
  },
  
  // Scheduling
  calendly: {
    id: 'calendly',
    name: 'Calendly',
    description: 'Schedule appointments and check availability',
    category: 'scheduling',
    logo: '/integrations/calendly.svg',
    website: 'https://calendly.com',
    capabilities: [
      {
        id: 'check_availability',
        name: 'Check Availability',
        description: 'Check available time slots',
        functionName: 'checkCalendlyAvailability',
        parameters: [
          { name: 'date', type: 'string', required: true, description: 'Date to check (YYYY-MM-DD)' },
          { name: 'eventType', type: 'string', required: false, description: 'Type of event' },
        ],
        returnType: 'array',
        exampleUsage: 'Customer asks "What times are available this week?"',
      },
      {
        id: 'book_appointment',
        name: 'Book Appointment',
        description: 'Schedule an appointment',
        functionName: 'bookCalendlyAppointment',
        parameters: [
          { name: 'datetime', type: 'string', required: true, description: 'Date and time (ISO 8601)' },
          { name: 'name', type: 'string', required: true, description: 'Customer name' },
          { name: 'email', type: 'string', required: true, description: 'Customer email' },
          { name: 'notes', type: 'string', required: false, description: 'Additional notes' },
        ],
        returnType: 'object',
        exampleUsage: 'Customer says "Book me for Tuesday at 2pm"',
      },
    ],
    requiresOAuth: true,
    requiresAPIKey: false,
    requiresWebhook: false,
    docsUrl: 'https://developer.calendly.com',
    setupInstructions: 'Connect your Calendly account via OAuth',
    isPopular: true,
    isPremium: false,
    isActive: true,
  },
  
  // E-Commerce
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    description: 'Check inventory, add to cart, create orders',
    category: 'ecommerce',
    logo: '/integrations/shopify.svg',
    website: 'https://shopify.com',
    capabilities: [
      {
        id: 'check_inventory',
        name: 'Check Inventory',
        description: 'Check product stock levels',
        functionName: 'checkShopifyInventory',
        parameters: [
          { name: 'productId', type: 'string', required: true, description: 'Product ID or SKU' },
        ],
        returnType: 'number',
        exampleUsage: 'Customer asks "Is the blue shirt in stock?"',
      },
      {
        id: 'add_to_cart',
        name: 'Add to Cart',
        description: 'Add product to shopping cart',
        functionName: 'addToShopifyCart',
        parameters: [
          { name: 'productId', type: 'string', required: true, description: 'Product ID' },
          { name: 'quantity', type: 'number', required: true, description: 'Quantity' },
          { name: 'variantId', type: 'string', required: false, description: 'Product variant' },
        ],
        returnType: 'object',
        exampleUsage: 'Customer says "Add 2 to my cart"',
      },
      {
        id: 'get_product_details',
        name: 'Get Product Details',
        description: 'Get detailed product information',
        functionName: 'getShopifyProduct',
        parameters: [
          { name: 'productId', type: 'string', required: true, description: 'Product ID or handle' },
        ],
        returnType: 'object',
        exampleUsage: 'Customer asks about product specifications',
      },
    ],
    requiresOAuth: true,
    requiresAPIKey: false,
    requiresWebhook: false,
    docsUrl: 'https://shopify.dev/docs',
    setupInstructions: 'Install our Shopify app from the App Store',
    isPopular: true,
    isPremium: false,
    isActive: true,
  },
  
  // CRM
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Create leads, update contacts, manage opportunities',
    category: 'crm',
    logo: '/integrations/salesforce.svg',
    website: 'https://salesforce.com',
    capabilities: [
      {
        id: 'create_lead',
        name: 'Create Lead',
        description: 'Create a new lead in Salesforce',
        functionName: 'createSalesforceLead',
        parameters: [
          { name: 'firstName', type: 'string', required: true, description: 'First name' },
          { name: 'lastName', type: 'string', required: true, description: 'Last name' },
          { name: 'email', type: 'string', required: true, description: 'Email address' },
          { name: 'company', type: 'string', required: true, description: 'Company name' },
          { name: 'phone', type: 'string', required: false, description: 'Phone number' },
          { name: 'notes', type: 'string', required: false, description: 'Conversation notes' },
        ],
        returnType: 'object',
        exampleUsage: 'After qualifying a prospect, create them as a lead',
      },
    ],
    requiresOAuth: true,
    requiresAPIKey: false,
    requiresWebhook: false,
    docsUrl: 'https://developer.salesforce.com',
    setupInstructions: 'Connect via OAuth',
    isPopular: true,
    isPremium: false,
    isActive: true,
  },
  
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Manage contacts, deals, and workflows',
    category: 'crm',
    logo: '/integrations/hubspot.svg',
    website: 'https://hubspot.com',
    capabilities: [
      {
        id: 'create_contact',
        name: 'Create Contact',
        description: 'Create a new contact in HubSpot',
        functionName: 'createHubSpotContact',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'Email address' },
          { name: 'firstName', type: 'string', required: false, description: 'First name' },
          { name: 'lastName', type: 'string', required: false, description: 'Last name' },
          { name: 'phone', type: 'string', required: false, description: 'Phone number' },
          { name: 'company', type: 'string', required: false, description: 'Company name' },
        ],
        returnType: 'object',
        exampleUsage: 'After conversation, save contact to HubSpot',
      },
    ],
    requiresOAuth: true,
    requiresAPIKey: false,
    requiresWebhook: false,
    docsUrl: 'https://developers.hubspot.com',
    setupInstructions: 'Connect via OAuth',
    isPopular: true,
    isPremium: false,
    isActive: true,
  },
};
