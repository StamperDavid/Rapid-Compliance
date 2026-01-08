/**
 * Centralized error formatting utilities
 * Purpose: Eliminate unsafe || patterns and provide consistent error handling
 */

import type { ValidationErrorDetail } from '@/types/api-errors';

interface ValidationError {
  path?: (string | number)[];
  message?: string;
}

interface FormattedError {
  path: string;
  message: string;
}

/**
 * Formats a validation error object into a standardized structure
 * @param error - The validation error from Zod or similar validator
 * @returns Formatted error with path and message
 */
export function formatValidationError(error: ValidationError): FormattedError {
  const pathStr = error.path?.join('.');
  const msgStr = error.message;
  
  return {
    path: (pathStr !== '' && pathStr != null) ? pathStr : 'unknown',
    message: (msgStr !== '' && msgStr != null) ? msgStr : 'Validation error',
  };
}

/**
 * Formats an array of validation errors
 * @param validationResult - The validation result object containing errors
 * @returns Array of formatted errors
 */
export function formatValidationErrors(validationResult: { success: false; errors: { errors?: ValidationErrorDetail[] } }): FormattedError[] {
  const errorDetails = validationResult.errors?.errors?.map((e: ValidationErrorDetail) => {
    return formatValidationError(e);
  }) ?? [];
  
  return errorDetails;
}

/**
 * Safely formats an error message string
 * @param message - The message to format
 * @param fallback - Default fallback message
 * @returns The formatted message or fallback
 */
export function formatErrorMessage(message: unknown, fallback = 'An error occurred'): string {
  if (typeof message === 'string' && message !== '' && message != null) {
    return message;
  }
  return fallback;
}
