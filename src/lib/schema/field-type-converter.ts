/**
 * Field Type Converter
 * Handles field type changes with smart conversion and user preview
 */

import type { FieldType } from '@/types/schema';
import { logger } from '@/lib/logger/logger';

/**
 * Type conversion result
 */
export interface TypeConversionResult {
  successful: number;
  failed: number;
  failedRecords: Array<{
    recordId: string;
    oldValue: unknown;
    error: string;
  }>;
  preview: TypeConversionPreview[];
}

/**
 * Type conversion preview
 */
export interface TypeConversionPreview {
  recordId: string;
  before: unknown;
  after: unknown;
  status: 'success' | 'fail' | 'warning';
  message?: string;
}

/**
 * Field Type Converter
 */
export class FieldTypeConverter {
  /**
   * Check if type conversion is "safe" (auto-convertible)
   */
  static isSafeConversion(oldType: FieldType, newType: FieldType): boolean {
    const safeConversions: Partial<Record<FieldType, FieldType[]>> = {
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
    
    return safeConversions[oldType]?.includes(newType) ?? false;
  }
  
  /**
   * Generate conversion preview
   */
  static async generateConversionPreview(
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
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { PLATFORM_ID } = await import('@/lib/constants/platform');

      // Get schema
      const schema = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
        schemaId
      );

      if (!schema) {
        throw new Error('Schema not found');
      }

      const schemaData = schema as Record<string, unknown>;
      const schemaName = typeof schemaData.name === 'string' ? schemaData.name : 'unknown';
      const entityPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/entities/${schemaName}/${COLLECTIONS.RECORDS}`;

      // Get sample records
      const records = await FirestoreService.getAll(entityPath);
      const totalRecords = records.length;

      // Sample records for preview
      const sampleRecords = records.slice(0, sampleSize);

      const preview: TypeConversionPreview[] = [];
      let successCount = 0;
      const _failureCount = 0;

      for (const record of sampleRecords) {
        const recordData = record as Record<string, unknown>;
        const oldValue = recordData[fieldKey];
        const conversion = this.convertValue(oldValue, oldType, newType);

        const recordId = typeof recordData.id === 'string' ? recordData.id : 'unknown';
        preview.push({
          recordId,
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
      
    } catch (error) {
      logger.error('[Field Type Converter] Failed to generate preview', error instanceof Error ? error : new Error(String(error)), {
        file: 'field-type-converter.ts',
      });
      throw error;
    }
  }
  
  /**
   * Convert field type for all records
   */
  static async convertFieldType(
    workspaceId: string,
    schemaId: string,
    fieldKey: string,
    oldType: FieldType,
    newType: FieldType
  ): Promise<TypeConversionResult> {
    const result: TypeConversionResult = {
      successful: 0,
      failed: 0,
      failedRecords: [],
      preview: [],
    };

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { PLATFORM_ID } = await import('@/lib/constants/platform');

      // Get schema
      const schema = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
        schemaId
      );

      if (!schema) {
        throw new Error('Schema not found');
      }

      const schemaData = schema as Record<string, unknown>;
      const schemaName = typeof schemaData.name === 'string' ? schemaData.name : 'unknown';
      const entityPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/entities/${schemaName}/${COLLECTIONS.RECORDS}`;

      // Get all records
      const records = await FirestoreService.getAll(entityPath);

      // Convert each record
      for (const record of records) {
        const recordData = record as Record<string, unknown>;
        const oldValue = recordData[fieldKey];
        const conversion = this.convertValue(oldValue, oldType, newType);

        const recordId = typeof recordData.id === 'string' ? recordData.id : 'unknown';

        if (conversion.success) {
          // Update record
          recordData[fieldKey] = conversion.value;
          await FirestoreService.set(entityPath, recordId, recordData, false);
          result.successful++;
        } else {
          result.failed++;
          result.failedRecords.push({
            recordId,
            oldValue,
            error:(conversion.message !== '' && conversion.message != null) ? conversion.message : 'Conversion failed',
          });
        }
      }
      
      logger.info('[Field Type Converter] Conversion complete', {
        file: 'field-type-converter.ts',
        successful: result.successful,
        failed: result.failed,
      });
      
    } catch (error) {
      logger.error('[Field Type Converter] Conversion failed', error instanceof Error ? error : new Error(String(error)), {
        file: 'field-type-converter.ts',
      });
      throw error;
    }
    
    return result;
  }
  
  /**
   * Convert a single value
   */
  private static convertValue(
    value: unknown,
    oldType: FieldType,
    newType: FieldType
  ): { success: boolean; value: unknown; message?: string } {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return { success: true, value: null };
    }
    
    try {
      // Text conversions
      if (oldType === 'text' && newType === 'longText') {
        return { success: true, value: String(value) };
      }
      
      if (oldType === 'longText' && newType === 'text') {
        const text = String(value);
        if (text.length > 255) {
          return {
            success: false,
            value: text.substring(0, 255),
            message: 'Text truncated (exceeded 255 chars)',
          };
        }
        return { success: true, value: text };
      }
      
      if ((oldType === 'text' || oldType === 'longText') && newType === 'email') {
        const text = String(value);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          return { success: false, value, message: 'Invalid email format' };
        }
        return { success: true, value: text };
      }
      
      // Number conversions
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
      
      if (oldType === 'number' && newType === 'percent') {
        return { success: true, value: Number(value) };
      }
      
      if (oldType === 'currency' && newType === 'percent') {
        return { success: true, value: Number(value) };
      }
      
      if ((oldType === 'number' || oldType === 'currency') && newType === 'text') {
        return { success: true, value: String(value) };
      }
      
      // Date conversions
      if (oldType === 'date' && newType === 'dateTime') {
        return { success: true, value: value }; // Date can become datetime
      }
      
      if (oldType === 'dateTime' && newType === 'date') {
        return { success: true, value: value }; // Datetime can become date (loses time)
      }
      
      // Select conversions
      if (oldType === 'singleSelect' && newType === 'text') {
        return { success: true, value: String(value) };
      }
      
      if (oldType === 'checkbox' && newType === 'text') {
        return { success: true, value: value ? 'Yes' : 'No' };
      }
      
      // Default: no conversion available
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
  
  /**
   * Create type conversion notification for user approval
   */
  static async createConversionApprovalRequest(
    workspaceId: string,
    schemaId: string,
    fieldKey: string,
    fieldLabel: string,
    oldType: FieldType,
    newType: FieldType,
    preview: {
      preview: TypeConversionPreview[];
      totalRecords: number;
      estimatedSuccess: number;
      estimatedFailures: number;
    }
  ): Promise<string> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { PLATFORM_ID } = await import('@/lib/constants/platform');

      const notificationPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/notifications`;
      const notificationId = `notif_typeconv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const successRate = preview.totalRecords > 0
        ? Math.round((preview.estimatedSuccess / preview.totalRecords) * 100)
        : 0;

      await FirestoreService.set(
        notificationPath,
        notificationId,
        {
          id: notificationId,
          workspaceId,
          title: 'Field Type Change Requires Approval',
          message: `Changing field "${fieldLabel}" from ${oldType} to ${newType} will affect ${preview.totalRecords} records. Estimated success rate: ${successRate}%`,
          type: 'warning',
          category: 'field_type_conversion',
          metadata: {
            schemaId,
            fieldKey,
            fieldLabel,
            oldType,
            newType,
            preview: preview.preview,
            totalRecords: preview.totalRecords,
            estimatedSuccess: preview.estimatedSuccess,
            estimatedFailures: preview.estimatedFailures,
            successRate,
          },
          actions: [
            {
              label: 'Review Preview',
              action: 'show_preview',
            },
            {
              label: 'Approve Conversion',
              action: 'approve',
              dangerous: preview.estimatedFailures > 0,
            },
            {
              label: 'Cancel',
              action: 'cancel',
            },
          ],
          read: false,
          requiresAction: true,
          createdAt: new Date().toISOString(),
        },
        false
      );
      
      logger.info('[Field Type Converter] Created approval request', {
        file: 'field-type-converter.ts',
        notificationId,
        successRate,
      });
      
      return notificationId;
      
    } catch (error) {
      logger.error('[Field Type Converter] Failed to create approval request', error instanceof Error ? error : new Error(String(error)), {
        file: 'field-type-converter.ts',
      });
      throw error;
    }
  }
}

