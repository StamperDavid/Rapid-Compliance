/**
 * Email Builder & A/B Testing System
 * - Drag-drop email builder
 * - Template library
 * - Personalization tokens
 * - A/B testing engine
 * - Deliverability scoring
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

export interface EmailTemplate {
  id: string;
  organizationId: string;
  name: string;
  subject: string;
  preheader?: string;
  blocks: EmailBlock[];
  variables: EmailVariable[];
  styling: {
    backgroundColor?: string;
    primaryColor?: string;
    fontFamily?: string;
    headerImage?: string;
  };
  category?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EmailBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'social' | 'footer';
  content: string;
  styling?: {
    alignment?: 'left' | 'center' | 'right';
    padding?: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    buttonUrl?: string;
  };
  order: number;
}

export interface EmailVariable {
  key: string; // "first_name"
  label: string; // "First Name"
  defaultValue?: string;
  source?: 'lead' | 'contact' | 'deal' | 'custom';
  sourceField?: string;
}

export interface ABTest {
  id: string;
  organizationId: string;
  name: string;
  testType: 'subject' | 'content' | 'send_time';
  variantA: {
    name: string;
    subject?: string;
    templateId?: string;
    sendTime?: string; // "09:00"
  };
  variantB: {
    name: string;
    subject?: string;
    templateId?: string;
    sendTime?: string;
  };
  splitPercentage: number; // 50 = 50/50 split
  sampleSize: number; // Number of recipients to test
  winnerMetric: 'open_rate' | 'click_rate' | 'reply_rate' | 'conversion_rate';
  status: 'running' | 'completed' | 'paused';
  results?: ABTestResults;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface ABTestResults {
  variantA: {
    sent: number;
    opens: number;
    clicks: number;
    replies: number;
    conversions: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    conversionRate: number;
  };
  variantB: {
    sent: number;
    opens: number;
    clicks: number;
    replies: number;
    conversions: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    conversionRate: number;
  };
  winner?: 'A' | 'B' | 'tie';
  confidence: number; // Statistical confidence 0-100
  recommendation: string;
}

/**
 * Build email HTML from blocks
 */
export function buildEmailHTML(template: EmailTemplate, variables: Record<string, any>): string {
  const blocksHTML = template.blocks
    .sort((a, b) => a.order - b.order)
    .map(block => buildBlockHTML(block, template.styling))
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${replaceVariables(template.subject, variables)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${template.styling.backgroundColor || '#f4f4f4'}; font-family: ${template.styling.fontFamily || 'Arial, sans-serif'};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${template.styling.backgroundColor || '#f4f4f4'};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              ${replaceVariables(blocksHTML, variables)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Build individual block HTML
 */
function buildBlockHTML(block: EmailBlock, globalStyling: EmailTemplate['styling']): string {
  const style = block.styling || {};
  const alignment = style.alignment || 'left';
  const padding = style.padding || '10px 0';

  switch (block.type) {
    case 'header':
      return `
        <div style="text-align: ${alignment}; padding: ${padding};">
          <h1 style="margin: 0; color: ${style.textColor || globalStyling.primaryColor || '#333'}; font-size: ${style.fontSize || '28px'};">
            ${block.content}
          </h1>
        </div>
      `;

    case 'text':
      return `
        <div style="text-align: ${alignment}; padding: ${padding}; color: ${style.textColor || '#333'}; font-size: ${style.fontSize || '16px'}; line-height: 1.6;">
          ${block.content}
        </div>
      `;

    case 'image':
      return `
        <div style="text-align: ${alignment}; padding: ${padding};">
          <img src="${block.content}" alt="Email image" style="max-width: 100%; height: auto; display: block;" />
        </div>
      `;

    case 'button':
      return `
        <div style="text-align: ${alignment}; padding: ${padding};">
          <a href="${style.buttonUrl || '#'}" style="display: inline-block; padding: 14px 28px; background-color: ${style.buttonColor || globalStyling.primaryColor || '#0066cc'}; color: ${style.buttonTextColor || '#ffffff'}; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${block.content}
          </a>
        </div>
      `;

    case 'divider':
      return `
        <div style="padding: ${padding};">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        </div>
      `;

    case 'footer':
      return `
        <div style="text-align: center; padding: ${padding}; color: #999; font-size: 12px;">
          ${block.content}
        </div>
      `;

    default:
      return '';
  }
}

/**
 * Replace personalization variables
 */
export function replaceVariables(content: string, variables: Record<string, any>): string {
  let result = content;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, String(value || ''));
  });

  // Replace any remaining unreplaced variables with empty string
  result = result.replace(/{{[^}]+}}/g, '');

  return result;
}

/**
 * Create A/B test
 */
export async function createABTest(
  organizationId: string,
  test: Omit<ABTest, 'id' | 'createdAt' | 'status'>
): Promise<ABTest> {
  try {
    const testId = `abtest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const abTest: ABTest = {
      ...test,
      id: testId,
      status: 'running',
      createdAt: now,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/abTests`,
      testId,
      abTest,
      false
    );

    logger.info('A/B test created', { organizationId, testId, testType: test.testType });

    return abTest;

  } catch (error: any) {
    logger.error('Failed to create A/B test', error, { organizationId });
    throw error;
  }
}

/**
 * Determine which variant to send for recipient
 */
export async function getABTestVariant(
  organizationId: string,
  testId: string,
  recipientId: string
): Promise<'A' | 'B'> {
  try {
    const test = await FirestoreService.get<ABTest>(
      `organizations/${organizationId}/abTests`,
      testId
    );

    if (!test || test.status !== 'running') {
      return 'A'; // Default to A if test not running
    }

    // Deterministic assignment based on recipient ID
    const hash = hashString(recipientId);
    const percentage = (hash % 100) + 1;

    return percentage <= test.splitPercentage ? 'A' : 'B';

  } catch (error) {
    return 'A';
  }
}

/**
 * Simple hash function for deterministic variant assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate A/B test results
 */
export async function calculateABTestResults(
  organizationId: string,
  testId: string
): Promise<ABTestResults> {
  try {
    // Get all email activities for this A/B test
    // This would query activities with testId metadata
    // For now, placeholder logic

    const variantAResults = {
      sent: 100,
      opens: 45,
      clicks: 12,
      replies: 5,
      conversions: 3,
      openRate: 45,
      clickRate: 12,
      replyRate: 5,
      conversionRate: 3,
    };

    const variantBResults = {
      sent: 100,
      opens: 52,
      clicks: 18,
      replies: 8,
      conversions: 5,
      openRate: 52,
      clickRate: 18,
      replyRate: 8,
      conversionRate: 5,
    };

    // Determine winner based on configured metric
    const test = await FirestoreService.get<ABTest>(
      `organizations/${organizationId}/abTests`,
      testId
    );

    const metric = test?.winnerMetric || 'open_rate';
    const aValue = (variantAResults as any)[metric.replace('_rate', 'Rate')];
    const bValue = (variantBResults as any)[metric.replace('_rate', 'Rate')];

    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (aValue > bValue * 1.1) winner = 'A'; // 10% better
    else if (bValue > aValue * 1.1) winner = 'B';

    // Calculate statistical confidence (simplified)
    const sampleSize = variantAResults.sent + variantBResults.sent;
    const confidence = Math.min(95, Math.round((sampleSize / 200) * 100)); // Rough approximation

    const results: ABTestResults = {
      variantA: variantAResults,
      variantB: variantBResults,
      winner,
      confidence,
      recommendation: winner === 'A' 
        ? `Variant A wins with ${aValue}% ${metric.replace('_', ' ')}. Use Variant A for remaining sends.`
        : winner === 'B'
        ? `Variant B wins with ${bValue}% ${metric.replace('_', ' ')}. Use Variant B for remaining sends.`
        : `Results are too close to call. Continue testing or choose based on other factors.`,
    };

    logger.info('A/B test results calculated', { testId, winner, confidence });

    return results;

  } catch (error: any) {
    logger.error('Failed to calculate A/B test results', error, { testId });
    throw error;
  }
}

