/**
 * Theme Generator
 * Converts theme configuration to CSS variables
 */

import type { Theme, GradientColor } from '@/types/theme';

export class ThemeGenerator {
  /**
   * Generate CSS variables from theme config
   */
  static generateCSS(theme: Theme): string {
    const css: string[] = [':root {'];

    // Colors
    css.push(this.generateColorVariables(theme.colors));

    // Typography
    css.push(this.generateTypographyVariables(theme.typography));

    // Spacing
    css.push(this.generateSpacingVariables(theme.spacing));

    // Layout
    css.push(this.generateLayoutVariables(theme.layout));

    // Components
    css.push(this.generateComponentVariables(theme.components));

    css.push('}');

    return css.join('\n  ');
  }

  /**
   * Generate color CSS variables
   */
  private static generateColorVariables(colors: Theme['colors']): string {
    const vars: string[] = [];

    // Handle gradient colors
    if (this.isGradient(colors.primary)) {
      vars.push(`--color-primary: ${this.gradientToCSS(colors.primary)};`);
    } else {
      // Regular color shades
      Object.entries(colors.primary).forEach(([shade, value]) => {
        vars.push(`--color-primary-${shade}: ${value};`);
      });
    }

    // Background gradients
    if (colors.background.gradient) {
      vars.push(`--bg-gradient: ${this.gradientToCSS(colors.background.gradient)};`);
    }

    return vars.join('\n  ');
  }

  /**
   * Check if value is a gradient
   */
  private static isGradient(value: unknown): value is GradientColor {
    return value && typeof value === 'object' && 'type' in value && 'stops' in value;
  }

  /**
   * Convert gradient config to CSS
   */
  private static gradientToCSS(gradient: GradientColor): string {
    const stops = gradient.stops
      .map(stop => `${stop.color} ${stop.position}%`)
      .join(', ');

    switch (gradient.type) {
      case 'linear':
        return `linear-gradient(${gradient.angle ?? 180}deg, ${stops})`;
      case 'radial':
        return `radial-gradient(circle at ${(gradient.position !== '' && gradient.position != null) ? gradient.position : 'center'}, ${stops})`;
      case 'conic':
        return `conic-gradient(from ${gradient.angle ?? 0}deg at ${(gradient.position !== '' && gradient.position != null) ? gradient.position : 'center'}, ${stops})`;
      default:
        return stops;
    }
  }

  /**
   * Generate typography CSS variables
   */
  private static generateTypographyVariables(typography: Theme['typography']): string {
    const vars: string[] = [];

    // Font families
    vars.push(`--font-heading: ${typography.fontFamily.heading};`);
    vars.push(`--font-body: ${typography.fontFamily.body};`);
    vars.push(`--font-mono: ${typography.fontFamily.mono};`);

    // Font sizes
    Object.entries(typography.fontSize).forEach(([size, value]) => {
      vars.push(`--text-${size}: ${value};`);
    });

    return vars.join('\n  ');
  }

  /**
   * Generate spacing CSS variables
   */
  private static generateSpacingVariables(spacing: Theme['spacing']): string {
    const vars: string[] = [];

    vars.push(`--spacing-unit: ${spacing.baseUnit}px;`);

    spacing.scale.forEach((multiplier: number, index: number) => {
      vars.push(`--spacing-${index}: ${multiplier * spacing.baseUnit}px;`);
    });

    return vars.join('\n  ');
  }

  /**
   * Generate layout CSS variables
   */
  private static generateLayoutVariables(layout: Theme['layout']): string {
    const vars: string[] = [];

    // Border radius
    Object.entries(layout.borderRadius).forEach(([size, value]) => {
      vars.push(`--radius-${size}: ${value};`);
    });

    // Shadows
    Object.entries(layout.boxShadow).forEach(([size, value]) => {
      vars.push(`--shadow-${size}: ${value};`);
    });

    // Blur
    if (layout.blur) {
      Object.entries(layout.blur).forEach(([size, value]) => {
        vars.push(`--blur-${size}: ${value};`);
      });
    }

    return vars.join('\n  ');
  }

  /**
   * Generate component CSS variables
   */
  private static generateComponentVariables(_components: Theme['components']): string {
    const vars: string[] = [];

    // Add component-specific variables as needed
    // This can be expanded based on component requirements

    return vars.join('\n  ');
  }

  /**
   * Apply theme to DOM
   */
  static applyTheme(theme: Theme): void {
    const css = this.generateCSS(theme);
    
    // Create or update style tag
    let styleTag = document.getElementById('dynamic-theme');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-theme';
      document.head.appendChild(styleTag);
    }
    
    styleTag.textContent = css;
  }

  /**
   * Generate gradient CSS class
   */
  static generateGradientClass(gradient: GradientColor, className: string): string {
    return `.${className} {
  background: ${this.gradientToCSS(gradient)};
}`;
  }
}


