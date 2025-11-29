/**
 * Knowledge Base Processor Service
 * Processes uploaded files and URLs to build knowledge base
 */

import type { KnowledgeBase, KnowledgeDocument, KnowledgeURL, FAQ } from '@/types/agent-memory';
import { analyzeCompanyKnowledge } from './knowledge-analyzer';

export interface KnowledgeProcessorOptions {
  organizationId: string;
  uploadedFiles?: File[];
  urls?: string[];
  faqPageUrl?: string;
  socialMediaUrls?: string[];
  faqs?: string; // Manual FAQ text
  websiteUrl?: string;
}

/**
 * Process knowledge base from onboarding data
 */
export async function processKnowledgeBase(
  options: KnowledgeProcessorOptions
): Promise<KnowledgeBase> {
  const { 
    organizationId, 
    uploadedFiles = [], 
    urls = [], 
    faqPageUrl,
    socialMediaUrls = [],
    faqs,
    websiteUrl
  } = options;
  
  const knowledgeBase: KnowledgeBase = {
    documents: [],
    urls: [],
    faqs: [],
  };
  
  // Process uploaded files
  if (uploadedFiles.length > 0) {
    const processedDocs = await Promise.all(
      uploadedFiles.map(file => processFile(file, organizationId))
    );
    knowledgeBase.documents = processedDocs.filter(doc => doc !== null) as KnowledgeDocument[];
  }
  
  // Process URLs
  const allUrls = [...urls];
  if (faqPageUrl) allUrls.push(faqPageUrl);
  if (websiteUrl) allUrls.push(websiteUrl);
  
  if (allUrls.length > 0 || socialMediaUrls.length > 0) {
    // Use existing knowledge analyzer for URL processing
    const analysisResult = await analyzeCompanyKnowledge(
      websiteUrl || allUrls[0] || '',
      organizationId,
      undefined,
      faqPageUrl,
      socialMediaUrls.length > 0 ? socialMediaUrls : undefined
    );
    
    // Convert analysis result to knowledge base format
    if (analysisResult.faqs && analysisResult.faqs.length > 0) {
      knowledgeBase.faqs = analysisResult.faqs.map((faq, index) => ({
        id: `faq_${Date.now()}_${index}`,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        keywords: extractKeywords(faq.question + ' ' + faq.answer),
      }));
    }
    
    // Add URLs from analysis
    if (websiteUrl) {
      knowledgeBase.urls.push({
        id: `url_${Date.now()}_website`,
        url: websiteUrl,
        addedAt: new Date().toISOString(),
        scrapedAt: new Date().toISOString(),
        extractedContent: JSON.stringify(analysisResult.companyInfo),
        title: analysisResult.companyInfo.name,
      });
    }
    
    // Add product catalog if available
    if (analysisResult.products && analysisResult.products.length > 0) {
      knowledgeBase.productCatalog = {
        products: analysisResult.products.map((p, index) => ({
          id: `prod_${Date.now()}_${index}`,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price?.replace(/[^0-9.]/g, '') || '0'),
          images: [],
          category: p.category || 'General',
          inStock: true,
        })),
        categories: [],
        lastSynced: new Date().toISOString(),
      };
    }
  }
  
  // Process manual FAQs if provided
  if (faqs) {
    const manualFaqs = parseManualFAQs(faqs);
    knowledgeBase.faqs.push(...manualFaqs);
  }
  
  return knowledgeBase;
}

/**
 * Process uploaded file
 */
async function processFile(
  file: File,
  organizationId: string
): Promise<KnowledgeDocument | null> {
  try {
    const fileType = getFileType(file.name);
    const fileId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let extractedContent = '';
    let metadata: Record<string, any> = {
      size: file.size,
      mimeType: file.type,
    };
    
    // Extract content based on file type
    if (fileType === 'pdf') {
      const { parsePDF } = await import('./parsers/pdf-parser');
      const pdfResult = await parsePDF(file);
      extractedContent = pdfResult.text;
      metadata = { ...metadata, ...pdfResult.metadata };
      
      // Extract structured data if it looks like a product catalog
      if (pdfResult.text.toLowerCase().includes('product') || pdfResult.text.toLowerCase().includes('price')) {
        const { extractStructuredDataFromPDF } = await import('./parsers/pdf-parser');
        const structured = await extractStructuredDataFromPDF(pdfResult.text, organizationId);
        metadata.structuredData = structured;
      }
    } else if (fileType === 'excel') {
      const { parseExcel, extractProductsFromExcel, extractServicesFromExcel } = await import('./parsers/excel-parser');
      const excelResult = await parseExcel(file);
      
      // Convert to text representation
      extractedContent = excelResult.sheets.map(sheet => {
        return `${sheet.name}:\n${sheet.rows.map(row => JSON.stringify(row)).join('\n')}`;
      }).join('\n\n');
      
      // Extract products and services
      const products = extractProductsFromExcel(excelResult);
      const services = extractServicesFromExcel(excelResult);
      
      metadata.excelData = {
        sheets: excelResult.sheets.length,
        products: products.length,
        services: services.length,
      };
      
      if (products.length > 0) {
        metadata.products = products;
      }
      if (services.length > 0) {
        metadata.services = services;
      }
    } else if (fileType === 'text') {
      // Plain text file
      extractedContent = await file.text();
    } else {
      // For other types, we'll need to handle them later
      extractedContent = `File type ${fileType} not yet fully supported for content extraction.`;
    }
    
    const document: KnowledgeDocument = {
      id: fileId,
      filename: file.name,
      type: fileType,
      uploadedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      extractedContent,
      metadata,
    };
    
    return document;
  } catch (error) {
    console.error('Error processing file:', error);
    return null;
  }
}

/**
 * Get file type from filename
 */
function getFileType(filename: string): 'pdf' | 'excel' | 'word' | 'image' | 'text' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return 'excel';
  if (['doc', 'docx'].includes(ext || '')) return 'word';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
  return 'text';
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use NLP
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const keywords = words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
  return [...new Set(keywords)];
}

/**
 * Parse manual FAQ text into FAQ objects
 */
function parseManualFAQs(faqsText: string): FAQ[] {
  // Simple parsing - assumes Q: and A: format
  // In production, use more sophisticated parsing
  const lines = faqsText.split('\n');
  const faqs: FAQ[] = [];
  let currentQ = '';
  let currentA = '';
  
  for (const line of lines) {
    if (line.trim().startsWith('Q:') || line.trim().startsWith('Question:')) {
      if (currentQ && currentA) {
        faqs.push({
          id: `faq_manual_${Date.now()}_${faqs.length}`,
          question: currentQ,
          answer: currentA,
          keywords: extractKeywords(currentQ + ' ' + currentA),
        });
      }
      currentQ = line.replace(/^(Q:|Question:)\s*/i, '').trim();
      currentA = '';
    } else if (line.trim().startsWith('A:') || line.trim().startsWith('Answer:')) {
      currentA = line.replace(/^(A:|Answer:)\s*/i, '').trim();
    } else if (currentQ && line.trim()) {
      currentA += (currentA ? '\n' : '') + line.trim();
    }
  }
  
  // Add last FAQ
  if (currentQ && currentA) {
    faqs.push({
      id: `faq_manual_${Date.now()}_${faqs.length}`,
      question: currentQ,
      answer: currentA,
      keywords: extractKeywords(currentQ + ' ' + currentA),
    });
  }
  
  return faqs;
}

