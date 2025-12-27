/**
 * Webhook Trigger Handler
 * Handles incoming webhooks and triggers workflows
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Workflow, WebhookTrigger } from '@/types/workflow';
import { executeWorkflow } from '../workflow-engine';
import crypto from 'crypto';

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle webhook request
 */
export async function handleWebhook(
  webhookUrl: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  queryParams?: Record<string, string>
): Promise<void> {
  // Extract workflow ID from webhook URL
  // Format: /api/workflows/webhooks/{workflowId}
  const urlParts = webhookUrl.split('/');
  const workflowId = urlParts[urlParts.length - 1];
  
  if (!workflowId) {
    throw new Error('Invalid webhook URL');
  }
  
  // Find workflow (need to search across all organizations/workspaces)
  // In production, store webhook URL -> workflow mapping
  const { where } = await import('firebase/firestore');
  
  // Search for workflow with this webhook URL
  // This is inefficient - in production, use a webhook registry
  const allOrgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS, []);
  
  for (const org of allOrgs) {
    const workspaces = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}`,
      []
    );
    
    for (const workspace of workspaces) {
      const workflows = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}/${workspace.id}/${COLLECTIONS.WORKFLOWS}`,
        [where('status', '==', 'active')]
      );
      
      const workflow = workflows.find((w: any) => {
        const trigger = w.trigger as WebhookTrigger;
        return trigger?.type === 'webhook' && trigger?.webhookUrl === webhookUrl;
      });
      
      if (workflow) {
        // Verify signature if required
        const trigger = workflow.trigger as WebhookTrigger;
        if (trigger.secret && headers['x-webhook-signature']) {
          const isValid = verifyWebhookSignature(
            JSON.stringify(body),
            headers['x-webhook-signature'],
            trigger.secret
          );
          
          if (!isValid) {
            throw new Error('Invalid webhook signature');
          }
        }
        
        // Execute workflow
        const triggerData = {
          organizationId: org.id,
          workspaceId: workspace.id,
          method,
          headers,
          body,
          query: queryParams || {},
        };
        
        await executeWorkflow(workflow as Workflow, triggerData);
        return;
      }
    }
  }
  
  throw new Error(`Workflow not found for webhook URL: ${webhookUrl}`);
}

/**
 * Generate webhook URL for workflow
 */
export function generateWebhookUrl(workflowId: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
  return `${base}/api/workflows/webhooks/${workflowId}`;
}

/**
 * Register webhook trigger
 */
export async function registerWebhookTrigger(
  workflow: Workflow,
  organizationId: string,
  workspaceId: string
): Promise<string> {
  const trigger = workflow.trigger as WebhookTrigger;
  
  if (!trigger || trigger.type !== 'webhook') {
    throw new Error('Not a webhook trigger');
  }
  
  // Generate webhook URL if not provided
  if (!trigger.webhookUrl) {
    trigger.webhookUrl = generateWebhookUrl(workflow.id);
  }
  
  // Store webhook configuration
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/webhookTriggers`,
    workflow.id,
    {
      workflowId: workflow.id,
      webhookUrl: trigger.webhookUrl,
      secret: trigger.secret,
      organizationId,
      workspaceId,
      registeredAt: new Date().toISOString(),
    },
    false
  );
  
  return trigger.webhookUrl;
}




















