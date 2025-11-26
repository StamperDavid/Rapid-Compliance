# Theme Customization Examples

## Gradient Backgrounds

### 1. Purple to Blue Gradient (Modern SaaS)
```typescript
const theme = {
  colors: {
    background: {
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#667eea', position: 0 },
          { color: '#764ba2', position: 100 }
        ]
      }
    }
  }
};
```

### 2. Sunset Gradient (Warm & Inviting)
```typescript
const theme = {
  colors: {
    background: {
      gradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#ff6b6b', position: 0 },
          { color: '#feca57', position: 50 },
          { color: '#ff6b6b', position: 100 }
        ]
      }
    }
  }
};
```

### 3. Radial Gradient (Spotlight Effect)
```typescript
const theme = {
  colors: {
    background: {
      gradient: {
        type: 'radial',
        position: 'center top',
        stops: [
          { color: '#4facfe', position: 0 },
          { color: '#00f2fe', position: 100 }
        ]
      }
    }
  }
};
```

### 4. Conic Gradient (Rainbow Effect)
```typescript
const theme = {
  colors: {
    background: {
      gradient: {
        type: 'conic',
        angle: 0,
        position: 'center',
        stops: [
          { color: '#ff0080', position: 0 },
          { color: '#ff8c00', position: 25 },
          { color: '#40e0d0', position: 50 },
          { color: '#ff0080', position: 100 }
        ]
      }
    }
  }
};
```

---

## Button Gradients

### Gradient Primary Button
```typescript
const theme = {
  colors: {
    primary: {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#11998e', position: 0 },
        { color: '#38ef7d', position: 100 }
      ]
    }
  }
};
```

---

## Border Curves (Window Styling)

### 1. Ultra Smooth (Modern)
```typescript
const theme = {
  layout: {
    borderRadius: {
      card: '32px',      // Very rounded cards
      button: '16px',    // Pill-style buttons
      input: '12px',     // Smooth inputs
      modal: '40px',     // Extra rounded modals
      dropdown: '20px'   // Rounded dropdowns
    }
  }
};
```

### 2. Sharp & Professional
```typescript
const theme = {
  layout: {
    borderRadius: {
      card: '4px',       // Subtle corners
      button: '4px',     // Sharp buttons
      input: '4px',      // Minimal inputs
      modal: '8px',      // Slightly rounded modals
      dropdown: '4px'    // Sharp dropdowns
    }
  }
};
```

### 3. Fully Rounded (Friendly)
```typescript
const theme = {
  layout: {
    borderRadius: {
      card: '24px',
      button: '9999px',  // Fully rounded (pill-shaped)
      input: '9999px',   // Rounded inputs
      modal: '32px',
      dropdown: '16px'
    }
  }
};
```

---

## Glass Morphism Effects

### Frosted Glass
```typescript
const theme = {
  layout: {
    blur: {
      base: '10px'
    }
  },
  components: {
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.18)'
    }
  }
};
```

### Header with Blur
```typescript
const theme = {
  layout: {
    header: {
      style: 'blur',
      blur: true
    }
  }
};
```

---

## Colored Shadows & Glows

### Purple Glow on Buttons
```typescript
const theme = {
  layout: {
    boxShadow: {
      glow: '0 0 20px rgba(102, 126, 234, 0.5)',
      glowHover: '0 0 40px rgba(102, 126, 234, 0.8)'
    }
  },
  components: {
    button: {
      variants: {
        primary: {
          boxShadow: 'var(--shadow-glow)',
          hoverBoxShadow: 'var(--shadow-glow-hover)'
        }
      }
    }
  }
};
```

### Card with Colored Shadow
```typescript
const theme = {
  components: {
    card: {
      shadow: '0 10px 40px rgba(102, 126, 234, 0.2)'
    }
  }
};
```

---

## White-Label Branding

### Complete Rebrand
```typescript
const branding = {
  // Logo
  logo: {
    url: 'https://yourbrand.com/logo.svg',
    darkUrl: 'https://yourbrand.com/logo-dark.svg',
    width: 200,
    height: 50,
    position: 'left',
    variants: {
      horizontal: 'https://yourbrand.com/logo-horizontal.svg',
      vertical: 'https://yourbrand.com/logo-vertical.svg',
      icon: 'https://yourbrand.com/icon.svg',
      wordmark: 'https://yourbrand.com/wordmark.svg'
    }
  },
  
  // Icons
  favicon: 'https://yourbrand.com/favicon.ico',
  appleTouchIcon: 'https://yourbrand.com/apple-touch-icon.png',
  androidIcon: 'https://yourbrand.com/android-icon.png',
  
  // Login Page
  loginPage: {
    backgroundImage: 'https://yourbrand.com/login-bg.jpg',
    backgroundColor: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#667eea', position: 0 },
        { color: '#764ba2', position: 100 }
      ]
    },
    backgroundOverlay: 'rgba(0, 0, 0, 0.4)',
    showLogo: true,
    logoSize: 'lg',
    customText: 'Welcome to Your Brand',
    customTextColor: '#ffffff',
    cardStyle: 'blur',
    cardBackground: 'rgba(255, 255, 255, 0.1)'
  },
  
  // Email Branding
  email: {
    headerColor: {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#667eea', position: 0 },
        { color: '#764ba2', position: 100 }
      ]
    },
    logoUrl: 'https://yourbrand.com/email-logo.png',
    footerText: '© 2024 Your Brand. All rights reserved.',
    accentColor: '#667eea'
  },
  
  // Custom Domain
  customDomain: 'app.yourbrand.com',
  
  // Company Info
  companyName: 'Your Brand Inc.',
  companyUrl: 'https://yourbrand.com',
  supportEmail: 'support@yourbrand.com',
  supportPhone: '+1 (555) 123-4567',
  
  // Footer
  footer: {
    show: true,
    style: 'detailed',
    backgroundColor: '#1a1a2e',
    textColor: '#ffffff',
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Service', url: '/terms' },
      { label: 'Contact', url: '/contact' }
    ],
    copyrightText: '© 2024 Your Brand. All rights reserved.',
    showPoweredBy: false  // Hide platform branding
  },
  
  // PWA
  pwa: {
    themeColor: '#667eea',
    backgroundColor: '#ffffff',
    name: 'Your Brand CRM',
    shortName: 'YourBrand'
  },
  
  // Social Sharing
  socialSharing: {
    ogImage: 'https://yourbrand.com/og-image.jpg',
    twitterCard: 'summary_large_image'
  }
};
```

---

## Industry-Specific Themes

### 1. Financial Services (Trust & Stability)
```typescript
const financialTheme = {
  colors: {
    primary: {
      500: '#1e3a8a'  // Deep blue
    },
    secondary: {
      500: '#059669'  // Success green
    }
  },
  layout: {
    borderRadius: {
      card: '8px',      // Professional, subtle curves
      button: '6px',
      input: '6px'
    }
  },
  typography: {
    fontFamily: {
      heading: 'Playfair Display, serif',
      body: 'Inter, sans-serif'
    }
  }
};
```

### 2. E-Commerce (Vibrant & Energetic)
```typescript
const ecommerceTheme = {
  colors: {
    primary: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#f093fb', position: 0 },
        { color: '#f5576c', position: 100 }
      ]
    }
  },
  layout: {
    borderRadius: {
      card: '20px',     // Friendly, rounded
      button: '9999px'  // Pill buttons
    },
    boxShadow: {
      glow: '0 0 30px rgba(245, 87, 108, 0.3)'
    }
  }
};
```

### 3. Tech Startup (Bold & Modern)
```typescript
const techTheme = {
  colors: {
    primary: {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#00d2ff', position: 0 },
        { color: '#3a7bd5', position: 100 }
      ]
    },
    background: {
      default: '#0a0e27',
      gradient: {
        type: 'radial',
        position: 'top right',
        stops: [
          { color: '#1a1e3f', position: 0 },
          { color: '#0a0e27', position: 100 }
        ]
      }
    }
  },
  layout: {
    borderRadius: {
      card: '16px',
      button: '12px'
    }
  }
};
```

### 4. Healthcare (Clean & Calming)
```typescript
const healthcareTheme = {
  colors: {
    primary: {
      500: '#06b6d4'  // Calming cyan
    },
    secondary: {
      500: '#10b981'  // Healthy green
    },
    background: {
      default: '#f8fafc'  // Clean white-blue
    }
  },
  layout: {
    borderRadius: {
      card: '12px',     // Soft, approachable
      button: '8px'
    }
  }
};
```

---

## Animation Configurations

### Smooth & Elegant
```typescript
const theme = {
  layout: {
    animations: {
      duration: {
        fast: '150ms',
        base: '300ms',
        slow: '500ms'
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  }
};
```

### Bouncy & Playful
```typescript
const theme = {
  layout: {
    animations: {
      duration: {
        fast: '200ms',
        base: '400ms',
        slow: '600ms'
      },
      easing: {
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
      }
    }
  }
};
```

---

## How to Apply These Themes

### In Your App
```typescript
import { ThemeGenerator } from '@/lib/theme/theme-generator';

// Apply theme
const myTheme = {
  // ... your theme config from examples above
};

ThemeGenerator.applyTheme(myTheme);
```

### Via Admin UI
1. Go to Workspace Settings → Theme
2. Choose a preset or customize
3. Adjust colors, gradients, curves
4. Upload logo
5. Preview changes in real-time
6. Save and publish

---

## Tips for Great Themes

1. **Consistency**: Use the same border radius scale across components
2. **Contrast**: Ensure text is readable on all backgrounds
3. **Gradients**: Use 2-3 colors max for clean gradients
4. **Curves**: Match curves to your brand personality (sharp = professional, round = friendly)
5. **Shadows**: Use colored shadows that match your primary color
6. **White-Label**: Always test logo visibility on both light and dark backgrounds
7. **Mobile**: Test themes on mobile devices for responsiveness
8. **Accessibility**: Maintain WCAG AA contrast ratios minimum

---

Ready to customize! 🎨


