/**
 * Proposal & Document Generation System
 * - Generate PDF proposals/quotes
 * - Dynamic pricing tables
 * - E-signature integration
 * - Template management
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface ProposalTemplate {
  id: string;
  name: string;
  type: 'proposal' | 'quote' | 'contract' | 'invoice';
  sections: ProposalSection[];
  variables: TemplateVariable[]; // Placeholders like {{customer_name}}
  styling: {
    primaryColor?: string;
    logo?: string;
    fontFamily?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface ProposalSection {
  id: string;
  type: 'header' | 'text' | 'pricing_table' | 'terms' | 'signature' | 'image';
  content: string;
  order: number;
  editable: boolean;
}

export interface TemplateVariable {
  key: string; // "customer_name"
  label: string; // "Customer Name"
  type: 'text' | 'number' | 'date' | 'currency';
  required: boolean;
  defaultValue?: string | number | Date;
}

export interface ProposalData {
  templateId: string;
  dealId?: string;
  contactId?: string;
  variables: Record<string, string | number | Date>;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  validUntil?: Date;
  notes?: string;
}

export interface GeneratedProposal {
  id: string;
  templateId: string;
  dealId?: string;
  contactId?: string;
  title: string;
  htmlContent: string;
  pdfUrl?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
  totalAmount: number;
  validUntil?: Date;
  sentAt?: Date;
  viewedAt?: Date;
  signedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Generate proposal from template
 */
export async function generateProposal(
  workspaceId: string,
  data: ProposalData
): Promise<GeneratedProposal> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    // Get template
    const template = await FirestoreService.get<ProposalTemplate>(
      `organizations/${PLATFORM_ID}/proposalTemplates`,
      data.templateId
    );

    if (!template) {
      throw new Error('Proposal template not found');
    }

    // Calculate totals
    const subtotal = data.lineItems.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const discount = item.discount ?? 0;
      return sum + (itemTotal - discount);
    }, 0);

    const totalAmount = subtotal;

    // Build HTML content
    const htmlContent = buildProposalHTML(template, data, totalAmount);

    // Generate PDF (using a PDF generation service)
    let pdfUrl: string | undefined;
    try {
      pdfUrl = await generatePDF(htmlContent);
    } catch (pdfError) {
      logger.warn('PDF generation failed, continuing without PDF', { error: pdfError instanceof Error ? pdfError.message : String(pdfError) });
    }

    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const proposal: GeneratedProposal = {
      id: proposalId,
      templateId: data.templateId,
      dealId: data.dealId,
      contactId: data.contactId,
      title: replaceVariables(template.name, data.variables),
      htmlContent,
      pdfUrl,
      status: 'draft',
      totalAmount,
      validUntil: data.validUntil,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/proposals`,
      proposalId,
      proposal,
      false
    );

    logger.info('Proposal generated', {
      proposalId,
      totalAmount,
    });

    return proposal;

  } catch (error) {
    logger.error('Proposal generation failed', error instanceof Error ? error : new Error(String(error)), { file: 'proposal-generator.ts' });
    throw error;
  }
}

/**
 * Build HTML from template
 */
function buildProposalHTML(
  template: ProposalTemplate,
  data: ProposalData,
  totalAmount: number
): string {
  const sections = template.sections
    .sort((a, b) => a.order - b.order)
    .map(section => {
      if (section.type === 'pricing_table') {
        return buildPricingTable(data.lineItems, totalAmount);
      } else if (section.type === 'header') {
        return `<div class="header">${replaceVariables(section.content, data.variables)}</div>`;
      } else if (section.type === 'text') {
        return `<div class="text-section">${replaceVariables(section.content, data.variables)}</div>`;
      } else if (section.type === 'signature') {
        return buildSignatureSection();
      }
      return '';
    })
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: ${(template.styling.fontFamily !== '' && template.styling.fontFamily != null) ? template.styling.fontFamily : 'Arial, sans-serif'};
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid ${(template.styling.primaryColor !== '' && template.styling.primaryColor != null) ? template.styling.primaryColor : '#0066cc'};
      padding-bottom: 20px;
    }
    .text-section {
      margin: 20px 0;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: ${(template.styling.primaryColor !== '' && template.styling.primaryColor != null) ? template.styling.primaryColor : '#0066cc'};
      color: white;
      font-weight: bold;
    }
    .total-row {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .signature-section {
      margin-top: 60px;
      border-top: 2px solid #ccc;
      padding-top: 30px;
    }
  </style>
</head>
<body>
  ${sections}
</body>
</html>
  `.trim();
}

/**
 * Build pricing table HTML
 */
function buildPricingTable(lineItems: ProposalData['lineItems'], totalAmount: number): string {
  const rows = lineItems.map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    const discount = item.discount ?? 0;
    const finalPrice = itemTotal - discount;

    return `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>$${item.unitPrice.toFixed(2)}</td>
        <td>${discount > 0 ? `-$${discount.toFixed(2)}` : '-'}</td>
        <td>$${finalPrice.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Discount</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="4">Total</td>
          <td>$${totalAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Build signature section
 */
function buildSignatureSection(): string {
  return `
    <div class="signature-section">
      <h3>Acceptance</h3>
      <p>By signing below, you agree to the terms and pricing outlined in this proposal.</p>
      <div style="margin-top: 40px;">
        <div style="display: inline-block; width: 45%;">
          <div style="border-top: 2px solid #333; padding-top: 5px;">Signature</div>
        </div>
        <div style="display: inline-block; width: 45%; margin-left: 10%;">
          <div style="border-top: 2px solid #333; padding-top: 5px;">Date</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Replace variables in content
 */
function replaceVariables(content: string, variables: Record<string, string | number | Date>): string {
  let result = content;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return result;
}

/**
 * Generate PDF from HTML using Playwright (uploads to Firebase Storage)
 *
 * Converts HTML content to PDF using Playwright's Chromium browser.
 * Falls back to HTML upload if PDF generation fails.
 *
 * @param htmlContent - The HTML content to convert to PDF
 * @returns Public download URL for the PDF or fallback HTML
 */
async function generatePDF(htmlContent: string): Promise<string> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true,
        displayHeaderFooter: false,
      });

      // Upload to Firebase Storage as actual PDF
      const { admin } = await import('@/lib/firebase-admin');
      const bucket = admin.storage().bucket();
      const pdfId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const filePath = `proposals/${PLATFORM_ID}/${pdfId}.pdf`;
      const file = bucket.file(filePath);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            generatedAt: new Date().toISOString(),
          },
        },
      });

      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      logger.info('PDF generated and uploaded to storage', {
        filePath,
        sizeBytes: pdfBuffer.length,
      });

      return publicUrl;
    } finally {
      await browser.close();
    }
  } catch (error) {
    logger.error('PDF generation failed', error instanceof Error ? error : new Error(String(error)));
    // Fallback: upload HTML and return URL (graceful degradation)
    try {
      const { admin } = await import('@/lib/firebase-admin');
      const bucket = admin.storage().bucket();
      const fallbackId = `proposal-${Date.now()}.html`;
      const filePath = `proposals/${PLATFORM_ID}/${fallbackId}`;
      const file = bucket.file(filePath);
      await file.save(htmlContent, { metadata: { contentType: 'text/html' } });
      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (fallbackError) {
      logger.error('PDF fallback also failed', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
      throw new Error('PDF generation failed');
    }
  }
}

/**
 * Send proposal via email
 */
export async function sendProposal(
  proposalId: string,
  recipientEmail: string,
  message?: string
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const proposal = await FirestoreService.get<GeneratedProposal>(
      `organizations/${PLATFORM_ID}/workspaces/default/proposals`,
      proposalId
    );

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Send email with proposal
    const { sendEmail } = await import('@/lib/email/email-service');

    const subject = `Proposal: ${proposal.title}`;
    const body = `
${(message !== '' && message != null) ? message : 'Please review the attached proposal.'}

View proposal: [PROPOSAL_LINK]

${proposal.validUntil ? `This proposal is valid until ${proposal.validUntil.toLocaleDateString()}` : ''}

Best regards
    `.trim();

    await sendEmail({
      to: recipientEmail,
      subject,
      text: body,
      html: proposal.htmlContent,
      metadata: { source: 'proposal-generator' },
    });

    // Update proposal status
    await FirestoreService.update(
      `organizations/${PLATFORM_ID}/workspaces/default/proposals`,
      proposalId,
      {
        status: 'sent',
        sentAt: new Date(),
      }
    );

    logger.info('Proposal sent', { proposalId, recipientEmail });

  } catch (error) {
    logger.error('Failed to send proposal', error instanceof Error ? error : new Error(String(error)), { proposalId, file: 'proposal-generator.ts' });
    throw error;
  }
}

