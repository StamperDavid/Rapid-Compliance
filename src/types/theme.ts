import { Timestamp } from 'firebase/firestore';

/**
 * Theme Configuration
 * Complete theming system for white-label customization
 */
export interface Theme {
  id: string;
  organizationId: string;
  workspaceId?: string; // If null, it's org-level theme
  
  // Basic info
  name: string;
  description?: string;
  isDefault?: boolean;
  
  // Color Palette
  colors: ColorPalette;
  
  // Typography
  typography: Typography;
  
  // Spacing & Layout
  spacing: SpacingSystem;
  layout: LayoutConfig;
  
  // Component Styles
  components: ComponentStyles;
  
  // Branding
  branding: BrandingConfig;
  
  // Custom CSS
  customCSS?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  status: 'active' | 'draft';
  version: number;
}

/**
 * Color Palette with Gradient Support
 */
export interface ColorPalette {
  // Primary colors (supports gradients)
  primary: ColorShades | GradientColor;
  secondary: ColorShades | GradientColor;
  accent: ColorShades | GradientColor;
  
  // Semantic colors
  success: ColorShades | GradientColor;
  warning: ColorShades | GradientColor;
  error: ColorShades | GradientColor;
  info: ColorShades | GradientColor;
  
  // Neutral colors
  neutral: NeutralShades;
  
  // Background colors (supports gradients)
  background: {
    default: string | GradientColor;
    paper: string | GradientColor;
    elevated: string | GradientColor;
    gradient?: GradientColor; // Optional page background gradient
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
    gradient?: GradientColor; // Optional gradient text
  };
  
  // Border colors
  border: {
    default: string;
    subtle: string;
    strong: string;
  };
  
  // Overlay colors (for modals, tooltips)
  overlay: {
    backdrop: string;
    light: string;
    dark: string;
  };
}

export interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string; // Main shade
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface NeutralShades extends ColorShades {
  white: string;
  black: string;
}

/**
 * Gradient Color Configuration
 */
export interface GradientColor {
  type: 'linear' | 'radial' | 'conic';
  angle?: number; // For linear gradients (0-360 degrees)
  position?: string; // For radial gradients (e.g., 'center', 'top left')
  stops: GradientStop[];
}

export interface GradientStop {
  color: string;
  position: number; // 0-100%
}

/**
 * Typography System
 */
export interface Typography {
  // Font families
  fontFamily: {
    heading: string;
    body: string;
    mono: string;
  };
  
  // Font sizes
  fontSize: {
    xs: string;    // 0.75rem
    sm: string;    // 0.875rem
    base: string;  // 1rem
    lg: string;    // 1.125rem
    xl: string;    // 1.25rem
    '2xl': string; // 1.5rem
    '3xl': string; // 1.875rem
    '4xl': string; // 2.25rem
    '5xl': string; // 3rem
    '6xl': string; // 3.75rem
  };
  
  // Font weights
  fontWeight: {
    thin: number;      // 100
    extralight: number; // 200
    light: number;     // 300
    normal: number;    // 400
    medium: number;    // 500
    semibold: number;  // 600
    bold: number;      // 700
    extrabold: number; // 800
    black: number;     // 900
  };
  
  // Line heights
  lineHeight: {
    none: number;
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  
  // Letter spacing
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

/**
 * Spacing System
 */
export interface SpacingSystem {
  baseUnit: number; // Base unit in pixels (e.g., 4)
  scale: number[];  // Multipliers: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]
}

/**
 * Layout Configuration with Advanced Window Styling
 */
export interface LayoutConfig {
  // Container
  container: {
    maxWidth: string;
    padding: string;
  };
  
  // Border radius (window curves)
  borderRadius: {
    none: string;
    sm: string;   // 0.125rem (2px)
    base: string; // 0.25rem (4px)
    md: string;   // 0.375rem (6px)
    lg: string;   // 0.5rem (8px)
    xl: string;   // 0.75rem (12px)
    '2xl': string; // 1rem (16px)
    '3xl': string; // 1.5rem (24px)
    '4xl': string; // 2rem (32px)
    full: string;  // 9999px (fully rounded)
    
    // Component-specific overrides
    card?: string;
    button?: string;
    input?: string;
    modal?: string;
    dropdown?: string;
  };
  
  // Shadows (with glow effects)
  boxShadow: {
    none: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    inner: string;
    
    // Special effects
    glow?: string; // Colored glow effect
    glowHover?: string; // Glow on hover
    colored?: string; // Use theme color in shadow
  };
  
  // Border styles
  borderStyle: {
    width: {
      none: string;
      thin: string;
      base: string;
      thick: string;
    };
    style: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge';
  };
  
  // Z-index layers
  zIndex: {
    base: number;
    dropdown: number;
    sticky: number;
    fixed: number;
    modalBackdrop: number;
    modal: number;
    popover: number;
    tooltip: number;
  };
  
  // Sidebar
  sidebar: {
    width: string;
    collapsedWidth: string;
    borderRadius?: string;
    style: 'overlay' | 'push' | 'slide';
  };
  
  // Header
  header: {
    height: string;
    style: 'transparent' | 'solid' | 'blur' | 'gradient';
    blur?: boolean; // Glass morphism effect
    borderRadius?: string;
  };
  
  // Glass morphism / Blur effects
  blur: {
    none: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
  };
  
  // Animations
  animations: {
    duration: {
      fast: string;
      base: string;
      slow: string;
    };
    easing: {
      linear: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
      bounce: string;
    };
  };
}

/**
 * Component Styles
 */
export interface ComponentStyles {
  button: ButtonStyles;
  input: InputStyles;
  card: CardStyles;
  badge: BadgeStyles;
  table: TableStyles;
  modal: ModalStyles;
  dropdown: DropdownStyles;
  tab: TabStyles;
  alert: AlertStyles;
  tooltip: TooltipStyles;
}

export interface ButtonStyles {
  // Sizes
  sizes: {
    xs: ComponentSize;
    sm: ComponentSize;
    md: ComponentSize;
    lg: ComponentSize;
    xl: ComponentSize;
  };
  
  // Variants
  variants: {
    primary: ComponentVariant;
    secondary: ComponentVariant;
    outline: ComponentVariant;
    ghost: ComponentVariant;
    link: ComponentVariant;
    danger: ComponentVariant;
  };
  
  // Common
  borderRadius: string;
  fontWeight: string;
  transition: string;
}

export interface InputStyles {
  sizes: {
    sm: ComponentSize;
    md: ComponentSize;
    lg: ComponentSize;
  };
  
  borderRadius: string;
  borderWidth: string;
  borderColor: {
    default: string;
    focus: string;
    error: string;
  };
  
  backgroundColor: {
    default: string;
    disabled: string;
  };
}

export interface CardStyles {
  backgroundColor: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  shadow: string;
  padding: string;
}

export interface BadgeStyles {
  sizes: {
    sm: ComponentSize;
    md: ComponentSize;
    lg: ComponentSize;
  };
  
  variants: Record<string, ComponentVariant>;
  borderRadius: string;
}

export interface TableStyles {
  headerBackgroundColor: string;
  headerTextColor: string;
  rowHoverBackgroundColor: string;
  borderColor: string;
  stripedBackgroundColor?: string;
}

export interface ModalStyles {
  overlayBackgroundColor: string;
  backgroundColor: string;
  borderRadius: string;
  shadow: string;
  maxWidth: string;
}

export interface DropdownStyles {
  backgroundColor: string;
  borderRadius: string;
  shadow: string;
  itemHoverBackgroundColor: string;
}

export interface TabStyles {
  borderColor: string;
  activeIndicatorColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
}

export interface AlertStyles {
  variants: {
    info: ComponentVariant;
    success: ComponentVariant;
    warning: ComponentVariant;
    error: ComponentVariant;
  };
  
  borderRadius: string;
  padding: string;
}

export interface TooltipStyles {
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  padding: string;
  shadow: string;
  maxWidth: string;
}

export interface ComponentSize {
  padding: string;
  fontSize: string;
  lineHeight: string;
  height?: string;
  minWidth?: string;
}

export interface ComponentVariant {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
  activeBackgroundColor?: string;
  activeTextColor?: string;
  disabledBackgroundColor?: string;
  disabledTextColor?: string;
}

/**
 * White-Label Branding Configuration
 */
export interface BrandingConfig {
  // Logo (fully customizable)
  logo: {
    url?: string;
    darkUrl?: string; // For dark mode
    width?: number;
    height?: number;
    alt: string;
    position?: 'left' | 'center' | 'right';
    
    // Logo variants for different contexts
    variants?: {
      horizontal?: string; // Wide logo
      vertical?: string;   // Tall logo
      icon?: string;       // Square icon only
      wordmark?: string;   // Text only
    };
  };
  
  // Favicon & App Icons
  favicon?: string;
  appleTouchIcon?: string;
  androidIcon?: string;
  
  // Login page (full customization)
  loginPage: {
    backgroundImage?: string;
    backgroundColor?: string | GradientColor;
    backgroundOverlay?: string; // Overlay color with opacity
    showLogo: boolean;
    logoSize?: 'sm' | 'md' | 'lg' | 'xl';
    customText?: string;
    customTextColor?: string;
    cardStyle: 'solid' | 'blur' | 'transparent';
    cardBackground?: string | GradientColor;
    
    // Social login button styling
    socialButtons?: {
      style: 'outlined' | 'filled' | 'minimal';
      showIcons: boolean;
    };
  };
  
  // Email branding
  email: {
    headerColor?: string | GradientColor;
    footerText?: string;
    logoUrl?: string;
    accentColor?: string;
    
    // Custom email templates
    templates?: {
      headerHtml?: string;
      footerHtml?: string;
    };
  };
  
  // Custom domain (white-label)
  customDomain?: string;
  
  // Company info
  companyName: string;
  companyUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  
  // Footer
  footer: {
    show: boolean;
    style: 'minimal' | 'detailed' | 'centered';
    backgroundColor?: string | GradientColor;
    textColor?: string;
    links?: FooterLink[];
    copyrightText?: string;
    showPoweredBy?: boolean; // Show "Powered by [Platform]"
  };
  
  // Browser chrome (PWA)
  pwa?: {
    themeColor: string;
    backgroundColor: string;
    name: string;
    shortName: string;
  };
  
  // Social sharing
  socialSharing?: {
    ogImage?: string; // Open Graph image
    twitterCard?: 'summary' | 'summary_large_image';
  };
}

export interface FooterLink {
  label: string;
  url: string;
  openInNewTab?: boolean;
}

/**
 * Theme Preset
 * Pre-built themes
 */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  category: 'modern' | 'classic' | 'minimal' | 'bold' | 'custom';
  
  // Preview
  thumbnail: string;
  previewColors: string[]; // Array of main colors for preview
  
  // Theme data
  theme: Partial<Theme>;
  
  // Metadata
  isPremium: boolean;
  isPopular: boolean;
  usageCount: number;
  tags: string[];
}

/**
 * Dark Mode Support
 */
export interface DarkModeConfig {
  enabled: boolean;
  default: 'light' | 'dark' | 'system';
  allowUserToggle: boolean;
  
  // Dark mode overrides
  colors?: Partial<ColorPalette>;
}

