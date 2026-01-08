/**
 * CSV Import Service
 * Handles file parsing, schema detection, and data import
 */

import type { ImportSession, ColumnMapping, DetectedSchema, DetectedField, FieldTypeDetectionResult } from '@/types/import';

export class ImportService {
  /**
   * Parse CSV file
   */
  static parseCSV(file: File): Promise<{ headers: string[]; rows: any[][] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            reject(new Error('File is empty'));
            return;
          }
          
          // Parse CSV (basic implementation - in production use Papa Parse library)
          const rows = lines.map(line => {
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim());
            
            return values;
          });
          
          const headers = rows[0];
          const dataRows = rows.slice(1);
          
          resolve({ headers, rows: dataRows });
        } catch (error: any) {
          reject(new Error(`Failed to parse CSV: ${  error.message}`));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Auto-detect field types from sample data
   */
  static detectFieldType(values: any[]): FieldTypeDetectionResult {
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    
    if (nonEmptyValues.length === 0) {
      return { type: 'text', confidence: 50 };
    }

    // Email detection
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailMatches = nonEmptyValues.filter(v => emailPattern.test(String(v))).length;
    if (emailMatches / nonEmptyValues.length > 0.8) {
      return { type: 'email', confidence: 90, pattern: 'email' };
    }

    // Phone detection
    const phonePattern = /^[\d\s+()-]+$/;
    const phoneMatches = nonEmptyValues.filter(v => {
      const str = String(v);
      return phonePattern.test(str) && str.replace(/\D/g, '').length >= 10;
    }).length;
    if (phoneMatches / nonEmptyValues.length > 0.8) {
      return { type: 'phone', confidence: 85, pattern: 'phone' };
    }

    // URL detection
    const urlPattern = /^https?:\/\//i;
    const urlMatches = nonEmptyValues.filter(v => urlPattern.test(String(v))).length;
    if (urlMatches / nonEmptyValues.length > 0.8) {
      return { type: 'url', confidence: 90, pattern: 'url' };
    }

    // Boolean detection
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
    const boolMatches = nonEmptyValues.filter(v => 
      booleanValues.includes(String(v).toLowerCase())
    ).length;
    if (boolMatches / nonEmptyValues.length > 0.9) {
      return { type: 'boolean', confidence: 95 };
    }

    // Number detection
    const numberMatches = nonEmptyValues.filter(v => !isNaN(Number(v))).length;
    if (numberMatches / nonEmptyValues.length > 0.9) {
      // Currency detection
      const currencyPattern = /^\$?[\d,]+\.?\d*$/;
      const currencyMatches = nonEmptyValues.filter(v => currencyPattern.test(String(v))).length;
      if (currencyMatches / nonEmptyValues.length > 0.8) {
        return { type: 'currency', confidence: 85, pattern: 'currency' };
      }
      return { type: 'number', confidence: 90 };
    }

    // Date detection
    const dateMatches = nonEmptyValues.filter(v => {
      const date = new Date(v);
      return !isNaN(date.getTime());
    }).length;
    if (dateMatches / nonEmptyValues.length > 0.8) {
      return { type: 'date', confidence: 85, pattern: 'date' };
    }

    // Select detection (if limited unique values)
    const uniqueValues = [...new Set(nonEmptyValues)];
    if (uniqueValues.length <= 10 && uniqueValues.length > 1) {
      return { type: 'select', confidence: 75, uniqueValues };
    }

    // Default to text
    return { type: 'text', confidence: 70 };
  }

  /**
   * Auto-detect schema from CSV data
   */
  static detectSchema(headers: string[], rows: any[][], entityName: string): DetectedSchema {
    const fields: DetectedField[] = headers.map((header, index) => {
      const columnValues = rows.map(row => row[index]).slice(0, 100); // Sample first 100 rows
      const detection = this.detectFieldType(columnValues);
      
      // Clean field name
      const fieldName = header
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      // Determine if required (less than 10% empty values)
      const emptyCount = columnValues.filter(v => !v || v === '').length;
      const required = emptyCount / columnValues.length < 0.1;
      
      return {
        name: fieldName,
        type: detection.type,
        required,
        confidence: detection.confidence,
        reasoning: `Detected as ${detection.type} based on ${columnValues.length} sample values`,
        sampleValues: columnValues.slice(0, 5),
      };
    });

    // Calculate overall confidence
    const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;

    // Generate suggestions
    const suggestions: string[] = [];
    if (fields.some(f => f.type === 'email')) {
      suggestions.push('Email field detected - can be used for contact lookup');
    }
    if (fields.some(f => f.name.includes('sku') || f.name.includes('id'))) {
      suggestions.push('Unique identifier detected - can be used to update existing records');
    }
    if (fields.some(f => f.type === 'currency')) {
      suggestions.push('Currency fields detected - will be formatted with $ symbol');
    }

    return {
      entityName,
      fields,
      confidence: avgConfidence,
      suggestions,
    };
  }

  /**
   * Generate column mappings
   */
  static generateMappings(
    headers: string[],
    rows: any[][],
    existingFields: string[] = []
  ): ColumnMapping[] {
    return headers.map((header, index) => {
      const columnValues = rows.map(row => row[index]).slice(0, 100);
      const detection = this.detectFieldType(columnValues);
      
      const fieldName = header
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Try to match with existing field
      const matchedField = existingFields.find(f => 
        f.toLowerCase() === fieldName ||
        f.toLowerCase().includes(fieldName) ||
        fieldName.includes(f.toLowerCase())
      );

      return {
        csvColumn: header,
        csvColumnIndex: index,
        targetField:matchedField ?? fieldName,
        fieldType: detection.type,
        isRequired: false,
        sampleValues: columnValues.slice(0, 5),
        detectedType: detection.type,
        confidence: detection.confidence,
      };
    });
  }

  /**
   * Validate import data
   */
  static validateData(
    rows: any[][],
    mappings: ColumnMapping[]
  ): { valid: boolean; errors: any[] } {
    const errors: any[] = [];

    rows.forEach((row, rowIndex) => {
      mappings.forEach(mapping => {
        const value = row[mapping.csvColumnIndex];

        // Check required fields
        if (mapping.isRequired && (!value || value === '')) {
          errors.push({
            row: rowIndex + 2, // +2 for header and 0-index
            column: mapping.csvColumn,
            message: 'Required field is empty',
            severity: 'error',
          });
        }

        // Validate by type
        if (value && value !== '') {
          if (mapping.fieldType === 'email' && !this.isValidEmail(value)) {
            errors.push({
              row: rowIndex + 2,
              column: mapping.csvColumn,
              message: 'Invalid email format',
              value,
              severity: 'warning',
            });
          }
          
          if (mapping.fieldType === 'number' && isNaN(Number(value))) {
            errors.push({
              row: rowIndex + 2,
              column: mapping.csvColumn,
              message: 'Invalid number format',
              value,
              severity: 'error',
            });
          }
        }
      });
    });

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
    };
  }

  /**
   * Transform value based on mapping
   */
  static transformValue(value: any, mapping: ColumnMapping): any {
    if (!value || value === '') {return mapping.defaultValue ?? null;}

    switch (mapping.transform) {
      case 'trim':
        return String(value).trim();
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'phone':
        return String(value).replace(/\D/g, '');
      case 'email':
        return String(value).toLowerCase().trim();
      case 'currency':
        return parseFloat(String(value).replace(/[$,]/g, ''));
      case 'date':
        return new Date(value).toISOString();
      default:
        return value;
    }
  }

  // Helper methods
  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}


