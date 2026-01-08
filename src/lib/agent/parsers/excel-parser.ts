/**
 * Excel Parser
 * Extracts data from Excel files (product catalogs, pricing sheets, etc.)
 */

import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger/logger';

// Represents a single cell value from Excel
type ExcelCellValue = string | number | boolean | null;

// Represents a row of data as a record with string keys
type ExcelRowData = Record<string, ExcelCellValue>;

// Represents raw sheet data as 2D array
type ExcelSheetData = ExcelCellValue[][];

export interface ExcelSheet {
  name: string;
  data: ExcelSheetData;
  headers: string[];
  rows: ExcelRowData[];
}

export interface ExcelParseResult {
  sheets: ExcelSheet[];
  metadata: {
    sheetNames: string[];
    totalSheets: number;
  };
}

// Product extracted from Excel
export interface ExcelProduct {
  name: string;
  description: string;
  price?: number;
  [key: string]: ExcelCellValue | undefined;
}

// Service extracted from Excel
export interface ExcelService {
  name: string;
  description: string;
  pricing?: string;
  [key: string]: ExcelCellValue | undefined;
}

/**
 * Parse Excel file and extract data
 */
export async function parseExcel(file: File | Buffer): Promise<ExcelParseResult> {
  try {
    let buffer: Buffer;
    
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = file;
    }
    
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheets: ExcelSheet[] = workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<ExcelCellValue[]>(worksheet, { header: 1, defval: '' });
      
      // Convert raw data to typed format
      const data: ExcelSheetData = rawData.map(row => 
        Array.isArray(row) ? row : []
      );
      
      // First row as headers
      const headers: string[] = data.length > 0 
        ? data[0].map((h) => (h !== '' && h != null) ? String(h) : '') 
        : [];
      
      // Convert to objects
      const rows: ExcelRowData[] = data.slice(1).map((row: ExcelCellValue[]) => {
        const obj: ExcelRowData = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index] ?? '';
          }
        });
        return obj;
      });
      
      return {
        name: sheetName,
        data,
        headers,
        rows,
      };
    });
    
    return {
      sheets,
      metadata: {
        sheetNames: workbook.SheetNames,
        totalSheets: workbook.SheetNames.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error parsing Excel:', error, { file: 'excel-parser.ts' });
    throw new Error(`Failed to parse Excel: ${errorMessage}`);
  }
}

/**
 * Extract products from Excel (common format: Name, Description, Price columns)
 */
export function extractProductsFromExcel(
  excelResult: ExcelParseResult
): ExcelProduct[] {
  const products: ExcelProduct[] = [];
  
  for (const sheet of excelResult.sheets) {
    // Look for common product column names
    const nameColumns = ['name', 'product', 'product name', 'item', 'title'];
    const descColumns = ['description', 'desc', 'details', 'info'];
    const priceColumns = ['price', 'cost', 'amount', 'value'];
    
    const nameCol = sheet.headers.findIndex(h => 
      nameColumns.some(nc => h.toLowerCase().includes(nc))
    );
    const descCol = sheet.headers.findIndex(h => 
      descColumns.some(dc => h.toLowerCase().includes(dc))
    );
    const priceCol = sheet.headers.findIndex(h => 
      priceColumns.some(pc => h.toLowerCase().includes(pc))
    );
    
    if (nameCol !== undefined && nameCol >= 0) {
      for (const row of sheet.rows) {
        const nameHeader = sheet.headers[nameCol];
        const name = nameHeader ? row[nameHeader] : null;
        
        if (name && String(name).trim()) {
          const descHeader = descCol !== undefined && descCol >= 0 ? sheet.headers[descCol] : null;
          const descValue = descHeader ? row[descHeader] : '';
          const descStr = (descValue !== '' && descValue != null) ? String(descValue) : '';
          
          const product: ExcelProduct = {
            name: String(name).trim(),
            description: descStr.trim(),
          };
          
          if (priceCol !== undefined && priceCol >= 0) {
            const priceHeader = sheet.headers[priceCol];
            const priceValue = priceHeader ? row[priceHeader] : null;
            const priceStr = ((priceValue !== '' && priceValue != null) ? String(priceValue) : '').replace(/[^0-9.]/g, '');
            if (priceStr) {
              product.price = parseFloat(priceStr);
            }
          }
          
          // Add all other columns as metadata
          sheet.headers.forEach((header, index) => {
            if (index !== nameCol && index !== descCol && index !== priceCol && header) {
              product[header] = row[header];
            }
          });
          
          products.push(product);
        }
      }
    }
  }
  
  return products;
}

/**
 * Extract services from Excel
 */
export function extractServicesFromExcel(
  excelResult: ExcelParseResult
): ExcelService[] {
  const services: ExcelService[] = [];
  
  for (const sheet of excelResult.sheets) {
    const nameColumns = ['name', 'service', 'service name', 'title'];
    const descColumns = ['description', 'desc', 'details'];
    const pricingColumns = ['pricing', 'price', 'cost', 'rate'];
    
    const nameCol = sheet.headers.findIndex(h => 
      nameColumns.some(nc => h.toLowerCase().includes(nc))
    );
    const descCol = sheet.headers.findIndex(h => 
      descColumns.some(dc => h.toLowerCase().includes(dc))
    );
    const pricingCol = sheet.headers.findIndex(h => 
      pricingColumns.some(pc => h.toLowerCase().includes(pc))
    );
    
    if (nameCol !== undefined && nameCol >= 0) {
      for (const row of sheet.rows) {
        const nameHeader = sheet.headers[nameCol];
        const name = nameHeader ? row[nameHeader] : null;
        
        if (name && String(name).trim()) {
          const descHeader = descCol !== undefined && descCol >= 0 ? sheet.headers[descCol] : null;
          const descValue = descHeader ? row[descHeader] : '';
          const descStr = (descValue !== '' && descValue != null) ? String(descValue) : '';
          
          const service: ExcelService = {
            name: String(name).trim(),
            description: descStr.trim(),
          };
          
          if (pricingCol !== undefined && pricingCol >= 0) {
            const pricingHeader = sheet.headers[pricingCol];
            const pricingValue = pricingHeader ? row[pricingHeader] : null;
            service.pricing = ((pricingValue !== '' && pricingValue != null) ? String(pricingValue) : '').trim();
          }
          
          // Add all other columns
          sheet.headers.forEach((header, index) => {
            if (index !== nameCol && index !== descCol && index !== pricingCol && header) {
              service[header] = row[header];
            }
          });
          
          services.push(service);
        }
      }
    }
  }
  
  return services;
}






















