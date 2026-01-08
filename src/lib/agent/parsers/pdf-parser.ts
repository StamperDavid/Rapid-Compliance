/**
 * PDF Parser
 * Extracts text content from PDF files
 */

import { logger } from '@/lib/logger/logger';

// Dynamic import for pdf-parse (works in both Node.js and browser)
let pdfParse: any;
async function getPdfParse() {
  // Use nullish coalescing assignment for lazy initialization
  pdfParse ??= (await import('pdf-parse')) as unknown as (dataBuffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  return pdfParse;
}

export interface PDFParseResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    pages: number;
    info?: any;
  };
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
    
    // Parse PDF
    const pdfParseFn = await getPdfParse();
    const data = await pdfParseFn(buffer);
    
    return {
      text: data.text,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        pages: data.numpages,
        info: data.info,
      },
    };
  } catch (error: any) {
    logger.error('Error parsing PDF:', error, { file: 'pdf-parser.ts' });
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Extract structured data from PDF (products, pricing, etc.)
 * Uses AI to identify and extract structured information
 */
export async function extractStructuredDataFromPDF(
  pdfText: string,
  organizationId: string
): Promise<{
  products?: Array<{ name: string; description: string; price?: string }>;
  services?: Array<{ name: string; description: string; pricing?: string }>;
  policies?: Record<string, string>;
}> {
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
        return JSON.parse(jsonMatch[0]);
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

