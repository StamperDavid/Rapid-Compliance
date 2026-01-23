/**
 * Function Calling System
 * Allows AI agent to call integration functions
 */

import { INTEGRATION_PROVIDERS, type FunctionCallRequest, type FunctionCallResponse, type ConnectedIntegration } from '@/types/integrations';

// Import integration executors
import { executeStripeFunction } from './payment/stripe';
import { executeCalendlyFunction } from './scheduling/calendly';
import { executeShopifyFunction } from './ecommerce/shopify';
import { executeSalesforceFunction } from './crm/salesforce';
import { executeHubSpotFunction } from './crm/hubspot';
import { executeGmailFunction } from './email/gmail';
import { executeOutlookFunction } from './email/outlook';
import { executeSlackFunction } from './messaging/slack';
import { executeTeamsFunction } from './messaging/teams';
import { executeQuickBooksFunction } from './accounting/quickbooks';
import { executeXeroFunction } from './accounting/xero';
import { executePayPalFunction } from './payment/paypal';
import { executeSquareFunction } from './payment/square';
import { executeZoomFunction } from './video/zoom';
import { logger } from '@/lib/logger/logger';

/**
 * Type guard to safely pass unknown parameters to integration functions
 * Each integration validates its own parameters internally
 */
function toIntegrationParams<T extends Record<string, unknown>>(params: Record<string, unknown>): T {
  return params as T;
}

/**
 * Execute a function call from the AI agent
 */
export async function executeFunctionCall(
  request: FunctionCallRequest
): Promise<FunctionCallResponse> {
  const startTime = Date.now();
  
  logger.info('Function Calling Executing request.functionName} for org request.organizationId}', { file: 'function-calling.ts' });
  
  try {
    // Get the integration
    const integration = await getConnectedIntegration(
      request.organizationId,
      request.integrationId
    );
    
    if (!integration) {
      return {
        success: false,
        error: `Integration ${request.integrationId} not found or not connected`,
        humanReadableResult: 'Sorry, that integration is not set up. Please connect it first.',
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
    
    // Route to the appropriate executor
    let result: unknown;
    
    switch (integration.providerId) {
      case 'stripe':
        result = await executeStripeFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'calendly':
        result = await executeCalendlyFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'shopify':
        result = await executeShopifyFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'salesforce':
        result = await executeSalesforceFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'hubspot':
        result = await executeHubSpotFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'gmail':
      case 'google':
        result = await executeGmailFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'outlook':
      case 'microsoft':
        result = await executeOutlookFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'slack':
        result = await executeSlackFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'teams':
        result = await executeTeamsFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'quickbooks':
        result = await executeQuickBooksFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'xero':
        result = await executeXeroFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'paypal':
        result = await executePayPalFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'square':
        result = await executeSquareFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      case 'zoom':
        result = await executeZoomFunction(
          request.functionName,
          request.parameters,
          integration
        );
        break;
        
      default:
        return {
          success: false,
          error: `Integration ${integration.providerId} not implemented yet`,
          humanReadableResult: 'Sorry, that integration is not available yet.',
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
    }
    
    // Log the action
    await logIntegrationAction({
      organizationId: request.organizationId,
      integrationId: request.integrationId,
      functionName: request.functionName,
      parameters: request.parameters,
      success: true,
      result,
      conversationId: request.conversationId,
      customerId: request.customerId,
      executionTime: Date.now() - startTime,
    });
    
    return {
      success: true,
      result,
      humanReadableResult: formatResultForAI(request.functionName, result),
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[Function Calling] Error:', error instanceof Error ? error : undefined, { file: 'function-calling.ts' });

    // Log the error
    await logIntegrationAction({
      organizationId: request.organizationId,
      integrationId: request.integrationId,
      functionName: request.functionName,
      parameters: request.parameters,
      success: false,
      error: errorMessage,
      conversationId: request.conversationId,
      customerId: request.customerId,
      executionTime: Date.now() - startTime,
    });

    return {
      success: false,
      error: errorMessage,
      humanReadableResult: `Sorry, I encountered an error: ${errorMessage}`,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

interface IntegrationLog {
  organizationId: string;
  integrationId: string;
  functionName: string;
  parameters: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
  conversationId?: string;
  customerId?: string;
  executionTime: number;
}

/**
 * Get a connected integration
 */
async function getConnectedIntegration(
  organizationId: string,
  integrationId: string
): Promise<ConnectedIntegration | null> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const integration = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
      integrationId
    );

    return integration as ConnectedIntegration | null;
  } catch (error) {
    logger.error('[Function Calling] Error fetching integration:', error instanceof Error ? error : undefined, { file: 'function-calling.ts' });
    return null;
  }
}

/**
 * Log an integration action
 */
async function logIntegrationAction(log: IntegrationLog): Promise<void> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${log.organizationId}/integrationLogs`,
      `log_${Date.now()}`,
      {
        ...log,
        createdAt: new Date().toISOString(),
        triggeredBy: 'agent',
      },
      false
    );
  } catch (error) {
    logger.error('[Function Calling] Error logging action:', error instanceof Error ? error : undefined, { file: 'function-calling.ts' });
  }
}

interface ResultWithUrl {
  url?: string;
}

interface ResultWithScheduledTime {
  scheduledTime?: string;
}

interface ResultWithName {
  name?: string;
}

interface ResultWithTitle {
  title?: string;
  price?: number;
  description?: string;
}

interface ResultWithId {
  id?: string;
  paymentId?: string;
  receiptUrl?: string;
  joinUrl?: string;
  approvalUrl?: string;
}

interface TimeSlot {
  time: string;
}

/**
 * Format result for AI to understand
 */
function formatResultForAI(functionName: string, result: unknown): string {
  // Stripe
  if (functionName === 'createStripeCheckout') {
    const typedResult = result as ResultWithUrl;
    return `I've created a secure checkout link for you: ${typedResult.url ?? ''}. Click here to complete your payment.`;
  }
  if (functionName === 'createStripePaymentLink') {
    const typedResult = result as ResultWithUrl;
    return `Here's your payment link: ${typedResult.url ?? ''}`;
  }

  // Calendly
  if (functionName === 'checkCalendlyAvailability') {
    const slots = Array.isArray(result) ? result.map((s: TimeSlot) => s.time).join(', ') : '';
    return `Available times: ${slots}`;
  }
  if (functionName === 'bookCalendlyAppointment') {
    const typedResult = result as ResultWithScheduledTime;
    return `Great! I've booked your appointment for ${typedResult.scheduledTime ?? ''}. You'll receive a confirmation email shortly.`;
  }
  
  // Shopify
  if (functionName === 'checkShopifyInventory') {
    const inventory = typeof result === 'number' ? result : 0;
    return inventory > 0
      ? `Yes, we have ${inventory} in stock!`
      : `Sorry, that item is currently out of stock.`;
  }
  if (functionName === 'addToShopifyCart') {
    return `Added to your cart! You can checkout whenever you're ready.`;
  }
  if (functionName === 'getShopifyProduct') {
    const typedResult = result as ResultWithTitle;
    return `${typedResult.title ?? 'Product'} - $${typedResult.price ?? 0}. ${typedResult.description ?? ''}`;
  }

  // Salesforce/HubSpot
  if (functionName === 'createSalesforceLead' || functionName === 'createHubSpotContact') {
    return `I've saved your information. Our sales team will reach out to you shortly!`;
  }

  // Gmail
  if (functionName === 'sendEmail') {
    const typedResult = result as ResultWithId;
    return `Email sent successfully to ${typedResult.id ? 'recipient' : 'the contact'}!`;
  }
  if (functionName === 'searchEmails') {
    return `Found ${Array.isArray(result) ? result.length : 0} emails matching your search.`;
  }
  if (functionName === 'getEmail') {
    return `Retrieved email successfully.`;
  }

  // Outlook
  if (functionName === 'getCalendar') {
    return `Found ${Array.isArray(result) ? result.length : 0} calendar events.`;
  }
  if (functionName === 'createCalendarEvent') {
    return `Calendar event created successfully!`;
  }

  // Slack
  if (functionName === 'sendMessage') {
    return `Message sent to Slack channel successfully!`;
  }
  if (functionName === 'createChannel') {
    const typedResult = result as ResultWithName;
    const channelName = (typedResult.name !== '' && typedResult.name != null) ? typedResult.name : 'new channel';
    return `Slack channel "${channelName}" created successfully!`;
  }
  if (functionName === 'listChannels') {
    return `Found ${Array.isArray(result) ? result.length : 0} Slack channels.`;
  }

  // Teams
  if (functionName === 'listTeams') {
    return `Found ${Array.isArray(result) ? result.length : 0} teams.`;
  }

  // QuickBooks
  if (functionName === 'createInvoice') {
    return `Invoice created successfully in QuickBooks!`;
  }
  if (functionName === 'createCustomer') {
    return `Customer created successfully in QuickBooks!`;
  }
  if (functionName === 'getCustomer') {
    return `Found ${Array.isArray(result) ? result.length : 0} customers in QuickBooks.`;
  }

  // Xero
  if (functionName === 'listInvoices') {
    return `Found ${Array.isArray(result) ? result.length : 0} invoices in Xero.`;
  }

  // PayPal
  if (functionName === 'createPayment') {
    const typedResult = result as ResultWithId;
    const approvalUrl = (typedResult.approvalUrl !== '' && typedResult.approvalUrl != null) ? typedResult.approvalUrl : 'Payment initiated';
    return `Payment link created: ${approvalUrl}`;
  }
  if (functionName === 'getTransaction') {
    const typedResult = result as ResultWithId;
    const transactionId = (typedResult.id !== '' && typedResult.id != null) ? typedResult.id : 'ID';
    return `Retrieved transaction details for order ${transactionId}.`;
  }

  // Square
  if (functionName === 'processPayment') {
    const typedResult = result as ResultWithId;
    const receiptUrl = (typedResult.receiptUrl !== '' && typedResult.receiptUrl != null) ? typedResult.receiptUrl : `Payment ID: ${typedResult.paymentId ?? ''}`;
    return `Payment processed successfully! Receipt: ${receiptUrl}`;
  }
  if (functionName === 'createCustomer') {
    return `Customer created successfully in Square!`;
  }

  // Zoom
  if (functionName === 'createMeeting') {
    const typedResult = result as ResultWithId;
    return `Zoom meeting created! Join URL: ${typedResult.joinUrl ?? ''}`;
  }
  if (functionName === 'getRecordings') {
    return `Found ${Array.isArray(result) ? result.length : 0} Zoom recordings.`;
  }
  if (functionName === 'cancelMeeting') {
    return `Zoom meeting cancelled successfully.`;
  }

  // Default
  return `Done! ${JSON.stringify(result)}`;
}

interface AIFunctionParameter {
  type: string;
  description: string;
}

interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, AIFunctionParameter>;
    required: string[];
  };
}

/**
 * Get available functions for AI agent
 * These are passed to the AI model so it knows what it can call
 */
export async function getAvailableFunctions(organizationId: string): Promise<AIFunction[]> {
  const functions: AIFunction[] = [];

  try {
    // Get connected integrations for this org
    const { listConnectedIntegrations } = await import('./integration-manager');
    const connectedIntegrations = await listConnectedIntegrations(organizationId);

    // Only return functions for connected integrations (credentials exist = active)
    const activeProviderIds = connectedIntegrations
      .map(i => i.integrationId);

    for (const provider of Object.values(INTEGRATION_PROVIDERS)) {
      // Skip if not connected
      if (!activeProviderIds.includes(provider.id)) {
        continue;
      }

      for (const capability of provider.capabilities) {
        functions.push({
          name: capability.functionName,
          description: capability.description,
          parameters: {
            type: 'object',
            properties: capability.parameters.reduce((acc, param) => {
              acc[param.name] = {
                type: param.type,
                description: param.description,
              };
              return acc;
            }, {} as Record<string, AIFunctionParameter>),
            required: capability.parameters
              .filter(p => p.required)
              .map(p => p.name),
          },
        });
      }
    }

    logger.info(`Function Calling ${functions.length} functions available for org ${organizationId}`, { file: 'function-calling.ts' });
    return functions;
  } catch (error) {
    logger.error('[Function Calling] Error getting functions:', error instanceof Error ? error : undefined, { file: 'function-calling.ts' });
    // Fallback: return empty array
    return [];
  }
}




