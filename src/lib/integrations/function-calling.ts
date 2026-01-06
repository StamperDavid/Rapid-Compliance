/**
 * Function Calling System
 * Allows AI agent to call integration functions
 */

import type { FunctionCallRequest, FunctionCallResponse } from '@/types/integrations';
import { INTEGRATION_PROVIDERS } from '@/types/integrations';

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
    let result: any;
    
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
  } catch (error: any) {
    logger.error('[Function Calling] Error:', error, { file: 'function-calling.ts' });
    
    // Log the error
    await logIntegrationAction({
      organizationId: request.organizationId,
      integrationId: request.integrationId,
      functionName: request.functionName,
      parameters: request.parameters,
      success: false,
      error: error.message,
      conversationId: request.conversationId,
      customerId: request.customerId,
      executionTime: Date.now() - startTime,
    });
    
    return {
      success: false,
      error: error.message,
      humanReadableResult: `Sorry, I encountered an error: ${error.message}`,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get a connected integration
 */
async function getConnectedIntegration(
  organizationId: string,
  integrationId: string
): Promise<any> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    const integration = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
      integrationId
    );
    
    return integration;
  } catch (error) {
    logger.error('[Function Calling] Error fetching integration:', error, { file: 'function-calling.ts' });
    return null;
  }
}

/**
 * Log an integration action
 */
async function logIntegrationAction(log: any): Promise<void> {
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
    logger.error('[Function Calling] Error logging action:', error, { file: 'function-calling.ts' });
  }
}

/**
 * Format result for AI to understand
 */
function formatResultForAI(functionName: string, result: any): string {
  // Stripe
  if (functionName === 'createStripeCheckout') {
    return `I've created a secure checkout link for you: ${result.url}. Click here to complete your payment.`;
  }
  if (functionName === 'createStripePaymentLink') {
    return `Here's your payment link: ${result.url}`;
  }
  
  // Calendly
  if (functionName === 'checkCalendlyAvailability') {
    const slots = result.map((s: any) => s.time).join(', ');
    return `Available times: ${slots}`;
  }
  if (functionName === 'bookCalendlyAppointment') {
    return `Great! I've booked your appointment for ${result.scheduledTime}. You'll receive a confirmation email shortly.`;
  }
  
  // Shopify
  if (functionName === 'checkShopifyInventory') {
    return result > 0
      ? `Yes, we have ${result} in stock!`
      : `Sorry, that item is currently out of stock.`;
  }
  if (functionName === 'addToShopifyCart') {
    return `Added to your cart! You can checkout whenever you're ready.`;
  }
  if (functionName === 'getShopifyProduct') {
    return `${result.title} - $${result.price}. ${result.description}`;
  }
  
  // Salesforce/HubSpot
  if (functionName === 'createSalesforceLead' || functionName === 'createHubSpotContact') {
    return `I've saved your information. Our sales team will reach out to you shortly!`;
  }
  
  // Gmail
  if (functionName === 'sendEmail') {
    return `Email sent successfully to ${result.id ? 'recipient' : 'the contact'}!`;
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
    return `Slack channel "${result.name || 'new channel'}" created successfully!`;
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
    return `Payment link created: ${result.approvalUrl || 'Payment initiated'}`;
  }
  if (functionName === 'getTransaction') {
    return `Retrieved transaction details for order ${result.id || 'ID'}.`;
  }
  
  // Square
  if (functionName === 'processPayment') {
    return `Payment processed successfully! Receipt: ${result.receiptUrl || `Payment ID: ${  result.paymentId}`}`;
  }
  if (functionName === 'createCustomer') {
    return `Customer created successfully in Square!`;
  }
  
  // Zoom
  if (functionName === 'createMeeting') {
    return `Zoom meeting created! Join URL: ${result.joinUrl}`;
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

/**
 * Get available functions for AI agent
 * These are passed to the AI model so it knows what it can call
 */
export async function getAvailableFunctions(organizationId: string): Promise<any[]> {
  const functions: any[] = [];
  
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
            }, {} as Record<string, any>),
            required: capability.parameters
              .filter(p => p.required)
              .map(p => p.name),
          },
        });
      }
    }
    
    logger.info('Function Calling functions.length} functions available for org organizationId}', { file: 'function-calling.ts' });
    return functions;
  } catch (error) {
    logger.error('[Function Calling] Error getting functions:', error, { file: 'function-calling.ts' });
    // Fallback: return empty array
    return [];
  }
}




