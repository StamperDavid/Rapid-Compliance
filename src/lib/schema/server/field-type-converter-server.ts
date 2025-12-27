/**
 * Field Type Converter - SERVER SIDE (Admin SDK)
 * For use in API routes only
 */

import { db, admin } from '@/lib/firebase-admin';
import { FieldType } from '@/types/schema';

export interface TypeConversionPreview {
  recordId: string;
  before: any;
  after: any;
  status: 'success' | 'fail' | 'warning';
  message?: string;
}

export class FieldTypeConverterServer {
  /**
   * Check if type conversion is safe
   */
  static isSafeConversion(oldType: FieldType, newType: FieldType): boolean {
    const safeConversions: Record<string, string[]> = {
      'number': ['currency', 'percent'],
      'currency': ['number', 'percent'],
      'percent': ['number', 'currency'],
      'text': ['longText', 'email', 'url', 'phoneNumber'],
      'longText': ['text'],
      'date': ['dateTime'],
      'dateTime': ['date'],
      'singleSelect': ['text', 'longText'],
      'checkbox': ['text'],
    };
    
    return safeConversions[oldType]?.includes(newType) || false;
  }
  
  /**
   * Generate conversion preview (SERVER SIDE)
   */
  static async generateConversionPreview(
    organizationId: string,
    workspaceId: string,
    schemaId: string,
    fieldKey: string,
    oldType: FieldType,
    newType: FieldType,
    sampleSize: number = 10
  ): Promise<{
    preview: TypeConversionPreview[];
    totalRecords: number;
    estimatedSuccess: number;
    estimatedFailures: number;
  }> {
    const db = getFirestore();
    
    // Get schema
    const schemaDoc = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('schemas')
      .doc(schemaId)
      .get();
    
    if (!schemaDoc.exists) {
      throw new Error('Schema not found');
    }
    
    const schema = schemaDoc.data();
    const schemaName = schema?.name;
    
    if (!schemaName) {
      throw new Error('Schema name not found');
    }
    
    // Get records
    const recordsSnapshot = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('entities')
      .doc(schemaName)
      .collection('records')
      .limit(Math.max(sampleSize, 100))
      .get();
    
    const records = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalRecords = recordsSnapshot.size;
    
    // Sample records for preview
    const sampleRecords = records.slice(0, sampleSize);
    
    const preview: TypeConversionPreview[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const record of sampleRecords) {
      const oldValue = (record as any)[fieldKey];
      const conversion = this.convertValue(oldValue, oldType, newType);
      
      preview.push({
        recordId: (record as any).id,
        before: oldValue,
        after: conversion.value,
        status: conversion.success ? 'success' : 'fail',
        message: conversion.message,
      });
      
      if (conversion.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Estimate success rate for all records
    const successRate = sampleRecords.length > 0 ? successCount / sampleRecords.length : 0;
    
    return {
      preview,
      totalRecords,
      estimatedSuccess: Math.round(totalRecords * successRate),
      estimatedFailures: Math.round(totalRecords * (1 - successRate)),
    };
  }
  
  /**
   * Convert value (same logic as client version)
   */
  static convertValue(
    value: any,
    oldType: FieldType,
    newType: FieldType
  ): { success: boolean; value: any; message?: string } {
    if (value === null || value === undefined) {
      return { success: true, value: null };
    }
    
    try {
      // Text conversions
      if (oldType === 'text' && newType === 'longText') {
        return { success: true, value: String(value) };
      }
      
      if (oldType === 'text' && (newType === 'number' || newType === 'currency')) {
        const text = String(value);
        const numbers = text.replace(/[^0-9.-]/g, '');
        const num = parseFloat(numbers);
        
        if (isNaN(num)) {
          return { success: false, value, message: 'Could not extract number' };
        }
        return { success: true, value: num };
      }
      
      if (oldType === 'number' && newType === 'currency') {
        return { success: true, value: Number(value) };
      }
      
      if (oldType === 'currency' && newType === 'number') {
        return { success: true, value: Number(value) };
      }
      
      if ((oldType === 'number' || oldType === 'currency') && newType === 'text') {
        return { success: true, value: String(value) };
      }
      
      // Default: no conversion
      return {
        success: false,
        value,
        message: `No conversion from ${oldType} to ${newType}`,
      };
      
    } catch (error) {
      return {
        success: false,
        value,
        message: `Conversion error: ${error}`,
      };
    }
  }
}

