/**
 * Type definitions for API Error Handling
 * Purpose: Replace 'any' type usage in error formatting across API routes
 */

export interface ValidationErrorDetail {
  message: string;
  path?: string[];
  type?: string;
  code?: string;
  field?: string;
}

export interface APIErrorResponse {
  errors?: {
    errors?: ValidationErrorDetail[];
  };
  error?: {
    errors?: ValidationErrorDetail[];
  };
}

export interface ZodErrorDetail {
  message: string;
  path: (string | number)[];
  code: string;
}

export interface ValidationResult {
  success: boolean;
  error?: {
    errors: ZodErrorDetail[];
  };
  data?: unknown;
}

export interface FormattedErrorDetail {
  message: string;
  field?: string;
  code?: string;
}

/**
 * Helper function to format validation errors consistently
 */
export function formatValidationErrors(
  validationError: APIErrorResponse
): FormattedErrorDetail[] {
  const errors = validationError.errors?.errors ?? validationError.error?.errors ?? [];
  return errors.map((e: ValidationErrorDetail) => ({
    message: e.message,
    field: e.path?.join('.') ?? e.field,
    code: e.code ?? e.type,
  }));
}
