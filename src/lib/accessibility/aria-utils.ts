/**
 * ARIA Accessibility Utilities
 * Helpers for WCAG AA compliance
 */

/**
 * Generate unique ARIA IDs
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Check color contrast ratio
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(foreground: string, background: string): number {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance
 */
function getRelativeLuminance(color: string): number {
  // Convert hex to RGB
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  // Convert to sRGB
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse short form (#fff)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Check if contrast ratio meets WCAG AA
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const requiredRatio = isLargeText ? 3 : 4.5;
  return ratio >= requiredRatio;
}

/**
 * Get accessible color suggestion
 */
export function getAccessibleColor(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): string {
  if (meetsWCAGAA(foreground, background, isLargeText)) {
    return foreground;
  }

  // Darken or lighten foreground until it meets contrast requirements
  const bgLuminance = getRelativeLuminance(background);
  return bgLuminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Keyboard navigation helpers
 */
export const keyboardNav = {
  /**
   * Handle arrow key navigation in a list
   */
  handleArrowKeys(
    event: React.KeyboardEvent,
    currentIndex: number,
    itemCount: number,
    onNavigate: (newIndex: number) => void
  ): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        onNavigate((currentIndex + 1) % itemCount);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        onNavigate((currentIndex - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        event.preventDefault();
        onNavigate(0);
        break;
      case 'End':
        event.preventDefault();
        onNavigate(itemCount - 1);
        break;
    }
  },

  /**
   * Handle Enter/Space activation
   */
  handleActivation(event: React.KeyboardEvent, callback: () => void): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  },

  /**
   * Handle Escape key
   */
  handleEscape(event: React.KeyboardEvent, callback: () => void): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      callback();
    }
  },
};

/**
 * Focus management
 */
export const focusManagement = {
  /**
   * Trap focus within an element
   */
  trapFocus(element: HTMLElement, event: KeyboardEvent): void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  },

  /**
   * Return focus to a previously focused element
   */
  returnFocus(previousElement: HTMLElement | null): void {
    if (previousElement && document.body.contains(previousElement)) {
      previousElement.focus();
    }
  },

  /**
   * Get first focusable element
   */
  getFirstFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return (focusable[0] as HTMLElement) || null;
  },
};

/**
 * Screen reader utilities
 */
export const screenReader = {
  /**
   * Announce message to screen reader
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
    } else {
      // Create announcer if it doesn't exist
      const newAnnouncer = document.createElement('div');
      newAnnouncer.id = 'sr-announcer';
      newAnnouncer.className = 'sr-only';
      newAnnouncer.setAttribute('role', 'status');
      newAnnouncer.setAttribute('aria-live', priority);
      newAnnouncer.setAttribute('aria-atomic', 'true');
      newAnnouncer.textContent = message;
      document.body.appendChild(newAnnouncer);
    }
  },

  /**
   * Clear announcer
   */
  clearAnnouncer(): void {
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
      announcer.textContent = '';
    }
  },
};

/**
 * Get ARIA label for element type
 */
export function getAriaLabel(elementType: string, data: any): string {
  switch (elementType) {
    case 'button':
      return data.text || data.label || 'Button';
    case 'link':
      return data.text || data.label || 'Link';
    case 'image':
      return data.alt || 'Image';
    case 'heading':
      return data.text || 'Heading';
    case 'nav':
      return 'Navigation menu';
    case 'modal':
      return data.title || 'Dialog';
    default:
      return '';
  }
}

/**
 * Validate ARIA attributes
 */
export function validateAria(element: HTMLElement): string[] {
  const errors: string[] = [];

  // Check for required ARIA labels
  if (
    element.getAttribute('role') === 'button' &&
    !element.getAttribute('aria-label') &&
    !element.textContent?.trim()
  ) {
    errors.push('Button elements must have accessible text or aria-label');
  }

  // Check for valid ARIA roles
  const role = element.getAttribute('role');
  const validRoles = [
    'button',
    'link',
    'navigation',
    'main',
    'complementary',
    'banner',
    'contentinfo',
    'search',
    'form',
  ];

  if (role && !validRoles.includes(role)) {
    errors.push(`Invalid ARIA role: ${role}`);
  }

  return errors;
}

