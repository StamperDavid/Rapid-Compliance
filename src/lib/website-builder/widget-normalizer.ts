/**
 * Widget Shape Normalizer
 *
 * Single source of truth for translating the legacy "editor / seed" widget
 * vocabulary into the CANONICAL widget vocabulary that `ResponsiveRenderer`
 * (the live `/sites` renderer) expects.
 *
 * Historically three layers named the same widgets differently:
 *   - the canonical renderer used `features` / `pricing` / `stats` / `faq`
 *     reading `data.features[]` / `data.plans[]` / `data.stats[]` / `data.faqs[]`
 *   - the seed config + legacy public renderer used `feature-grid` /
 *     `pricing-table` / `stats` / `faq` reading `content.items[]` with
 *     `{icon,title,desc}` / `{value,label}` / `{q,a}` and `highlighted`.
 *
 * These helpers read EITHER shape and always return the canonical shape, so a
 * widget renders correctly no matter which vocabulary produced it. They are
 * additive and backward-compatible — old stored content keeps working.
 */

import type { FeatureItem, PricingPlan, StatItem } from '@/types/widget-content';

/** Canonical FAQ entry as consumed by the renderer. */
export interface CanonicalFaq {
  question: string;
  answer: string;
}

/** Legacy widget type names mapped to their canonical equivalents. */
const TYPE_ALIASES: Record<string, string> = {
  'feature-grid': 'features',
  'pricing-table': 'pricing',
};

/** Resolve a (possibly legacy) widget type string to its canonical name. */
export function canonicalWidgetType(type: string): string {
  return TYPE_ALIASES[type] ?? type;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

function toStringArray(value: unknown): string[] {
  return asArray(value).map(toText).filter((entry) => entry !== '');
}

/**
 * Read feature cards from a widget data object, tolerating both the canonical
 * `features[{icon,title,description}]` and legacy `items[{icon,title,desc}]`.
 */
export function readFeatures(data: Record<string, unknown>): FeatureItem[] {
  const source = asArray(data.features).length > 0 ? data.features : data.items;
  return asArray(source).map((raw): FeatureItem => {
    const item = asRecord(raw) ?? {};
    const icon = toText(item.icon);
    return {
      icon: icon !== '' ? icon : undefined,
      title: toText(item.title),
      description: toText(item.description !== undefined ? item.description : item.desc),
    };
  });
}

/**
 * Read stat tiles, tolerating canonical `stats[{number,label}]` and legacy
 * `items[{value,label}]`.
 */
export function readStats(data: Record<string, unknown>): StatItem[] {
  const source = asArray(data.stats).length > 0 ? data.stats : data.items;
  return asArray(source).map((raw): StatItem => {
    const item = asRecord(raw) ?? {};
    return {
      number: toText(item.number !== undefined ? item.number : item.value),
      label: toText(item.label),
    };
  });
}

/**
 * Read FAQ entries, tolerating canonical `faqs[{question,answer}]` and legacy
 * `items[{q,a}]`.
 */
export function readFaqs(data: Record<string, unknown>): CanonicalFaq[] {
  const source = asArray(data.faqs).length > 0 ? data.faqs : data.items;
  return asArray(source).map((raw): CanonicalFaq => {
    const item = asRecord(raw) ?? {};
    return {
      question: toText(item.question !== undefined ? item.question : item.q),
      answer: toText(item.answer !== undefined ? item.answer : item.a),
    };
  });
}

/**
 * Read pricing plans, tolerating the legacy `highlighted` flag in place of the
 * canonical `featured` flag.
 */
export function readPlans(data: Record<string, unknown>): PricingPlan[] {
  return asArray(data.plans).map((raw): PricingPlan => {
    const item = asRecord(raw) ?? {};
    const price = item.price;
    const buttonText = toText(item.buttonText);
    const buttonUrl = toText(item.buttonUrl);
    return {
      name: toText(item.name),
      price: typeof price === 'number' ? price : toText(price),
      period: toText(item.period),
      features: toStringArray(item.features),
      featured: Boolean(item.featured !== undefined ? item.featured : item.highlighted),
      buttonText: buttonText !== '' ? buttonText : undefined,
      buttonUrl: buttonUrl !== '' ? buttonUrl : undefined,
    };
  });
}

/**
 * Format a plan price for display. Numbers get a leading `$`; strings that
 * already carry their own symbol (e.g. `$29`, `Custom`) are shown verbatim.
 */
export function formatPlanPrice(price: string | number): string {
  if (typeof price === 'number') {
    return `$${price}`;
  }
  return price;
}

/**
 * Normalize a billing period to a leading-slash form (`month` -> `/month`),
 * collapsing the historical mix of `/month` and `month`. Empty stays empty.
 */
export function formatPlanPeriod(period: string): string {
  const trimmed = period.trim().replace(/^\//, '');
  return trimmed === '' ? '' : `/${trimmed}`;
}
