/**
 * Data Validation Service
 * Validates enriched data for accuracy and consistency
 * Prevents bad/fake data from being stored
 */

import type { CompanyEnrichmentData } from './types';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-100
  errors: string[];
  warnings: string[];
  checks: {
    domainValid: boolean;
    emailValid: boolean;
    phoneValid: boolean;
    dataConsistent: boolean;
    sourcesReliable: boolean;
  };
}

/**
 * Validate enriched company data
 */
export async function validateEnrichmentData(
  data: CompanyEnrichmentData
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check 1: Domain validation
  const domainValid = await validateDomain(data.domain);
  if (!domainValid) {
    errors.push(`Domain ${data.domain} does not exist or is unreachable`);
  }
  
  // Check 2: Email validation
  const emailValid = data.contactEmail ? validateEmail(data.contactEmail) : true;
  if (data.contactEmail && !emailValid) {
    warnings.push(`Email ${data.contactEmail} format is invalid`);
  }
  
  // Check 3: Phone validation
  const phoneValid = data.contactPhone ? validatePhone(data.contactPhone) : true;
  if (data.contactPhone && !phoneValid) {
    warnings.push(`Phone ${data.contactPhone} format is invalid`);
  }
  
  // Check 4: Data consistency
  const consistencyChecks = validateConsistency(data);
  consistencyChecks.errors.forEach(e => errors.push(e));
  consistencyChecks.warnings.forEach(w => warnings.push(w));
  
  // Check 5: Required fields
  if (!data.name || data.name === 'Unknown') {
    errors.push('Company name is missing or invalid');
  }
  
  if (!data.website || !data.domain) {
    errors.push('Website/domain is missing');
  }
  
  // Calculate confidence score
  let confidence = 100;
  
  // Deduct points for errors and warnings
  confidence -= errors.length * 20;
  confidence -= warnings.length * 5;
  
  // Deduct for missing data
  if (!data.description || data.description.length < 20) confidence -= 10;
  if (!data.industry || data.industry === 'Unknown') confidence -= 10;
  if (!data.employeeCount && !data.employeeRange) confidence -= 5;
  if (!data.headquarters?.city) confidence -= 5;
  if (!data.socialMedia?.linkedin) confidence -= 5;
  
  // Add points for extra data
  if (data.techStack && data.techStack.length > 0) confidence += 5;
  if (data.recentNews && data.recentNews.length > 0) confidence += 5;
  if (data.fundingStage) confidence += 5;
  if (data.revenue) confidence += 5;
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    confidence,
    errors,
    warnings,
    checks: {
      domainValid,
      emailValid,
      phoneValid,
      dataConsistent: consistencyChecks.errors.length === 0,
      sourcesReliable: data.dataSource !== 'fallback',
    },
  };
}

/**
 * Validate domain exists and is reachable
 */
async function validateDomain(domain: string): Promise<boolean> {
  try {
    // Try HTTP request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status < 500; // Even 404 means domain exists
  } catch (error: any) {
    // Domain doesn't exist or is unreachable
    return false;
  }
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Check for common fake/placeholder emails
  const fakeEmails = [
    'test@test.com',
    'admin@admin.com',
    'info@info.com',
    'contact@contact.com',
    'example@example.com',
    'noreply@',
  ];
  
  const lowerEmail = email.toLowerCase();
  if (fakeEmails.some(fake => lowerEmail.includes(fake))) {
    return false;
  }
  
  return true;
}

/**
 * Validate phone number format
 */
function validatePhone(phone: string): boolean {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
  
  // Should be 10-15 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }
  
  // Should be all digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }
  
  // Check for obviously fake numbers
  const fakePatterns = [
    '0000000000',
    '1111111111',
    '1234567890',
    '9999999999',
  ];
  
  if (fakePatterns.includes(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Validate data consistency
 */
function validateConsistency(data: CompanyEnrichmentData): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check employee count matches size category
  if (data.employeeCount) {
    const count = data.employeeCount;
    
    if (data.size === 'startup' && count >= 50) {
      warnings.push(`Employee count (${count}) doesn't match size category (startup)`);
    } else if (data.size === 'small' && (count < 50 || count > 200)) {
      warnings.push(`Employee count (${count}) doesn't match size category (small)`);
    } else if (data.size === 'medium' && (count < 200 || count > 1000)) {
      warnings.push(`Employee count (${count}) doesn't match size category (medium)`);
    } else if (data.size === 'enterprise' && count < 1000) {
      warnings.push(`Employee count (${count}) doesn't match size category (enterprise)`);
    }
  }
  
  // Check founded year is reasonable
  if (data.foundedYear) {
    const currentYear = new Date().getFullYear();
    
    if (data.foundedYear < 1800) {
      errors.push(`Founded year (${data.foundedYear}) is unrealistically old`);
    } else if (data.foundedYear > currentYear) {
      errors.push(`Founded year (${data.foundedYear}) is in the future`);
    } else if (data.foundedYear > currentYear - 1) {
      warnings.push(`Company founded very recently (${data.foundedYear})`);
    }
  }
  
  // Check domain matches website
  if (data.website && data.domain) {
    try {
      const websiteHost = new URL(data.website).hostname.replace('www.', '');
      const domain = data.domain.replace('www.', '');
      
      if (websiteHost !== domain) {
        warnings.push(`Website hostname (${websiteHost}) doesn't match domain (${domain})`);
      }
    } catch {
      errors.push(`Website URL (${data.website}) is malformed`);
    }
  }
  
  // Check email domain matches company domain
  if (data.contactEmail && data.domain) {
    const emailDomain = data.contactEmail.split('@')[1];
    
    if (emailDomain !== data.domain) {
      // Could be fine (using Gmail, etc.) but worth noting
      warnings.push(`Email domain (${emailDomain}) doesn't match company domain (${data.domain})`);
    }
  }
  
  // Check description quality
  if (data.description) {
    if (data.description.length < 20) {
      warnings.push('Description is very short');
    }
    
    // Check for placeholder text
    const placeholders = ['lorem ipsum', 'coming soon', 'under construction'];
    if (placeholders.some(p => data.description.toLowerCase().includes(p))) {
      errors.push('Description contains placeholder text');
    }
  }
  
  return { errors, warnings };
}

/**
 * Verify email domain exists (simplified - no DNS dependency)
 */
export async function verifyEmailDomain(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1];
    
    // Simple check - verify domain responds to HTTP
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return true; // Domain exists
  } catch {
    return false; // Domain doesn't exist
  }
}

/**
 * Check if domain is on a common disposable email list
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  
  const disposableDomains = [
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    'temp-mail.org',
  ];
  
  return disposableDomains.includes(domain);
}
