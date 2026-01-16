/**
 * PDF Parser
 * Extracts text content from PDF files
 */

import { logger } from '@/lib/logger/logger';

/** PDF info structure from pdf-parse library */
interface PDFInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  [key: string]: unknown;
}

export interface PDFParseResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    pages: number;
    info?: PDFInfo;
  };
}


/**
 * Extract string property safely from info object
 */
function getInfoString(info: Record<string, unknown> | undefined, key: string): string | undefined {
  if (info === undefined) {
    return undefined;
  }
  const value = info[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Parse PDF file and extract text
 */
export async function parsePDF(file: File | Buffer): Promise<PDFParseResult> {
  try {
    let buffer: Buffer;

    if (file instanceof File) {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = file;
    }

    // Create a new parser instance with the data
    const pdfParseModule = await import('pdf-parse');
    const parserWithData = new pdfParseModule.PDFParse({ data: buffer });

    // Get text content
    const textResult = await parserWithData.getText();
    const text = textResult.text;

    // Get metadata
    const infoResult = await parserWithData.getInfo();

    // Clean up the parser
    await parserWithData.destroy();

    // Safely extract info fields
    const info = infoResult.info as Record<string, unknown> | undefined;

    return {
      text,
      metadata: {
        title: getInfoString(info, 'Title'),
        author: getInfoString(info, 'Author'),
        subject: getInfoString(info, 'Subject'),
        pages: infoResult.pages?.length ?? 0,
        info: info as PDFInfo | undefined,
      },
    };
  } catch (error: unknown) {
    logger.error('Error parsing PDF:', error, { file: 'pdf-parser.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse PDF: ${errorMessage}`);
  }
}

/** Structured data extracted from PDF */
interface ExtractedPDFData {
  products?: Array<{ name: string; description: string; price?: string }>;
  services?: Array<{ name: string; description: string; pricing?: string }>;
  policies?: Record<string, string>;
}

/**
 * Type guard to validate extracted PDF data structure
 */
function isValidExtractedData(data: unknown): data is ExtractedPDFData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;

  // Validate products array if present
  if (obj.products !== undefined) {
    if (!Array.isArray(obj.products)) {
      return false;
    }
  }

  // Validate services array if present
  if (obj.services !== undefined) {
    if (!Array.isArray(obj.services)) {
      return false;
    }
  }

  // Validate policies object if present
  if (obj.policies !== undefined) {
    if (typeof obj.policies !== 'object' || obj.policies === null) {
      return false;
    }
  }

  return true;
}

/**
 * Extract structured data from PDF (products, pricing, etc.)
 * Uses AI to identify and extract structured information
 */
export async function extractStructuredDataFromPDF(
  pdfText: string,
  _organizationId: string
): Promise<ExtractedPDFData> {
  // Use Gemini to extract structured data
  try {
    const { generateText } = await import('@/lib/ai/gemini-service');

    const prompt = `Extract structured information from this document text. Identify:
1. Products (name, description, price if mentioned)
2. Services (name, description, pricing if mentioned)
3. Policies (return policy, warranty, shipping, etc.)

Document text:
${pdfText.substring(0, 10000)} // Limit to first 10k chars

Return JSON format:
{
  "products": [{"name": "...", "description": "...", "price": "..."}],
  "services": [{"name": "...", "description": "...", "pricing": "..."}],
  "policies": {"returnPolicy": "...", "warranty": "...", "shipping": "..."}
}`;

    const response = await generateText(prompt);

    // Try to parse JSON from response
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: unknown = JSON.parse(jsonMatch[0]);
        if (isValidExtractedData(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      logger.warn('Failed to parse JSON from AI response', { error: e, file: 'pdf-parser.ts' });
    }

    return {};
  } catch (error) {
    logger.error('Error extracting structured data from PDF:', error, { file: 'pdf-parser.ts' });
    return {};
  }
}

