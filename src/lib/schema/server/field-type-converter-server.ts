/**
 * Field Type Converter - SERVER SIDE (Admin SDK)
 * For use in API routes only
 */

import { db } from '@/lib/firebase-admin';
import { getOrgSubCollection } from '@/lib/firebase/collections';
import type { FieldType } from '@/types/schema';

/**
 * Record from Firestore with dynamic fields and standard metadata
 */
interface FirestoreRecord {
  id: string;
  [fieldKey: string]: unknown;
}

export interface TypeConversionPreview {
  recordId: string;
  before: unknown;
  after: unknown;
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
    // Get schema (using environment-aware paths)
    const schemasPath = getOrgSubCollection('schemas');
    const schemaDoc = await db
      .collection(schemasPath)
      .doc(schemaId)
      .get();

    if (!schemaDoc.exists) {
      throw new Error('Schema not found');
    }

    const schema = schemaDoc.data() as { name?: string } | undefined;
    const schemaName = schema?.name;

    if (!schemaName) {
      throw new Error('Schema name not found');
    }

    // Get records (using environment-aware paths for nested entities)
    const { getPrefix } = await import('@/lib/firebase/collections');
    const entitiesPath = getOrgSubCollection('entities');
    const recordsPath = `${getPrefix()}records`;
    const recordsSnapshot = await db
      .collection(`${entitiesPath}/${schemaName}/${recordsPath}`)
      .limit(Math.max(sampleSize, 100))
      .get();
    
    const records: FirestoreRecord[] = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalRecords = recordsSnapshot.size;

    // Sample records for preview
    const sampleRecords = records.slice(0, sampleSize);

    const preview: TypeConversionPreview[] = [];
    let successCount = 0;

    for (const record of sampleRecords) {
      const oldValue = record[fieldKey];
      const conversion = this.convertValue(oldValue, oldType, newType);

      preview.push({
        recordId: record.id,
        before: oldValue,
        after: conversion.value,
        status: conversion.success ? 'success' : 'fail',
        message: conversion.message,
      });

      if (conversion.success) {
        successCount++;
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
    value: unknown,
    oldType: FieldType,
    newType: FieldType
  ): { success: boolean; value: unknown; message?: string } {
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

