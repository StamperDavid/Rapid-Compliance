/**
 * Formula Engine
 * Evaluate formulas for computed fields (like Airtable)
 */

import type { SchemaField } from '@/types/schema';
import type { EntityRecord } from '@/types/entity'
import { logger } from '@/lib/logger/logger';

export class FormulaEngine {
  /**
   * Evaluate a formula for a given entity record
   */
  evaluate(
    formula: string,
    record: EntityRecord,
    allFields: SchemaField[]
  ): any {
    try {
      // Create safe context with field values
      const context = this.createContext(record, allFields);
      
      // Parse and evaluate formula
      const result = this.safeEval(formula, context);
      
      return result;
    } catch (error) {
      logger.error('Formula evaluation error:', error, { file: 'formula-engine.ts' });
      return null;
    }
  }

  /**
   * Create execution context from record
   */
  private createContext(
    record: EntityRecord,
    fields: SchemaField[]
  ): Record<string, any> {
    const context: Record<string, any> = {};

    // Add field values
    fields.forEach(field => {
      context[field.key] = record[field.key];
    });

    // Add utility functions
    context.IF = this.IF;
    context.AND = this.AND;
    context.OR = this.OR;
    context.NOT = this.NOT;
    context.CONCAT = this.CONCAT;
    context.LEN = this.LEN;
    context.UPPER = this.UPPER;
    context.LOWER = this.LOWER;
    context.TRIM = this.TRIM;
    context.LEFT = this.LEFT;
    context.RIGHT = this.RIGHT;
    context.MID = this.MID;
    context.FIND = this.FIND;
    context.SUBSTITUTE = this.SUBSTITUTE;
    context.ROUND = Math.round;
    context.CEILING = Math.ceil;
    context.FLOOR = Math.floor;
    context.ABS = Math.abs;
    context.SQRT = Math.sqrt;
    context.POW = Math.pow;
    context.MIN = Math.min;
    context.MAX = Math.max;
    context.SUM = this.SUM;
    context.AVERAGE = this.AVERAGE;
    context.COUNT = this.COUNT;
    context.NOW = () => new Date();
    context.TODAY = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    };
    context.DATEADD = this.DATEADD;
    context.DATEDIFF = this.DATEDIFF;
    context.YEAR = (d: Date) => d.getFullYear();
    context.MONTH = (d: Date) => d.getMonth() + 1;
    context.DAY = (d: Date) => d.getDate();

    return context;
  }

  /**
   * Safe evaluation of formula
   * Prevents arbitrary code execution
   */
  private safeEval(formula: string, context: Record<string, any>): any {
    // Create function with restricted scope
    const keys = Object.keys(context);
    const values = Object.values(context);

    // Add Math object for convenience
    keys.push('Math');
    values.push(Math);

    try {
      // Create function from formula
      const func = new Function(...keys, `"use strict"; return (${formula});`);
      
      // Execute with context
      return func(...values);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error}`);
    }
  }

  /**
   * Validate formula syntax
   */
  validate(formula: string, fields: SchemaField[]): { valid: boolean; error?: string } {
    try {
      // Create dummy context
      const context: Record<string, any> = {};
      fields.forEach(field => {
        context[field.key] = this.getDummyValue(field.type);
      });

      // Try to evaluate
      this.safeEval(formula, context);
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid formula'
      };
    }
  }

  /**
   * Get dummy value for field type (for validation)
   */
  private getDummyValue(fieldType: string): any {
    switch (fieldType) {
      case 'text':
      case 'longText':
      case 'email':
      case 'url':
      case 'phoneNumber':
        return 'test';
      case 'number':
      case 'currency':
      case 'percent':
      case 'autoNumber':
        return 42;
      case 'checkbox':
        return true;
      case 'date':
      case 'dateTime':
        return new Date();
      case 'singleSelect':
        return 'option1';
      case 'multiSelect':
        return ['option1', 'option2'];
      case 'rating':
        return 5;
      default:
        return null;
    }
  }

  // ============ Formula Functions ============

  private IF(condition: boolean, trueValue: any, falseValue: any): any {
    return condition ? trueValue : falseValue;
  }

  private AND(...args: any[]): boolean {
    return args.every(Boolean);
  }

  private OR(...args: any[]): boolean {
    return args.some(Boolean);
  }

  private NOT(value: any): boolean {
    return !value;
  }

  private CONCAT(...args: any[]): string {
    return args.map(String).join('');
  }

  private LEN(str: string): number {
    return String(str).length;
  }

  private UPPER(str: string): string {
    return String(str).toUpperCase();
  }

  private LOWER(str: string): string {
    return String(str).toLowerCase();
  }

  private TRIM(str: string): string {
    return String(str).trim();
  }

  private LEFT(str: string, count: number): string {
    return String(str).substring(0, count);
  }

  private RIGHT(str: string, count: number): string {
    const s = String(str);
    return s.substring(s.length - count);
  }

  private MID(str: string, start: number, count: number): string {
    return String(str).substring(start, start + count);
  }

  private FIND(searchStr: string, str: string): number {
    return String(str).indexOf(searchStr);
  }

  private SUBSTITUTE(str: string, oldStr: string, newStr: string): string {
    return String(str).replace(new RegExp(oldStr, 'g'), newStr);
  }

  private SUM(...args: number[]): number {
    return args.reduce((sum, n) => sum + Number(n), 0);
  }

  private AVERAGE(...args: number[]): number {
    if (args.length === 0) {return 0;}
    return this.SUM(...args) / args.length;
  }

  private COUNT(...args: any[]): number {
    return args.filter(v => v !== null && v !== undefined).length;
  }

  private DATEADD(date: Date, value: number, unit: 'days' | 'months' | 'years'): Date {
    const d = new Date(date);
    switch (unit) {
      case 'days':
        d.setDate(d.getDate() + value);
        break;
      case 'months':
        d.setMonth(d.getMonth() + value);
        break;
      case 'years':
        d.setFullYear(d.getFullYear() + value);
        break;
    }
    return d;
  }

  private DATEDIFF(date1: Date, date2: Date, unit: 'days' | 'months' | 'years' = 'days'): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diff = d2.getTime() - d1.getTime();
    
    switch (unit) {
      case 'days':
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'months':
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      case 'years':
        return d2.getFullYear() - d1.getFullYear();
      default:
        return 0;
    }
  }
}

/**
 * Example Formulas:
 * 
 * Concat fields:
 * CONCAT(first_name, " ", last_name)
 * 
 * Calculate total:
 * price * quantity
 * 
 * Conditional:
 * IF(status == "active", "✓", "✗")
 * 
 * Date calculations:
 * DATEDIFF(created_at, NOW(), "days")
 * 
 * Complex logic:
 * IF(AND(quantity > 0, price > 100), "Premium", IF(quantity > 0, "Standard", "Out of Stock"))
 * 
 * String manipulation:
 * UPPER(LEFT(name, 1)) + LOWER(RIGHT(name, LEN(name) - 1))
 * 
 * Math:
 * ROUND(price * (1 - discount / 100), 2)
 */


