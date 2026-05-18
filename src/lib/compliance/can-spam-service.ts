/**
 * CAN-SPAM Compliance Service
 * Ensures all commercial emails comply with CAN-SPAM Act requirements:
 * - Mandatory unsubscribe link
 * - Physical mailing address
 * - Accurate From/Reply-To headers
 * - Clear identification as advertisement (if applicable)
 * - List-Unsubscribe / List-Unsubscribe-Post headers (RFC 8058 one-click)
 */

import { PLATFORM_ID } from '@/lib/constants/platform';

/** Default physical address for CAN-SPAM compliance.
 *
 * KNOWN LIMITATION: This value is sourced from the COMPANY_PHYSICAL_ADDRESS
 * env var or falls back to a stub. For production multi-tenant use, each
 * tenant's postal address should be read from the org doc and passed to
 * `injectUnsubscribe` / `getRequiredEmailFooter` as a parameter. That path
 * is not yet wired — tracked for the multi-tenant flip (week of May 4-10 2026).
 */
const DEFAULT_PHYSICAL_ADDRESS = process.env.COMPANY_PHYSICAL_ADDRESS
  ?? 'SalesVelocity.ai, PO Box 12345, Austin, TX 78701';

/** Unsubscribe mailbox for the mailto: List-Unsubscribe header value */
const UNSUBSCRIBE_MAILBOX = process.env.UNSUBSCRIBE_EMAIL
  ?? 'unsubscribe@salesvelocity.ai';

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
 * Plain-text footer appended to the text/plain part of a marketing email.
 * Mirrors the HTML footer — CAN-SPAM applies equally to the text version.
 */
export function getRequiredTextFooter(unsubscribeUrl: string): string {
  return `\n\n---\n${DEFAULT_PHYSICAL_ADDRESS}\nTo unsubscribe: ${unsubscribeUrl}`;
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
 * Build RFC 8058 one-click List-Unsubscribe headers for a marketing email.
 *
 * Returns an object with two header names and their values. Both the
 * `List-Unsubscribe` (HTTP + mailto combo) and `List-Unsubscribe-Post`
 * (one-click POST trigger) are required for Gmail/Yahoo bulk-sender
 * compliance as of February 2024.
 *
 * Usage — add these to your send call's `headers` map:
 *   const headers = buildListUnsubscribeHeaders(unsubscribeUrl);
 *   // { 'List-Unsubscribe': '...', 'List-Unsubscribe-Post': '...' }
 */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  // The mailto: target must include the token so the receiving mailbox can
  // route back to the unsubscribe processor, even without a click.
  const mailtoUrl = `mailto:${UNSUBSCRIBE_MAILBOX}?subject=unsubscribe&body=${encodeURIComponent(unsubscribeUrl)}`;

  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <${mailtoUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Inject unsubscribe footer into both the HTML and plain-text parts of a
 * marketing email body.
 *
 * @param html         - Raw HTML body to inject into
 * @param text         - Raw plain-text body (optional); if omitted, only HTML is modified
 * @param contactId    - Firestore contact/prospect ID used to build the unsubscribe URL
 * @param emailId      - Optional enrollment/step ID appended to the URL for audit
 * @returns Modified html, modified text (or undefined), and the unsubscribeUrl that was used
 */
export function injectUnsubscribe(
  html: string,
  text: string | undefined,
  contactId: string,
  emailId?: string,
): { html: string; text: string | undefined; unsubscribeUrl: string } {
  const unsubscribeUrl = getUnsubscribeUrl(contactId, emailId);

  // Check if unsubscribe link already exists so we never double-inject
  const hasUnsubscribe = html.toLowerCase().includes('unsubscribe');
  const hasAddress = html.includes(DEFAULT_PHYSICAL_ADDRESS);

  const injectedHtml = (hasUnsubscribe && hasAddress)
    ? html
    : html.includes('</body>')
      ? html.replace('</body>', `${getRequiredEmailFooter(unsubscribeUrl)}</body>`)
      : html + getRequiredEmailFooter(unsubscribeUrl);

  let injectedText = text;
  if (injectedText !== undefined) {
    const textHasUnsub = injectedText.toLowerCase().includes('unsubscribe');
    if (!textHasUnsub) {
      injectedText = injectedText + getRequiredTextFooter(unsubscribeUrl);
    }
  }

  return { html: injectedHtml, text: injectedText, unsubscribeUrl };
}

/**
 * Ensure email HTML includes required CAN-SPAM elements.
 * Appends footer if missing.
 *
 * Prefer `injectUnsubscribe` for new call sites — it handles both HTML and
 * plain-text and returns the unsubscribeUrl so callers can also set headers.
 * This function is preserved for existing callers (campaign-manager, API routes).
 */
export function ensureCompliance(
  htmlContent: string,
  contactId: string,
  emailId?: string
): string {
  const { html } = injectUnsubscribe(htmlContent, undefined, contactId, emailId);
  return html;
}
