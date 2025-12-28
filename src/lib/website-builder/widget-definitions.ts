/**
 * Widget Definitions
 * Defines all 35-40 widgets with default data and styles
 */

import { WidgetType, WidgetData, WidgetStyle } from '@/types/website';

export interface WidgetDefinition {
  label: string;
  description?: string;
  icon: string;
  category: 'layout' | 'content' | 'forms' | 'media' | 'advanced';
  defaultData: WidgetData;
  defaultStyle?: WidgetStyle;
}

export const widgetDefinitions: Record<WidgetType, WidgetDefinition> = {
  // LAYOUT WIDGETS
  'container': {
    label: 'Container',
    description: 'Wrapper for content',
    icon: '📦',
    category: 'layout',
    defaultData: {},
    defaultStyle: {
      padding: { top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' },
      backgroundColor: 'transparent',
    },
  },

  'row': {
    label: 'Row',
    description: 'Horizontal layout',
    icon: '⬌',
    category: 'layout',
    defaultData: {},
    defaultStyle: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
  },

  'column': {
    label: 'Column',
    description: 'Vertical layout',
    icon: '⬍',
    category: 'layout',
    defaultData: {},
    defaultStyle: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
  },

  'spacer': {
    label: 'Spacer',
    description: 'Add vertical spacing',
    icon: '↕️',
    category: 'layout',
    defaultData: {
      height: '2rem',
    },
    defaultStyle: {
      height: '2rem',
    },
  },

  'divider': {
    label: 'Divider',
    description: 'Horizontal line',
    icon: '—',
    category: 'layout',
    defaultData: {
      thickness: '1px',
      color: '#dee2e6',
    },
    defaultStyle: {
      width: '100%',
      height: '1px',
      backgroundColor: '#dee2e6',
      margin: { top: '1rem', bottom: '1rem' },
    },
  },

  // CONTENT WIDGETS
  'heading': {
    label: 'Heading',
    description: 'H1-H6 headings',
    icon: 'H',
    category: 'content',
    defaultData: {
      text: 'Your Heading',
      level: 2,
      tag: 'h2',
    },
    defaultStyle: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#212529',
      margin: { bottom: '1rem' },
    },
  },

  'text': {
    label: 'Text',
    description: 'Paragraph text',
    icon: '📄',
    category: 'content',
    defaultData: {
      content: 'This is a paragraph of text. Edit this to add your own content.',
    },
    defaultStyle: {
      fontSize: '1rem',
      lineHeight: '1.6',
      color: '#495057',
      margin: { bottom: '1rem' },
    },
  },

  'button': {
    label: 'Button',
    description: 'Call to action button',
    icon: '🔘',
    category: 'content',
    defaultData: {
      text: 'Click Me',
      url: '#',
      openInNewTab: false,
    },
    defaultStyle: {
      padding: { top: '0.75rem', right: '1.5rem', bottom: '0.75rem', left: '1.5rem' },
      backgroundColor: '#007bff',
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '1rem',
      fontWeight: '500',
      textAlign: 'center',
    },
  },

  'link': {
    label: 'Link',
    description: 'Text link',
    icon: '🔗',
    category: 'content',
    defaultData: {
      text: 'Link Text',
      url: '#',
      openInNewTab: false,
    },
    defaultStyle: {
      color: '#007bff',
      textAlign: 'left',
    },
  },

  'image': {
    label: 'Image',
    description: 'Single image',
    icon: '🖼️',
    category: 'content',
    defaultData: {
      src: 'https://via.placeholder.com/800x400',
      alt: 'Image description',
      caption: '',
    },
    defaultStyle: {
      width: '100%',
      height: 'auto',
      borderRadius: '4px',
    },
  },

  'video': {
    label: 'Video',
    description: 'YouTube/Vimeo embed',
    icon: '🎥',
    category: 'content',
    defaultData: {
      url: '',
      provider: 'youtube',
      autoplay: false,
    },
    defaultStyle: {
      width: '100%',
      borderRadius: '4px',
    },
  },

  'hero': {
    label: 'Hero Section',
    description: 'Large hero banner',
    icon: '🎯',
    category: 'content',
    defaultData: {
      heading: 'Welcome to Our Site',
      subheading: 'Build amazing things',
      buttonText: 'Get Started',
      buttonUrl: '#',
      backgroundImage: 'https://via.placeholder.com/1920x600',
    },
    defaultStyle: {
      padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
      textAlign: 'center',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#ffffff',
    },
  },

  'features': {
    label: 'Feature Grid',
    description: '3-column features',
    icon: '⭐',
    category: 'content',
    defaultData: {
      features: [
        { icon: '🚀', title: 'Fast', description: 'Lightning fast performance' },
        { icon: '🔒', title: 'Secure', description: 'Enterprise-grade security' },
        { icon: '💪', title: 'Powerful', description: 'All the features you need' },
      ],
    },
    defaultStyle: {
      display: 'grid',
      padding: { top: '2rem', bottom: '2rem' },
    },
  },

  'pricing': {
    label: 'Pricing Table',
    description: 'Pricing plans',
    icon: '💰',
    category: 'content',
    defaultData: {
      plans: [
        { 
          name: 'Basic', 
          price: '$9', 
          period: 'month', 
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
          buttonText: 'Choose Plan',
          buttonUrl: '#',
        },
        { 
          name: 'Pro', 
          price: '$29', 
          period: 'month', 
          features: ['All Basic features', 'Feature 4', 'Feature 5'],
          buttonText: 'Choose Plan',
          buttonUrl: '#',
          featured: true,
        },
      ],
    },
    defaultStyle: {
      display: 'grid',
      padding: { top: '2rem', bottom: '2rem' },
    },
  },

  'testimonial': {
    label: 'Testimonial',
    description: 'Customer review',
    icon: '💬',
    category: 'content',
    defaultData: {
      quote: 'This product changed my life!',
      author: 'John Doe',
      role: 'CEO, Company',
      avatar: 'https://via.placeholder.com/80',
    },
    defaultStyle: {
      padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      textAlign: 'center',
    },
  },

  'cta': {
    label: 'CTA Block',
    description: 'Call to action section',
    icon: '📢',
    category: 'content',
    defaultData: {
      heading: 'Ready to get started?',
      subheading: 'Join thousands of happy customers',
      buttonText: 'Start Free Trial',
      buttonUrl: '#',
    },
    defaultStyle: {
      padding: { top: '3rem', right: '2rem', bottom: '3rem', left: '2rem' },
      backgroundColor: '#007bff',
      color: '#ffffff',
      textAlign: 'center',
      borderRadius: '8px',
    },
  },

  'stats': {
    label: 'Stats',
    description: 'Key statistics',
    icon: '📊',
    category: 'content',
    defaultData: {
      stats: [
        { number: '10K+', label: 'Customers' },
        { number: '50K+', label: 'Downloads' },
        { number: '99.9%', label: 'Uptime' },
      ],
    },
    defaultStyle: {
      display: 'grid',
      padding: { top: '2rem', bottom: '2rem' },
      textAlign: 'center',
    },
  },

  'counter': {
    label: 'Counter',
    description: 'Animated number',
    icon: '🔢',
    category: 'content',
    defaultData: {
      number: 1000,
      suffix: '+',
      label: 'Happy Customers',
      duration: 2000,
    },
    defaultStyle: {
      textAlign: 'center',
      padding: { top: '1rem', bottom: '1rem' },
    },
  },

  'progress': {
    label: 'Progress Bar',
    description: 'Skill/progress bar',
    icon: '▬',
    category: 'content',
    defaultData: {
      label: 'JavaScript',
      percentage: 90,
      color: '#007bff',
    },
    defaultStyle: {
      margin: { bottom: '1rem' },
    },
  },

  'accordion': {
    label: 'Accordion',
    description: 'Collapsible content',
    icon: '▼',
    category: 'content',
    defaultData: {
      items: [
        { title: 'Item 1', content: 'Content for item 1' },
        { title: 'Item 2', content: 'Content for item 2' },
        { title: 'Item 3', content: 'Content for item 3' },
      ],
    },
    defaultStyle: {
      margin: { bottom: '1rem' },
    },
  },

  'modal': {
    label: 'Modal',
    description: 'Popup modal dialog',
    icon: '🗖',
    category: 'content',
    defaultData: {
      title: 'Modal Title',
      content: 'Modal content goes here',
      buttonText: 'Open Modal',
    },
    defaultStyle: {
      padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
      backgroundColor: '#ffffff',
      borderRadius: '8px',
    },
  },

  'tabs': {
    label: 'Tabs',
    description: 'Tabbed content',
    icon: '📑',
    category: 'content',
    defaultData: {
      tabs: [
        { title: 'Tab 1', content: 'Content for tab 1' },
        { title: 'Tab 2', content: 'Content for tab 2' },
        { title: 'Tab 3', content: 'Content for tab 3' },
      ],
    },
    defaultStyle: {
      margin: { bottom: '1rem' },
    },
  },

  'faq': {
    label: 'FAQ',
    description: 'Frequently asked questions',
    icon: '❓',
    category: 'content',
    defaultData: {
      faqs: [
        { question: 'What is this?', answer: 'This is an answer.' },
        { question: 'How does it work?', answer: 'It works like this.' },
      ],
    },
    defaultStyle: {
      margin: { bottom: '1rem' },
    },
  },

  // FORM WIDGETS
  'contact-form': {
    label: 'Contact Form',
    description: 'Basic contact form',
    icon: '✉️',
    category: 'forms',
    defaultData: {
      fields: ['name', 'email', 'message'],
      submitText: 'Send Message',
      successMessage: 'Thank you! We\'ll be in touch soon.',
      saveToCRM: true,
    },
    defaultStyle: {
      padding: { top: '1rem', bottom: '1rem' },
    },
  },

  'newsletter': {
    label: 'Newsletter',
    description: 'Email signup',
    icon: '📮',
    category: 'forms',
    defaultData: {
      heading: 'Subscribe to our newsletter',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
      successMessage: 'Thanks for subscribing!',
    },
    defaultStyle: {
      padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
    },
  },

  'custom-form': {
    label: 'Custom Form',
    description: 'Build your own form',
    icon: '📝',
    category: 'forms',
    defaultData: {
      fields: [],
      submitText: 'Submit',
      successMessage: 'Form submitted successfully!',
      saveToCRM: true,
    },
    defaultStyle: {
      padding: { top: '1rem', bottom: '1rem' },
    },
  },

  // MEDIA WIDGETS
  'gallery': {
    label: 'Gallery',
    description: 'Image grid',
    icon: '🖼️',
    category: 'media',
    defaultData: {
      images: [
        { src: 'https://via.placeholder.com/400', alt: 'Image 1' },
        { src: 'https://via.placeholder.com/400', alt: 'Image 2' },
        { src: 'https://via.placeholder.com/400', alt: 'Image 3' },
      ],
      columns: 3,
      gap: '1rem',
    },
    defaultStyle: {
      display: 'grid',
    },
  },

  'slider': {
    label: 'Slider',
    description: 'Image carousel',
    icon: '🎠',
    category: 'media',
    defaultData: {
      slides: [
        { image: 'https://via.placeholder.com/800x400', caption: 'Slide 1' },
        { image: 'https://via.placeholder.com/800x400', caption: 'Slide 2' },
      ],
      autoplay: true,
      interval: 5000,
    },
    defaultStyle: {
      borderRadius: '8px',
    },
  },

  'icon-box': {
    label: 'Icon Box',
    description: 'Icon with text',
    icon: '💡',
    category: 'media',
    defaultData: {
      icon: '⭐',
      title: 'Feature Title',
      description: 'Feature description goes here',
    },
    defaultStyle: {
      padding: { top: '1.5rem', right: '1.5rem', bottom: '1.5rem', left: '1.5rem' },
      textAlign: 'center',
    },
  },

  'logo-grid': {
    label: 'Logo Grid',
    description: 'Client/partner logos',
    icon: '🏢',
    category: 'media',
    defaultData: {
      logos: [
        { src: 'https://via.placeholder.com/150x60', alt: 'Logo 1' },
        { src: 'https://via.placeholder.com/150x60', alt: 'Logo 2' },
        { src: 'https://via.placeholder.com/150x60', alt: 'Logo 3' },
      ],
      grayscale: true,
    },
    defaultStyle: {
      display: 'grid',
      padding: { top: '2rem', bottom: '2rem' },
    },
  },

  // ADVANCED WIDGETS
  'html': {
    label: 'HTML Block',
    description: 'Custom HTML',
    icon: '</>', 
    category: 'advanced',
    defaultData: {
      html: '<div>Custom HTML content</div>',
    },
    defaultStyle: {},
  },

  'code': {
    label: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: '{ }',
    category: 'advanced',
    defaultData: {
      code: 'console.log("Hello World");',
      language: 'javascript',
    },
    defaultStyle: {
      padding: { top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' },
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      fontFamily: 'monospace',
    },
  },

  'map': {
    label: 'Map',
    description: 'Google Maps embed',
    icon: '🗺️',
    category: 'advanced',
    defaultData: {
      address: '',
      latitude: 40.7128,
      longitude: -74.0060,
      zoom: 12,
    },
    defaultStyle: {
      width: '100%',
      height: '400px',
      borderRadius: '8px',
    },
  },

  'countdown': {
    label: 'Countdown',
    description: 'Event countdown timer',
    icon: '⏱️',
    category: 'advanced',
    defaultData: {
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      labels: {
        days: 'Days',
        hours: 'Hours',
        minutes: 'Minutes',
        seconds: 'Seconds',
      },
    },
    defaultStyle: {
      display: 'flex',
      justifyContent: 'center',
      padding: { top: '2rem', bottom: '2rem' },
    },
  },

  'social-icons': {
    label: 'Social Icons',
    description: 'Social media links',
    icon: '👥',
    category: 'advanced',
    defaultData: {
      icons: [
        { platform: 'facebook', url: '#' },
        { platform: 'twitter', url: '#' },
        { platform: 'instagram', url: '#' },
        { platform: 'linkedin', url: '#' },
      ],
    },
    defaultStyle: {
      display: 'flex',
      justifyContent: 'center',
      padding: { top: '1rem', bottom: '1rem' },
    },
  },

  'blog-list': {
    label: 'Blog List',
    description: 'List of blog posts',
    icon: '📰',
    category: 'advanced',
    defaultData: {
      postsPerPage: 6,
      layout: 'grid',
      showExcerpt: true,
      showAuthor: true,
      showDate: true,
    },
    defaultStyle: {
      display: 'grid',
    },
  },

  'blog-post': {
    label: 'Blog Post',
    description: 'Single blog post',
    icon: '📝',
    category: 'advanced',
    defaultData: {
      postId: '',
    },
    defaultStyle: {},
  },

  'ecommerce': {
    label: 'E-commerce',
    description: 'Product showcase',
    icon: '🛒',
    category: 'advanced',
    defaultData: {
      productIds: [],
      layout: 'grid',
    },
    defaultStyle: {
      display: 'grid',
    },
  },
};

