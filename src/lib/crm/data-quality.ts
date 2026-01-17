/**
 * Data Quality Scoring & Smart Suggestions
 * Analyzes CRM data quality and provides improvement suggestions
 */

import type { Lead } from './lead-service';
import { logger } from '@/lib/logger/logger';

export interface DataQualityScore {
  overall: number; // 0-100
  completeness: number;
  accuracy: number;
  consistency: number;
  issues: DataQualityIssue[];
  suggestions: DataQualitySuggestion[];
}

export interface DataQualityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  field: string;
  issue: string;
  impact: string;
}

export interface DataQualitySuggestion {
  field: string;
  suggestion: string;
  suggestedValue?: string | number | boolean;
  confidence: number; // 0-100
  source: string; // Where the suggestion came from
}

/**
 * Calculate data quality score for a lead
 */
export function calculateLeadDataQuality(lead: Partial<Lead>): DataQualityScore {
  const issues: DataQualityIssue[] = [];
  const suggestions: DataQualitySuggestion[] = [];

  // Check completeness
  let completenessScore = 0;
  const requiredFields = ['firstName', 'lastName', 'email'];
  const optionalFields = ['phone', 'company', 'title', 'source'];
  
  requiredFields.forEach(field => {
    if (lead[field as keyof Lead]) {
      completenessScore += 30;
    } else {
      issues.push({
        severity: 'critical',
        field,
        issue: `Missing required field: ${field}`,
        impact: 'Cannot effectively contact or qualify this lead',
      });
    }
  });

  optionalFields.forEach(field => {
    if (lead[field as keyof Lead]) {
      completenessScore += 10;
    } else {
      suggestions.push({
        field,
        suggestion: `Add ${field} to improve lead quality`,
        confidence: 80,
        source: 'Best Practices',
      });
    }
  });

  completenessScore = Math.min(100, completenessScore);

  // Check accuracy
  let accuracyScore = 100;

  // Email validation
  if (lead.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(lead.email)) {
      accuracyScore -= 30;
      issues.push({
        severity: 'critical',
        field: 'email',
        issue: 'Invalid email format',
        impact: 'Cannot send emails to this lead',
      });
    }
  }

  // Phone validation
  if (lead.phone) {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      accuracyScore -= 15;
      issues.push({
        severity: 'medium',
        field: 'phone',
        issue: 'Phone number appears incomplete',
        impact: 'May not be able to reach lead by phone',
      });
    }
    
    // Suggest formatting
    if (cleanPhone.length === 10) {
      const formatted = `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
      if (lead.phone !== formatted) {
        suggestions.push({
          field: 'phone',
          suggestion: 'Format phone number consistently',
          suggestedValue: formatted,
          confidence: 95,
          source: 'Auto-formatting',
        });
      }
    }
  }

  // Name validation
  if (lead.firstName && lead.firstName.length < 2) {
    accuracyScore -= 10;
    issues.push({
      severity: 'low',
      field: 'firstName',
      issue: 'First name seems too short',
      impact: 'May be an abbreviation or typo',
    });
  }

  // Check consistency
  let consistencyScore = 100;

  // Capitalize names
  if (lead.firstName && lead.firstName !== capitalizeFirst(lead.firstName)) {
    consistencyScore -= 5;
    suggestions.push({
      field: 'firstName',
      suggestion: 'Capitalize first name',
      suggestedValue: capitalizeFirst(lead.firstName),
      confidence: 100,
      source: 'Auto-formatting',
    });
  }

  if (lead.lastName && lead.lastName !== capitalizeFirst(lead.lastName)) {
    consistencyScore -= 5;
    suggestions.push({
      field: 'lastName',
      suggestion: 'Capitalize last name',
      suggestedValue: capitalizeFirst(lead.lastName),
      confidence: 100,
      source: 'Auto-formatting',
    });
  }

  // Email and company domain consistency
  if (lead.email && lead.company) {
    const emailDomain = lead.email.split('@')[1]?.toLowerCase();
    const companyName = lead.company.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (emailDomain && !emailDomain.includes(companyName) && !companyName.includes(emailDomain.split('.')[0])) {
      suggestions.push({
        field: 'company',
        suggestion: 'Email domain doesn\'t match company name - verify company is correct',
        confidence: 60,
        source: 'Cross-field validation',
      });
    }
  }

  // Overall score (weighted average)
  const overall = Math.round(
    completenessScore * 0.4 +
    accuracyScore * 0.4 +
    consistencyScore * 0.2
  );

  return {
    overall,
    completeness: Math.round(completenessScore),
    accuracy: Math.round(accuracyScore),
    consistency: Math.round(consistencyScore),
    issues,
    suggestions,
  };
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Auto-fix common data quality issues
 */
export function autoFixLeadData(lead: Partial<Lead>): { fixed: Partial<Lead>; changes: string[] } {
  const fixed = { ...lead };
  const changes: string[] = [];

  // Capitalize names
  if (fixed.firstName) {
    const capitalized = capitalizeFirst(fixed.firstName);
    if (capitalized !== fixed.firstName) {
      fixed.firstName = capitalized;
      changes.push('Capitalized first name');
    }
  }

  if (fixed.lastName) {
    const capitalized = capitalizeFirst(fixed.lastName);
    if (capitalized !== fixed.lastName) {
      fixed.lastName = capitalized;
      changes.push('Capitalized last name');
    }
  }

  // Format phone
  if (fixed.phone) {
    const cleanPhone = fixed.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      const formatted = `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
      if (formatted !== fixed.phone) {
        fixed.phone = formatted;
        changes.push('Formatted phone number');
      }
    }
  }

  // Trim whitespace
  Object.keys(fixed).forEach(key => {
    const leadKey = key as keyof Lead;
    const value = fixed[leadKey];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== value) {
        (fixed as Record<string, unknown>)[key] = trimmed;
        changes.push(`Trimmed whitespace from ${key}`);
      }
    }
  });

  logger.info('Auto-fixed lead data', { changes: changes.length });

  return { fixed, changes };
}

/**
 * Batch analyze data quality for multiple leads
 */
export function analyzeBatchDataQuality(leads: Partial<Lead>[]): {
  averageScore: number;
  criticalIssues: number;
  needsEnrichment: number;
  readyToContact: number;
} {
  let totalScore = 0;
  let criticalIssues = 0;
  let needsEnrichment = 0;
  let readyToContact = 0;

  leads.forEach(lead => {
    const quality = calculateLeadDataQuality(lead);
    totalScore += quality.overall;
    
    criticalIssues += quality.issues.filter(i => i.severity === 'critical').length;
    
    if (quality.completeness < 60) {
      needsEnrichment++;
    }
    
    if (quality.overall >= 80 && lead.email && lead.phone) {
      readyToContact++;
    }
  });

  return {
    averageScore: leads.length > 0 ? Math.round(totalScore / leads.length) : 0,
    criticalIssues,
    needsEnrichment,
    readyToContact,
  };
}

