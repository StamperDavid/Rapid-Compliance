/**
 * Shared Type Definitions
 *
 * This file contains commonly used types that are referenced across multiple domains.
 * These types are intentionally kept generic and reusable.
 */

/**
 * Common spacing interface used across layout systems
 */
export interface Spacing {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * Common address interface used across domains (orders, shipping, customer info)
 */
export interface Address {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

/**
 * Common animation configuration
 */
export interface AnimationConfig {
  type: 'fade' | 'slide' | 'zoom' | 'bounce' | 'none';
  duration?: number; // ms
  delay?: number; // ms
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

/**
 * Common social links configuration
 */
export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  pinterest?: string;
  github?: string;
}
