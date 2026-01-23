/**
 * Custom Transform Functions Registry
 * Provides safe, pre-defined custom transformation functions
 * WITHOUT executing arbitrary user code (security-first approach)
 */

import { logger } from '@/lib/logger/logger';

/**
 * Transform parameters type - allows primitive values and nested structures
 */
export interface TransformParams {
  [key: string]: string | number | boolean | null | undefined | TransformParams;
}

/**
 * Custom transform function signature
 */
export type CustomTransformFunction = (value: unknown, params?: TransformParams) => unknown;

/**
 * Registry of safe custom transform functions
 */
const CUSTOM_TRANSFORMS: Record<string, CustomTransformFunction> = {
  /**
   * Extract domain from email
   * Example: "john@example.com" → "example.com"
   */
  extractDomain: (value: unknown): unknown => {
    const email = String(value);
    const match = email.match(/@(.+)$/);
    return match ? match[1] : value;
  },

  /**
   * Extract first name from full name
   * Example: "John Doe" → "John"
   */
  extractFirstName: (value: unknown): unknown => {
    const fullName = String(value).trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts[0];
    return (firstName !== '' && firstName != null) ? firstName : value;
  },

  /**
   * Extract last name from full name
   * Example: "John Doe Smith" → "Smith"
   */
  extractLastName: (value: unknown): unknown => {
    const fullName = String(value).trim();
    const parts = fullName.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : value;
  },

  /**
   * Format phone number to E.164 format
   * Example: "(555) 123-4567" → "+15551234567"
   */
  formatPhoneE164: (value: unknown, params?: TransformParams): string => {
    const phone = String(value).replace(/\D/g, '');
    const countryCode = (params?.countryCode !== '' && params?.countryCode != null) ? String(params.countryCode) : '1';

    if (phone.length === 10) {
      return `+${countryCode}${phone}`;
    }

    return phone.startsWith('+') ? phone : `+${phone}`;
  },

  /**
   * Extract numbers from text
   * Example: "Order #12345" → "12345"
   */
  extractNumbers: (value: unknown): unknown => {
    const text = String(value);
    const numbers = text.replace(/\D/g, '');
    return (numbers !== '' && numbers != null) ? numbers : value;
  },

  /**
   * Extract letters only
   * Example: "ABC123DEF" → "ABCDEF"
   */
  extractLetters: (value: unknown): unknown => {
    const text = String(value);
    const letters = text.replace(/[^a-zA-Z]/g, '');
    return (letters !== '' && letters != null) ? letters : value;
  },

  /**
   * Convert to title case
   * Example: "hello world" → "Hello World"
   */
  titleCase: (value: unknown): string => {
    const text = String(value);
    return text.replace(/\w\S*/g, (word) => {
      return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    });
  },

  /**
   * Convert to sentence case
   * Example: "hello world. goodbye world." → "Hello world. Goodbye world."
   */
  sentenceCase: (value: unknown): string => {
    const text = String(value);
    return text.replace(/(^\w|\.\s+\w)/g, (match) => match.toUpperCase());
  },

  /**
   * Truncate text to max length
   */
  truncate: (value: unknown, params?: TransformParams): string => {
    const text = String(value);
    const maxLength = typeof params?.maxLength === 'number' ? params.maxLength : 100;
    const suffix = (params?.suffix !== '' && params?.suffix != null) ? String(params.suffix) : '...';

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
  },

  /**
   * Pad string with characters
   */
  pad: (value: unknown, params?: TransformParams): string => {
    const text = String(value);
    const length = typeof params?.length === 'number' ? params.length : 10;
    const char = (params?.char !== '' && params?.char != null) ? String(params.char) : ' ';
    const side = (params?.side !== '' && params?.side != null) ? String(params.side) : 'left';

    if (side === 'left') {
      return text.padStart(length, char);
    } else if (side === 'right') {
      return text.padEnd(length, char);
    }

    return text;
  },

  /**
   * Calculate age from birthdate
   */
  calculateAge: (value: unknown): number => {
    const birthDate = new Date(String(value));
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  },

  /**
   * Format date relative to now
   * Example: "2 days ago", "in 3 hours"
   */
  relativeDate: (value: unknown): string => {
    const date = new Date(String(value));
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSec = Math.abs(diffMs / 1000);
    const diffMin = diffSec / 60;
    const diffHour = diffMin / 60;
    const diffDay = diffHour / 24;

    const isPast = diffMs < 0;
    const prefix = isPast ? '' : 'in ';
    const suffix = isPast ? ' ago' : '';

    if (diffSec < 60) {
      return `${prefix}${Math.round(diffSec)} seconds${suffix}`;
    } else if (diffMin < 60) {
      return `${prefix}${Math.round(diffMin)} minutes${suffix}`;
    } else if (diffHour < 24) {
      return `${prefix}${Math.round(diffHour)} hours${suffix}`;
    } else {
      return `${prefix}${Math.round(diffDay)} days${suffix}`;
    }
  },

  /**
   * Convert currency between formats
   */
  convertCurrency: (value: unknown, params?: TransformParams): unknown => {
    const amount = parseFloat(String(value).replace(/[^0-9.-]/g, ''));

    if (isNaN(amount)) {
      return value;
    }

    const rate = typeof params?.rate === 'number' ? params.rate : 1;
    const symbol = (params?.symbol !== '' && params?.symbol != null) ? String(params.symbol) : '$';
    const decimals = params?.decimals !== undefined ? (typeof params.decimals === 'number' ? params.decimals : 2) : 2;

    const converted = amount * rate;
    return `${symbol}${converted.toFixed(decimals)}`;
  },

  /**
   * Hash value (for privacy/obfuscation)
   */
  hash: (value: unknown): string => {
    const text = String(value);
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  },

  /**
   * Mask sensitive data
   * Example: "1234567890" → "******7890"
   */
  mask: (value: unknown, params?: TransformParams): string => {
    const text = String(value);
    const visibleChars = typeof params?.visibleChars === 'number' ? params.visibleChars : 4;
    const maskChar = (params?.maskChar !== '' && params?.maskChar != null) ? String(params.maskChar) : '*';

    if (text.length <= visibleChars) {
      return text;
    }

    const masked = maskChar.repeat(text.length - visibleChars);
    return masked + text.slice(-visibleChars);
  },

  /**
   * Generate initials from name
   * Example: "John Doe Smith" → "JDS"
   */
  initials: (value: unknown): string => {
    const name = String(value).trim();
    const words = name.split(/\s+/);
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  },

  /**
   * Slugify text (URL-friendly)
   * Example: "Hello World!" → "hello-world"
   */
  slugify: (value: unknown): string => {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Parse JSON string
   */
  parseJson: (value: unknown): unknown => {
    try {
      return JSON.parse(String(value));
    } catch {
      return value;
    }
  },

  /**
   * Stringify to JSON
   */
  toJson: (value: unknown, params?: TransformParams): string => {
    const indent = params?.indent !== undefined ? (typeof params.indent === 'number' ? params.indent : 0) : 0;

    try {
      return JSON.stringify(value, null, indent);
    } catch {
      return String(value);
    }
  },

  /**
   * Encode to Base64
   */
  base64Encode: (value: unknown): unknown => {
    try {
      return Buffer.from(String(value)).toString('base64');
    } catch {
      return value;
    }
  },

  /**
   * Decode from Base64
   */
  base64Decode: (value: unknown): unknown => {
    try {
      return Buffer.from(String(value), 'base64').toString('utf-8');
    } catch {
      return value;
    }
  },

  /**
   * URL encode
   */
  urlEncode: (value: unknown): string => {
    return encodeURIComponent(String(value));
  },

  /**
   * URL decode
   */
  urlDecode: (value: unknown): unknown => {
    try {
      return decodeURIComponent(String(value));
    } catch {
      return value;
    }
  },

  /**
   * Coalesce (return first non-null value)
   */
  coalesce: (value: unknown, params?: TransformParams): unknown => {
    const fallbackParam = params?.fallback;
    const fallback = (fallbackParam !== '' && fallbackParam != null) ? fallbackParam : '';
    return value !== null && value !== undefined && value !== '' ? value : fallback;
  },

  /**
   * Conditional transform
   */
  conditional: (value: unknown, params?: TransformParams): unknown => {
    const condition = params?.condition;
    const trueValue = params?.trueValue;
    const falseValue = params?.falseValue;

    // Simple equality check
    if (value === condition) {
      return trueValue !== undefined ? trueValue : value;
    }

    return falseValue !== undefined ? falseValue : value;
  },
};

/**
 * Execute a custom transform function
 */
export function executeCustomTransform(
  functionName: string,
  value: unknown,
  params?: TransformParams
): { success: boolean; value: unknown; error?: string } {
  try {
    const transformFn = CUSTOM_TRANSFORMS[functionName];

    if (!transformFn) {
      logger.warn('[Custom Transforms] Transform function not found', {
        functionName,
        file: 'custom-transforms.ts',
      });

      return {
        success: false,
        value,
        error: `Transform function '${functionName}' not found`,
      };
    }

    const result: unknown = transformFn(value, params);

    logger.debug('[Custom Transforms] Transform executed', {
      functionName,
      inputValue: typeof value === 'object' ? JSON.stringify(value) : String(value),
      outputValue: typeof result === 'object' ? JSON.stringify(result) : String(result),
      file: 'custom-transforms.ts',
    });

    return {
      success: true,
      value: result as string | number | boolean | null | undefined | Record<string, unknown>,
    };

  } catch (error: unknown) {
    logger.error('[Custom Transforms] Transform execution failed', error instanceof Error ? error : new Error(String(error)), {
      functionName,
      paramsJson: params ? JSON.stringify(params) : undefined,
      file: 'custom-transforms.ts',
    });

    return {
      success: false,
      value,
      error: error instanceof Error ? error.message : 'Transform failed',
    };
  }
}

/**
 * Get list of available custom transforms
 */
export function getAvailableCustomTransforms(): Array<{
  name: string;
  description: string;
  params?: Record<string, string>;
}> {
  return [
    { name: 'extractDomain', description: 'Extract domain from email address' },
    { name: 'extractFirstName', description: 'Extract first name from full name' },
    { name: 'extractLastName', description: 'Extract last name from full name' },
    { name: 'formatPhoneE164', description: 'Format phone to E.164', params: { countryCode: 'Country code (default: 1)' } },
    { name: 'extractNumbers', description: 'Extract only numbers from text' },
    { name: 'extractLetters', description: 'Extract only letters from text' },
    { name: 'titleCase', description: 'Convert to Title Case' },
    { name: 'sentenceCase', description: 'Convert to sentence case' },
    { name: 'truncate', description: 'Truncate text', params: { maxLength: 'Max length', suffix: 'Suffix (default: ...)' } },
    { name: 'pad', description: 'Pad string', params: { length: 'Target length', char: 'Pad character', side: 'left or right' } },
    { name: 'calculateAge', description: 'Calculate age from birthdate' },
    { name: 'relativeDate', description: 'Format date relative to now' },
    { name: 'convertCurrency', description: 'Convert currency', params: { rate: 'Exchange rate', symbol: 'Currency symbol', decimals: 'Decimal places' } },
    { name: 'hash', description: 'Hash value for obfuscation' },
    { name: 'mask', description: 'Mask sensitive data', params: { visibleChars: 'Visible characters', maskChar: 'Mask character' } },
    { name: 'initials', description: 'Generate initials from name' },
    { name: 'slugify', description: 'Create URL-friendly slug' },
    { name: 'parseJson', description: 'Parse JSON string' },
    { name: 'toJson', description: 'Convert to JSON string', params: { indent: 'Indentation spaces' } },
    { name: 'base64Encode', description: 'Encode to Base64' },
    { name: 'base64Decode', description: 'Decode from Base64' },
    { name: 'urlEncode', description: 'URL encode string' },
    { name: 'urlDecode', description: 'URL decode string' },
    { name: 'coalesce', description: 'Return first non-null value', params: { fallback: 'Fallback value' } },
    { name: 'conditional', description: 'Conditional value', params: { condition: 'Condition to match', trueValue: 'Value if true', falseValue: 'Value if false' } },
  ];
}

/**
 * Validate custom transform exists
 */
export function validateCustomTransform(functionName: string): boolean {
  return functionName in CUSTOM_TRANSFORMS;
}


