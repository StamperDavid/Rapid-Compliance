/**
 * Mutation Engine
 * 
 * Compiles IndustryTemplate + OnboardingData → Mutated Template (BaseModel input)
 * 
 * Core Responsibilities:
 * 1. Deep merge template with onboarding-specific mutations
 * 2. Apply conditional rules based on customer profile
 * 3. Adjust signal weights mathematically
 * 4. Modify persona based on sales methodology
 * 
 * Design Principles:
 * - Immutable: Never modifies original template
 * - Predictable: Same inputs always produce same output
 * - Testable: All mutations are verifiable through unit tests
 */

import type { IndustryTemplate, MutationRule } from '@/lib/persona/templates/types';
import type { OnboardingData } from '@/types/agent-memory';
import { logger } from '@/lib/logger/logger';

export class MutationEngine {
  /**
   * Compile template with onboarding data
   * 
   * @param template - Industry template (genetic blueprint)
   * @param onboarding - Client onboarding data
   * @returns Mutated template ready for BaseModel conversion
   */
  compile(
    template: IndustryTemplate,
    onboarding: OnboardingData
  ): IndustryTemplate {
    if (!onboarding) {
      throw new Error('Onboarding data is required');
    }

    logger.debug('[MutationEngine] Starting compilation', {
      templateId: template.id,
      businessName: onboarding.businessName
    });

    // Start with deep clone of template (immutable)
    let mutated = this.deepClone(template);

    // Apply global mutation rules
    mutated = this.applyGlobalRules(mutated, onboarding);

    // Apply template-specific mutation rules (if any)
    if ('mutationRules' in template && Array.isArray((template as any).mutationRules)) {
      mutated = this.applyTemplateRules(mutated, onboarding, (template as any).mutationRules as MutationRule[]);
    }

    logger.debug('[MutationEngine] Compilation complete', {
      templateId: template.id,
      mutationsApplied: true
    });

    return mutated;
  }

  /**
   * Apply global mutation rules that apply to ALL templates
   */
  private applyGlobalRules(
    template: IndustryTemplate,
    onboarding: OnboardingData
  ): IndustryTemplate {
    let mutated = { ...template };

    // Rule 1: Enterprise Focus - Boost hiring/expansion signals
    if (this.isEnterpriseFocus(onboarding)) {
      mutated = this.boostEnterpriseSignals(mutated);
    }

    // Rule 2: Aggressive Closing - Adjust persona tone
    if (onboarding.closingStyle && onboarding.closingStyle > 7) {
      mutated = this.adjustForAggressiveClosing(mutated);
    }

    // Rule 3: B2B Complexity - Adjust cognitive framework
    if (this.isB2BComplex(onboarding)) {
      mutated = this.adjustForB2BComplexity(mutated);
    }

    return mutated;
  }

  /**
   * Apply template-specific mutation rules
   */
  private applyTemplateRules(
    template: IndustryTemplate,
    onboarding: OnboardingData,
    rules: MutationRule[]
  ): IndustryTemplate {
    let mutated = { ...template };

    // Sort by priority (lower number = higher priority)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (rule.condition(onboarding)) {
        logger.debug('[MutationEngine] Applying rule', { ruleId: rule.id });
        mutated = this.applyMutations(mutated, rule.mutations);
      }
    }

    return mutated;
  }

  /**
   * Apply mutation operations to template
   */
  private applyMutations(
    template: IndustryTemplate,
    mutations: any[]
  ): IndustryTemplate {
    let mutated = this.deepClone(template);

    for (const mutation of mutations) {
      const { path, operation, value, skipIfMissing } = mutation;

      try {
        const currentValue = this.getValueAtPath(mutated, path);

        if (currentValue === undefined && skipIfMissing) {
          continue;
        }

        const newValue = this.calculateNewValue(currentValue, operation, value);
        this.setValueAtPath(mutated, path, newValue);
      } catch (error) {
        logger.warn('[MutationEngine] Mutation failed', {
          path,
          operation,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return mutated;
  }

  /**
   * Calculate new value based on operation
   */
  private calculateNewValue(current: any, operation: string, value: any): any {
    switch (operation) {
      case 'add':
        return (current || 0) + value;
      case 'subtract':
        return (current || 0) - value;
      case 'multiply':
        return (current || 0) * value;
      case 'set':
        return value;
      case 'append':
        return Array.isArray(current) ? [...current, value] : [value];
      case 'prepend':
        return Array.isArray(current) ? [value, ...current] : [value];
      default:
        return current;
    }
  }

  /**
   * Get value at nested path
   */
  private getValueAtPath(obj: any, path: string): any {
    // Handle array notation like "highValueSignals[funding].scoreBoost"
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (!current) return undefined;

      // Check for array index notation [id]
      const arrayMatch = part.match(/^([^\[]+)\[([^\]]+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, idValue] = arrayMatch;
        const array = current[arrayKey];
        if (Array.isArray(array)) {
          current = array.find((item: any) => item.id === idValue);
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Set value at nested path
   */
  private setValueAtPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      // Handle array notation
      const arrayMatch = part.match(/^([^\[]+)\[([^\]]+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, idValue] = arrayMatch;
        const array = current[arrayKey];
        if (Array.isArray(array)) {
          current = array.find((item: any) => item.id === idValue);
        }
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  /**
   * Check if target customer is Enterprise
   */
  private isEnterpriseFocus(onboarding: OnboardingData): boolean {
    const targetCustomer = onboarding.targetCustomer?.toLowerCase() || '';
    return (
      targetCustomer.includes('enterprise') ||
      targetCustomer.includes('500+') ||
      targetCustomer.includes('large')
    );
  }

  /**
   * Check if target is B2B with complex procurement
   */
  private isB2BComplex(onboarding: OnboardingData): boolean {
    const targetCustomer = onboarding.targetCustomer?.toLowerCase() || '';
    return (
      targetCustomer.includes('b2b') ||
      targetCustomer.includes('procurement') ||
      targetCustomer.includes('rfp') ||
      targetCustomer.includes('business')
    );
  }

  /**
   * Boost signals relevant to Enterprise customers
   */
  private boostEnterpriseSignals(template: IndustryTemplate): IndustryTemplate {
    const mutated = this.deepClone(template);

    if (mutated.research?.highValueSignals) {
      mutated.research.highValueSignals = mutated.research.highValueSignals.map(signal => {
        // Boost signals related to growth, funding, hiring
        if (
          signal.id.includes('funding') ||
          signal.id.includes('hiring') ||
          signal.id.includes('expansion') ||
          signal.id.includes('new_location')
        ) {
          return {
            ...signal,
            scoreBoost: signal.scoreBoost + 3
          };
        }
        return signal;
      });
    }

    return mutated;
  }

  /**
   * Adjust template for aggressive closing methodology
   */
  private adjustForAggressiveClosing(template: IndustryTemplate): IndustryTemplate {
    const mutated = this.deepClone(template);

    // Adjust tone to be more direct
    if (mutated.coreIdentity) {
      mutated.coreIdentity.tone = 'Direct, urgent, action-oriented';
    }

    // Adjust conversion rhythm
    if (mutated.tacticalExecution) {
      mutated.tacticalExecution.conversionRhythm = 
        'Every message ends with a clear call-to-action and booking link';
    }

    // Boost urgency-related signals if present
    if (mutated.research?.highValueSignals) {
      mutated.research.highValueSignals = mutated.research.highValueSignals.map(signal => {
        if (signal.id.includes('hiring') || signal.id.includes('expansion')) {
          return {
            ...signal,
            scoreBoost: signal.scoreBoost + 2
          };
        }
        return signal;
      });
    }

    return mutated;
  }

  /**
   * Adjust cognitive framework for B2B complexity
   */
  private adjustForB2BComplexity(template: IndustryTemplate): IndustryTemplate {
    const mutated = this.deepClone(template);

    if (mutated.cognitiveLogic) {
      // Enhance framework for complex sales
      if (!mutated.cognitiveLogic.framework.includes('B2B')) {
        mutated.cognitiveLogic.framework = `B2B Enterprise: ${mutated.cognitiveLogic.framework}`;
      }

      // Update reasoning to include stakeholder management
      if (!mutated.cognitiveLogic.reasoning.includes('stakeholder')) {
        mutated.cognitiveLogic.reasoning += 
          '. Identify multiple stakeholders and decision-makers in complex buying committees.';
      }
    }

    return mutated;
  }

  /**
   * Deep clone object (handles nested structures)
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
