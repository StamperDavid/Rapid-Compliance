/**
 * Invoice Generator
 *
 * Generates PDF invoices from order data using Playwright,
 * uploads to Firebase Storage, and optionally emails to the customer.
 *
 * Follows the same pattern as proposal-generator.ts.
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { Order } from '@/types/ecommerce';

interface InvoiceResult {
  success: boolean;
  invoiceUrl?: string;
  invoiceNumber?: string;
  error?: string;
}

/**
 * Generate an invoice PDF for an order, upload to Firebase Storage,
 * and return the public URL.
 */
export async function generateInvoice(order: Order): Promise<InvoiceResult> {
  const invoiceNumber = `INV-${order.orderNumber ?? order.id}`;

  try {
    const html = buildInvoiceHtml(order, invoiceNumber);
    const pdfUrl = await renderAndUploadPdf(html, order.id);

    logger.info('Invoice generated', { orderId: order.id, invoiceNumber, pdfUrl });

    return { success: true, invoiceUrl: pdfUrl, invoiceNumber };
  } catch (error) {
    logger.error(
      'Invoice generation failed',
      error instanceof Error ? error : new Error(String(error)),
      { orderId: order.id }
    );
    return {
      success: false,
      invoiceNumber,
      error: error instanceof Error ? error.message : 'Invoice generation failed',
    };
  }
}

/**
 * Render HTML to PDF via Playwright and upload to Firebase Storage.
 */
async function renderAndUploadPdf(htmlContent: string, orderId: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
      displayHeaderFooter: false,
    });

    const { admin } = await import('@/lib/firebase-admin');
    const bucket = admin.storage().bucket();
    const filePath = `invoices/${PLATFORM_ID}/${orderId}.pdf`;
    const file = bucket.file(filePath);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: { generatedAt: new Date().toISOString(), orderId },
      },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  } finally {
    await browser.close();
  }
}

/**
 * Build the invoice HTML from order data.
 */
function buildInvoiceHtml(order: Order, invoiceNumber: string): string {
  const orderDate = order.createdAt
    ? new Date(typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const customerName = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim()
    : order.customerEmail ?? 'Customer';

  const billingAddress = order.billingAddress;
  const addressHtml = billingAddress
    ? `<p>${billingAddress.address1 ?? ''}<br>${billingAddress.city ?? ''}, ${billingAddress.state ?? ''} ${billingAddress.zip ?? ''}<br>${billingAddress.country ?? ''}</p>`
    : '';

  const itemsHtml = (order.items ?? []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.productName ?? item.productId}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${(item.price ?? 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${(item.total ?? item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 24px; font-weight: 700; color: #6366f1; }
    .invoice-title { font-size: 32px; font-weight: 300; color: #666; text-align: right; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .meta-block h4 { margin: 0 0 8px 0; color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .meta-block p { margin: 0; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th { background: #f8f9fa; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
    .totals { text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; }
    .totals .total { font-size: 18px; font-weight: 700; color: #6366f1; border-top: 2px solid #6366f1; padding-top: 8px; margin-top: 8px; }
    .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">SalesVelocity.ai</div>
    <div class="invoice-title">INVOICE</div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <h4>Bill To</h4>
      <p><strong>${customerName}</strong></p>
      ${order.customerEmail ? `<p>${order.customerEmail}</p>` : ''}
      ${addressHtml}
    </div>
    <div class="meta-block" style="text-align:right;">
      <h4>Invoice Details</h4>
      <p><strong>${invoiceNumber}</strong></p>
      <p>Date: ${orderDate}</p>
      <p>Order: ${order.orderNumber ?? order.id}</p>
      ${order.payment?.method ? `<p>Payment: ${order.payment.method}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal:</span><span>$${(order.subtotal ?? 0).toFixed(2)}</span></div>
    ${order.tax ? `<div class="row"><span>Tax:</span><span>$${order.tax.toFixed(2)}</span></div>` : ''}
    ${order.shipping ? `<div class="row"><span>Shipping:</span><span>$${order.shipping.toFixed(2)}</span></div>` : ''}
    ${order.discount ? `<div class="row"><span>Discount:</span><span>-$${order.discount.toFixed(2)}</span></div>` : ''}
    <div class="row total"><span>Total:</span><span>$${(order.total ?? 0).toFixed(2)}</span></div>
  </div>

  <div class="footer">
    <p>Thank you for your business.</p>
    <p>SalesVelocity.ai</p>
  </div>
</body>
</html>`;
}
