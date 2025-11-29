/**
 * Excel Parser
 * Extracts data from Excel files (product catalogs, pricing sheets, etc.)
 */

import * as XLSX from 'xlsx';

export interface ExcelParseResult {
  sheets: Array<{
    name: string;
    data: any[][];
    headers?: string[];
    rows: any[];
  }>;
  metadata: {
    sheetNames: string[];
    totalSheets: number;
  };
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
    
    const sheets = workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      // First row as headers
      const headers = data.length > 0 ? data[0].map((h: any) => String(h || '')) : [];
      
      // Convert to objects
      const rows = data.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index] || '';
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
  } catch (error: any) {
    console.error('Error parsing Excel:', error);
    throw new Error(`Failed to parse Excel: ${error.message}`);
  }
}

/**
 * Extract products from Excel (common format: Name, Description, Price columns)
 */
export function extractProductsFromExcel(
  excelResult: ExcelParseResult
): Array<{ name: string; description: string; price?: number; [key: string]: any }> {
  const products: Array<{ name: string; description: string; price?: number; [key: string]: any }> = [];
  
  for (const sheet of excelResult.sheets) {
    // Look for common product column names
    const nameColumns = ['name', 'product', 'product name', 'item', 'title'];
    const descColumns = ['description', 'desc', 'details', 'info'];
    const priceColumns = ['price', 'cost', 'amount', 'value'];
    
    const nameCol = sheet.headers?.findIndex(h => 
      nameColumns.some(nc => h.toLowerCase().includes(nc))
    );
    const descCol = sheet.headers?.findIndex(h => 
      descColumns.some(dc => h.toLowerCase().includes(dc))
    );
    const priceCol = sheet.headers?.findIndex(h => 
      priceColumns.some(pc => h.toLowerCase().includes(pc))
    );
    
    if (nameCol !== undefined && nameCol >= 0) {
      for (const row of sheet.rows) {
        const name = row[sheet.headers![nameCol]];
        if (name && String(name).trim()) {
          const product: any = {
            name: String(name).trim(),
            description: descCol !== undefined && descCol >= 0 
              ? String(row[sheet.headers![descCol]] || '').trim() 
              : '',
          };
          
          if (priceCol !== undefined && priceCol >= 0) {
            const priceStr = String(row[sheet.headers![priceCol]] || '').replace(/[^0-9.]/g, '');
            if (priceStr) {
              product.price = parseFloat(priceStr);
            }
          }
          
          // Add all other columns as metadata
          sheet.headers?.forEach((header, index) => {
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
): Array<{ name: string; description: string; pricing?: string; [key: string]: any }> {
  const services: Array<{ name: string; description: string; pricing?: string; [key: string]: any }> = [];
  
  for (const sheet of excelResult.sheets) {
    const nameColumns = ['name', 'service', 'service name', 'title'];
    const descColumns = ['description', 'desc', 'details'];
    const pricingColumns = ['pricing', 'price', 'cost', 'rate'];
    
    const nameCol = sheet.headers?.findIndex(h => 
      nameColumns.some(nc => h.toLowerCase().includes(nc))
    );
    const descCol = sheet.headers?.findIndex(h => 
      descColumns.some(dc => h.toLowerCase().includes(dc))
    );
    const pricingCol = sheet.headers?.findIndex(h => 
      pricingColumns.some(pc => h.toLowerCase().includes(pc))
    );
    
    if (nameCol !== undefined && nameCol >= 0) {
      for (const row of sheet.rows) {
        const name = row[sheet.headers![nameCol]];
        if (name && String(name).trim()) {
          const service: any = {
            name: String(name).trim(),
            description: descCol !== undefined && descCol >= 0 
              ? String(row[sheet.headers![descCol]] || '').trim() 
              : '',
          };
          
          if (pricingCol !== undefined && pricingCol >= 0) {
            service.pricing = String(row[sheet.headers![pricingCol]] || '').trim();
          }
          
          // Add all other columns
          sheet.headers?.forEach((header, index) => {
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

