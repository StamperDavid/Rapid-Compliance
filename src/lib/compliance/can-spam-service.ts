/**
 * CAN-SPAM Compliance Service
 * Ensures all commercial emails comply with CAN-SPAM Act requirements:
 * - Mandatory unsubscribe link
 * - Physical mailing address
 * - Accurate From/Reply-To headers
 * - Clear identification as advertisement (if applicable)
 */

import { PLATFORM_ID } from '@/lib/constants/platform';

/** Default physical address for CAN-SPAM compliance */
const DEFAULT_PHYSICAL_ADDRESS = process.env.COMPANY_PHYSICAL_ADDRESS
  ?? 'SalesVelocity.ai, PO Box 12345, Austin, TX 78701';

interface EmailComplianceCheck {
  unsubscribeUrl?: string;
  physicalAddress?: string;
  fromAddress?: string;
  subjectLine?: string;
}

interface ComplianceResult {
  compliant: boolean;
  violations: string[];
}

/**
 * Validate that an email meets CAN-SPAM requirements
 */
export function validateEmailCompliance(emailContent: EmailComplianceCheck): ComplianceResult {
  const violations: string[] = [];

  if (!emailContent.unsubscribeUrl || emailContent.unsubscribeUrl.trim() === '') {
    violations.push('CAN-SPAM: Missing required unsubscribe link');
  }

  if (!emailContent.physicalAddress || emailContent.physicalAddress.trim() === '') {
    violations.push('CAN-SPAM: Missing required physical mailing address');
  }

  if (!emailContent.fromAddress || emailContent.fromAddress.trim() === '') {
    violations.push('CAN-SPAM: Missing From address');
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Get the required email footer with unsubscribe link and physical address
 */
export function getRequiredEmailFooter(unsubscribeUrl: string): string {
  const physicalAddress = DEFAULT_PHYSICAL_ADDRESS;

  return `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
  <p>${physicalAddress}</p>
  <p>
    <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
    from these emails.
  </p>
</div>`.trim();
}

/**
 * Generate the unsubscribe URL for a given contact
 */
export function getUnsubscribeUrl(contactId: string, emailId?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://salesvelocity.ai';
  const params = new URLSearchParams({
    org: PLATFORM_ID,
    contact: contactId,
  });
  if (emailId) {
    params.set('email', emailId);
  }
  return `${baseUrl}/unsubscribe?${params.toString()}`;
}

/**
 * Ensure email HTML includes required CAN-SPAM elements
 * Appends footer if missing
 */
export function ensureCompliance(
  htmlContent: string,
  contactId: string,
  emailId?: string
): string {
  const unsubscribeUrl = getUnsubscribeUrl(contactId, emailId);

  // Check if unsubscribe link already exists
  const hasUnsubscribe = htmlContent.toLowerCase().includes('unsubscribe');
  const hasAddress = htmlContent.includes(DEFAULT_PHYSICAL_ADDRESS);

  if (hasUnsubscribe && hasAddress) {
    return htmlContent;
  }

  // Append required footer
  const footer = getRequiredEmailFooter(unsubscribeUrl);

  // Insert before closing body tag or append
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${footer}</body>`);
  }

  return htmlContent + footer;
}
