/**
 * AI Page Generator
 * Generates website pages from natural language prompts using AI
 */

import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { logger } from '@/lib/logger/logger';
import type { PageSection, PageSEO } from '@/types/website';

// ============================================================================
// Types
// ============================================================================

export interface PageGenerationOptions {
  pageType?: string;
  style?: {
    primaryColor?: string;
    tone?: string;
  };
  brandInfo?: {
    name?: string;
    tagline?: string;
    industry?: string;
  };
}

export interface GeneratedPage {
  title: string;
  slug: string;
  sections: PageSection[];
  seo: PageSEO;
}

interface AIPageResponse {
  title: string;
  slug: string;
  sections: PageSection[];
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
  };
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a website page generator. Given a description, you produce a JSON structure for a website page.

## Output Format
Return ONLY valid JSON (no markdown, no code fences) matching this structure:
{
  "title": "Page Title",
  "slug": "page-title",
  "sections": [...],
  "seo": { "metaTitle": "...", "metaDescription": "...", "metaKeywords": ["..."] }
}

## Section Structure
Each section in the "sections" array must have:
{
  "id": "section_<unique>",
  "type": "section",
  "columns": [
    {
      "id": "col_<unique>",
      "width": 100,
      "widgets": [...]
    }
  ],
  "fullWidth": true
}

## Widget Structure
Each widget in a column's "widgets" array:
{
  "id": "widget_<unique>",
  "type": "<WidgetType>",
  "data": { ... }
}

## Available WidgetTypes and their data shapes:

### Content Widgets
- "heading": { "text": "string", "level": 1-6, "tag": "h1"-"h6" }
- "text": { "content": "HTML string with <p>, <strong>, <em> tags" }
- "button": { "text": "string", "url": "#", "variant": "primary"|"secondary"|"outline" }
- "image": { "src": "https://via.placeholder.com/800x400", "alt": "string", "caption": "string" }
- "hero": { "heading": "string", "subheading": "string", "buttonText": "string", "buttonUrl": "#", "backgroundImage": "https://via.placeholder.com/1920x600" }
- "features": { "features": [{ "icon": "emoji", "title": "string", "description": "string" }] }
- "pricing": { "plans": [{ "name": "string", "price": "$XX/mo", "features": ["string"], "buttonText": "string", "highlighted": boolean }] }
- "testimonial": { "quote": "string", "author": "string", "role": "string", "avatar": "https://via.placeholder.com/64" }
- "cta": { "heading": "string", "description": "string", "buttonText": "string", "buttonUrl": "#" }
- "stats": { "stats": [{ "value": "string", "label": "string" }] }
- "faq": { "items": [{ "question": "string", "answer": "string" }] }

### Form Widgets
- "contact-form": { "fields": ["name", "email", "message"], "submitText": "Send Message", "successMessage": "Thank you!" }
- "newsletter": { "heading": "string", "description": "string", "buttonText": "Subscribe" }

### Media Widgets
- "gallery": { "images": [{ "src": "url", "alt": "string" }] }
- "social-icons": { "icons": [{ "platform": "string", "url": "#" }] }

## Guidelines
- Generate 3-7 sections per page depending on complexity
- Use realistic placeholder content relevant to the description
- Make content professional, engaging, and conversion-focused
- Use placeholder images from https://via.placeholder.com/ with appropriate dimensions
- Ensure all IDs are unique (use incrementing numbers like section_1, col_1, widget_1)
- Match the page type: landing pages need heroes and CTAs, about pages need text and stats, etc.`;

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate a website page from a natural language prompt
 */
export async function generatePageFromPrompt(
  prompt: string,
  options: PageGenerationOptions = {}
): Promise<GeneratedPage> {
  const { pageType, style, brandInfo } = options;

  // Build user message with context
  const contextParts: string[] = [`Generate a website page for: ${prompt}`];

  if (pageType) {
    contextParts.push(`Page type: ${pageType}`);
  }
  if (brandInfo?.name) {
    contextParts.push(`Brand: ${brandInfo.name}`);
  }
  if (brandInfo?.tagline) {
    contextParts.push(`Tagline: ${brandInfo.tagline}`);
  }
  if (brandInfo?.industry) {
    contextParts.push(`Industry: ${brandInfo.industry}`);
  }
  if (style?.primaryColor) {
    contextParts.push(`Primary color: ${style.primaryColor}`);
  }
  if (style?.tone) {
    contextParts.push(`Tone: ${style.tone}`);
  }

  const userMessage = contextParts.join('\n');

  logger.info('AI page generation starting', {
    promptLength: prompt.length,
    pageType,
    file: 'ai-page-generator.ts',
  });

  // Retry up to 2 times for JSON parse failures
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await sendUnifiedChatMessage({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: userMessage }],
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Parse AI response — strip any markdown code fences
      let jsonText = response.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText) as AIPageResponse;

      // Validate essential structure
      if (!parsed.title || !parsed.slug || !Array.isArray(parsed.sections)) {
        throw new Error('AI response missing required fields (title, slug, sections)');
      }

      // Ensure all sections have required fields
      const sections: PageSection[] = parsed.sections.map((section, sIdx) => ({
        id: section.id ?? `section_${sIdx + 1}`,
        type: 'section' as const,
        columns: (section.columns ?? []).map((col, cIdx) => ({
          id: col.id ?? `col_${sIdx + 1}_${cIdx + 1}`,
          width: col.width ?? 100,
          widgets: (col.widgets ?? []).map((widget, wIdx) => ({
            id: widget.id ?? `widget_${sIdx + 1}_${cIdx + 1}_${wIdx + 1}`,
            type: widget.type,
            data: widget.data ?? {},
          })),
        })),
        fullWidth: section.fullWidth ?? true,
      }));

      const result: GeneratedPage = {
        title: parsed.title,
        slug: parsed.slug,
        sections,
        seo: {
          metaTitle: parsed.seo?.metaTitle ?? parsed.title,
          metaDescription: parsed.seo?.metaDescription,
          metaKeywords: parsed.seo?.metaKeywords,
        },
      };

      logger.info('AI page generation completed', {
        title: result.title,
        sectionCount: result.sections.length,
        file: 'ai-page-generator.ts',
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('AI page generation attempt failed', {
        attempt: attempt + 1,
        error: lastError.message,
        file: 'ai-page-generator.ts',
      });

      if (attempt < 2) {
        // Brief delay before retry
        await new Promise<void>(resolve => { setTimeout(resolve, 1000); });
      }
    }
  }

  throw lastError ?? new Error('AI page generation failed after 3 attempts');
}
