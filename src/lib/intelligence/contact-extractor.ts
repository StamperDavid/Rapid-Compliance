/**
 * Contact Extractor — AI-powered extraction focused on finding contact info
 *
 * Uses GPT-4o-mini with a contact-specific prompt to extract phones, emails,
 * social media, and decision-maker information from scraped content.
 *
 * Falls back to regex extraction when OpenAI API key is not available.
 *
 * @module intelligence/contact-extractor
 */

import { logger } from '@/lib/logger/logger';
import type { ScrapedContent } from '@/lib/enrichment/types';
import { createEmptyContactFields, type ContactFields } from './source-adapters/index';

const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SOCIAL_PATTERNS: Array<{ platform: string; pattern: RegExp }> = [
  { platform: 'linkedin', pattern: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>)]+/gi },
  { platform: 'facebook', pattern: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi },
  { platform: 'twitter', pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/gi },
  { platform: 'instagram', pattern: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi },
  { platform: 'youtube', pattern: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>)]+/gi },
];

// Emails to exclude (common noise)
const EXCLUDED_EMAIL_DOMAINS = [
  'example.com', 'sentry.io', 'webpack.js.org', 'wixpress.com',
  'w3.org', 'schema.org', 'googleapis.com', 'google.com',
];

interface AiContactExtractionResult {
  phones: string[];
  emails: string[];
  socialMedia: Record<string, string>;
  ownerName: string | null;
  ownerTitle: string | null;
  website: string | null;
}

/**
 * Extract contact information from scraped content using AI + regex fallback.
 */
export async function extractContactInfo(
  content: ScrapedContent,
  entityName: string
): Promise<ContactFields> {
  // Try AI extraction first
  const aiResult = await aiExtractContacts(content, entityName);
  if (aiResult) {
    return aiResult;
  }

  // Fallback to regex extraction
  return regexExtractContacts(content);
}

/**
 * AI-powered contact extraction using GPT-4o-mini.
 */
async function aiExtractContacts(
  content: ScrapedContent,
  entityName: string
): Promise<ContactFields | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.debug('[ContactExtractor] No OpenAI API key, falling back to regex');
    return null;
  }

  try {
    // Truncate content to fit within token limits
    const maxChars = 6000;
    const truncatedText = content.cleanedText.slice(0, maxChars);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${String(apiKey)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a contact information extraction specialist. Extract ONLY factual contact information from the provided website content. Return a JSON object with the following fields. Use null for any field not found. Do not fabricate or guess information.`,
          },
          {
            role: 'user',
            content: `Extract contact information for "${entityName}" from this website content:\n\n${truncatedText}\n\nReturn JSON with these fields:\n- phones: string[] (all phone numbers found)\n- emails: string[] (all email addresses found, exclude noreply/automated)\n- socialMedia: { linkedin?: string, facebook?: string, twitter?: string, instagram?: string }\n- ownerName: string | null (owner, CEO, president, or primary contact name)\n- ownerTitle: string | null (their job title)\n- website: string | null (official company website URL)`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      logger.warn('[ContactExtractor] OpenAI API returned non-OK', { status: response.status });
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) { return null; }

    const parsed = JSON.parse(messageContent) as AiContactExtractionResult;

    const contacts = createEmptyContactFields();
    contacts.phones = Array.isArray(parsed.phones) ? parsed.phones.filter((p) => typeof p === 'string') : [];
    contacts.emails = Array.isArray(parsed.emails) ? parsed.emails.filter((e) => typeof e === 'string') : [];
    contacts.socialMedia = typeof parsed.socialMedia === 'object' && parsed.socialMedia !== null
      ? Object.fromEntries(
          Object.entries(parsed.socialMedia).filter(([, v]) => typeof v === 'string' && v.length > 0)
        )
      : {};
    contacts.ownerName = typeof parsed.ownerName === 'string' ? parsed.ownerName : null;
    contacts.ownerTitle = typeof parsed.ownerTitle === 'string' ? parsed.ownerTitle : null;
    contacts.website = typeof parsed.website === 'string' ? parsed.website : null;

    return contacts;
  } catch (err: unknown) {
    logger.warn('[ContactExtractor] AI extraction failed, falling back to regex', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Regex-based contact extraction fallback.
 */
function regexExtractContacts(content: ScrapedContent): ContactFields {
  const contacts = createEmptyContactFields();
  const allText = `${content.cleanedText} ${content.rawHtml ?? ''}`;

  // Phones
  const phoneMatches = allText.match(PHONE_REGEX);
  if (phoneMatches) {
    const uniquePhones = new Set(phoneMatches.map((p) => p.trim()));
    contacts.phones = Array.from(uniquePhones).slice(0, 5);
  }

  // Emails
  const emailMatches = allText.match(EMAIL_REGEX);
  if (emailMatches) {
    const uniqueEmails = new Set(
      emailMatches
        .map((e) => e.toLowerCase())
        .filter((e) => !EXCLUDED_EMAIL_DOMAINS.some((d) => e.includes(d)))
    );
    contacts.emails = Array.from(uniqueEmails).slice(0, 5);
  }

  // Social media
  for (const { platform, pattern } of SOCIAL_PATTERNS) {
    const matches = allText.match(pattern);
    if (matches?.[0]) {
      contacts.socialMedia[platform] = matches[0];
    }
  }

  return contacts;
}
