/**
 * Page Template Library
 * Professional, production-ready templates across multiple categories
 * Each template includes complete PageSection[] structure
 */

import type { PageTemplate } from '@/types/website';

/**
 * 1. Business Landing Page
 * Hero + Features + Testimonials + CTA
 */
export const businessLandingTemplate: PageTemplate = {
  id: 'business-landing',
  organizationId: undefined, // Platform template
  name: 'Business Landing Page',
  description: 'Perfect for showcasing your business with hero, features, and call-to-action',
  category: 'business',
  thumbnail: 'https://via.placeholder.com/400x300/007bff/ffffff?text=Business+Landing',
  content: [
    // Hero Section
    {
      id: 'hero-section',
      type: 'section',
      columns: [
        {
          id: 'hero-col',
          width: 100,
          widgets: [
            {
              id: 'hero-widget',
              type: 'hero',
              data: {
                heading: 'Grow Your Business with Confidence',
                subheading: 'We help companies scale their operations with proven strategies and cutting-edge solutions',
                buttonText: 'Get Started',
                buttonUrl: '#contact',
                backgroundImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920',
              },
              style: {
                padding: { top: '6rem', right: '2rem', bottom: '6rem', left: '2rem' },
                textAlign: 'center',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#ffffff',
              },
            },
          ],
        },
      ],
      backgroundColor: '#1a1a1a',
      padding: { top: '0', bottom: '0' },
      fullWidth: true,
    },
    // Features Section
    {
      id: 'features-section',
      type: 'section',
      columns: [
        {
          id: 'features-col',
          width: 100,
          widgets: [
            {
              id: 'features-heading',
              type: 'heading',
              data: {
                text: 'Why Choose Us',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'features-widget',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '🚀',
                    title: 'Fast Results',
                    description: 'See measurable improvements in your business within the first 30 days',
                  },
                  {
                    icon: '🔒',
                    title: 'Secure & Reliable',
                    description: 'Enterprise-grade security protecting your data 24/7',
                  },
                  {
                    icon: '💪',
                    title: 'Expert Support',
                    description: 'Dedicated team of professionals ready to help you succeed',
                  },
                  {
                    icon: '📊',
                    title: 'Data-Driven',
                    description: 'Make informed decisions with comprehensive analytics and insights',
                  },
                  {
                    icon: '⚡',
                    title: 'Easy Integration',
                    description: 'Seamlessly integrate with your existing tools and workflows',
                  },
                  {
                    icon: '🎯',
                    title: 'Proven Results',
                    description: 'Join thousands of successful businesses already using our platform',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Stats Section
    {
      id: 'stats-section',
      type: 'section',
      columns: [
        {
          id: 'stats-col',
          width: 100,
          widgets: [
            {
              id: 'stats-widget',
              type: 'stats',
              data: {
                stats: [
                  { number: '10,000+', label: 'Happy Customers' },
                  { number: '99.9%', label: 'Uptime' },
                  { number: '50M+', label: 'API Requests/Month' },
                  { number: '24/7', label: 'Support Available' },
                ],
              },
              style: {
                display: 'grid',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '4rem', bottom: '4rem' },
    },
    // Testimonials Section
    {
      id: 'testimonials-section',
      type: 'section',
      columns: [
        {
          id: 'testimonials-col',
          width: 100,
          widgets: [
            {
              id: 'testimonials-heading',
              type: 'heading',
              data: {
                text: 'What Our Customers Say',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'testimonial-1',
              type: 'testimonial',
              data: {
                quote: 'This platform transformed how we do business. The results exceeded our expectations.',
                author: 'Sarah Johnson',
                role: 'CEO, TechCorp',
                avatar: 'https://i.pravatar.cc/150?img=1',
              },
              style: {
                padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                textAlign: 'center',
                margin: { bottom: '2rem' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // CTA Section
    {
      id: 'cta-section',
      type: 'section',
      columns: [
        {
          id: 'cta-col',
          width: 100,
          widgets: [
            {
              id: 'cta-widget',
              type: 'cta',
              data: {
                heading: 'Ready to Get Started?',
                subheading: 'Join thousands of successful businesses today',
                buttonText: 'Start Free Trial',
                buttonUrl: '#signup',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#007bff',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 2. SaaS Homepage
 * Modern SaaS landing page with features and pricing
 */
export const saasHomepageTemplate: PageTemplate = {
  id: 'saas-homepage',
  organizationId: undefined,
  name: 'SaaS Homepage',
  description: 'Modern SaaS landing page with hero, features, pricing, and testimonials',
  category: 'saas',
  thumbnail: 'https://via.placeholder.com/400x300/6610f2/ffffff?text=SaaS+Homepage',
  content: [
    // Hero Section
    {
      id: 'saas-hero',
      type: 'section',
      columns: [
        {
          id: 'saas-hero-col',
          width: 100,
          widgets: [
            {
              id: 'saas-hero-heading',
              type: 'heading',
              data: {
                text: 'The Modern Way to Manage Your Work',
                level: 1,
                tag: 'h1',
              },
              style: {
                fontSize: '3.5rem',
                fontWeight: '800',
                color: '#ffffff',
                textAlign: 'center',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'saas-hero-text',
              type: 'text',
              data: {
                content: 'Streamline your workflow, boost productivity, and collaborate seamlessly with your team. All in one powerful platform.',
              },
              style: {
                fontSize: '1.25rem',
                lineHeight: '1.6',
                color: '#e9ecef',
                textAlign: 'center',
                margin: { bottom: '2rem' },
              },
            },
            {
              id: 'saas-hero-button',
              type: 'button',
              data: {
                text: 'Start Free Trial',
                url: '#signup',
                openInNewTab: false,
              },
              style: {
                padding: { top: '1rem', right: '2.5rem', bottom: '1rem', left: '2.5rem' },
                backgroundColor: '#ffffff',
                color: '#007bff',
                border: 'none',
                borderRadius: '50px',
                fontSize: '1.125rem',
                fontWeight: '600',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
      backgroundColor: '#007bff',
      padding: { top: '6rem', bottom: '6rem' },
      fullWidth: true,
    },
    // Features Section
    {
      id: 'saas-features',
      type: 'section',
      columns: [
        {
          id: 'saas-features-col',
          width: 100,
          widgets: [
            {
              id: 'saas-features-heading',
              type: 'heading',
              data: {
                text: 'Everything You Need to Succeed',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'saas-features-grid',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '⚡',
                    title: 'Lightning Fast',
                    description: 'Optimized for speed with sub-second response times',
                  },
                  {
                    icon: '🤝',
                    title: 'Team Collaboration',
                    description: 'Work together in real-time with your entire team',
                  },
                  {
                    icon: '🔐',
                    title: 'Bank-Level Security',
                    description: 'Your data is encrypted and protected at all times',
                  },
                  {
                    icon: '📱',
                    title: 'Mobile Ready',
                    description: 'Access your work anywhere on any device',
                  },
                  {
                    icon: '🔄',
                    title: 'Auto-Sync',
                    description: 'All your changes sync automatically across devices',
                  },
                  {
                    icon: '📈',
                    title: 'Advanced Analytics',
                    description: 'Track performance with detailed insights and reports',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Pricing Section
    {
      id: 'saas-pricing',
      type: 'section',
      columns: [
        {
          id: 'saas-pricing-col',
          width: 100,
          widgets: [
            {
              id: 'saas-pricing-heading',
              type: 'heading',
              data: {
                text: 'Simple, Transparent Pricing',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'saas-pricing-table',
              type: 'pricing',
              data: {
                plans: [
                  {
                    name: 'Starter',
                    price: '$9',
                    period: 'month',
                    features: [
                      '5 Projects',
                      '10 GB Storage',
                      'Basic Support',
                      'Mobile Apps',
                    ],
                    buttonText: 'Get Started',
                    buttonUrl: '#signup',
                  },
                  {
                    name: 'Professional',
                    price: '$29',
                    period: 'month',
                    features: [
                      'Unlimited Projects',
                      '100 GB Storage',
                      'Priority Support',
                      'Advanced Analytics',
                      'Custom Integrations',
                      'Team Collaboration',
                    ],
                    buttonText: 'Get Started',
                    buttonUrl: '#signup',
                    featured: true,
                  },
                  {
                    name: 'Enterprise',
                    price: '$99',
                    period: 'month',
                    features: [
                      'Everything in Pro',
                      'Unlimited Storage',
                      '24/7 Phone Support',
                      'Dedicated Account Manager',
                      'Custom SLA',
                      'On-premise Deployment',
                    ],
                    buttonText: 'Contact Sales',
                    buttonUrl: '#contact',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // CTA Section
    {
      id: 'saas-cta',
      type: 'section',
      columns: [
        {
          id: 'saas-cta-col',
          width: 100,
          widgets: [
            {
              id: 'saas-cta-widget',
              type: 'cta',
              data: {
                heading: 'Start Your Free Trial Today',
                subheading: 'No credit card required. Cancel anytime.',
                buttonText: 'Get Started Free',
                buttonUrl: '#signup',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#28a745',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 3. E-commerce Storefront
 * Product showcase with hero and features
 */
export const ecommerceStorefrontTemplate: PageTemplate = {
  id: 'ecommerce-storefront',
  organizationId: undefined,
  name: 'E-commerce Storefront',
  description: 'Modern storefront design perfect for showcasing products',
  category: 'ecommerce',
  thumbnail: 'https://via.placeholder.com/400x300/28a745/ffffff?text=E-commerce',
  content: [
    // Hero Banner
    {
      id: 'ecom-hero',
      type: 'section',
      columns: [
        {
          id: 'ecom-hero-col',
          width: 100,
          widgets: [
            {
              id: 'ecom-hero-widget',
              type: 'hero',
              data: {
                heading: 'Summer Sale - Up to 50% Off',
                subheading: 'Shop the latest trends at unbeatable prices',
                buttonText: 'Shop Now',
                buttonUrl: '#products',
                backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920',
              },
              style: {
                padding: { top: '5rem', right: '2rem', bottom: '5rem', left: '2rem' },
                textAlign: 'center',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#ffffff',
              },
            },
          ],
        },
      ],
      backgroundColor: '#000000',
      padding: { top: '0', bottom: '0' },
      fullWidth: true,
    },
    // Product Categories
    {
      id: 'ecom-categories',
      type: 'section',
      columns: [
        {
          id: 'ecom-categories-col',
          width: 100,
          widgets: [
            {
              id: 'ecom-categories-heading',
              type: 'heading',
              data: {
                text: 'Shop by Category',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'ecom-categories-grid',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '👔',
                    title: 'Men\'s Fashion',
                    description: 'Latest styles for modern men',
                  },
                  {
                    icon: '👗',
                    title: 'Women\'s Fashion',
                    description: 'Trendy outfits for every occasion',
                  },
                  {
                    icon: '👟',
                    title: 'Footwear',
                    description: 'Step out in style',
                  },
                  {
                    icon: '💼',
                    title: 'Accessories',
                    description: 'Complete your look',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Featured Products (using ecommerce widget)
    {
      id: 'ecom-products',
      type: 'section',
      columns: [
        {
          id: 'ecom-products-col',
          width: 100,
          widgets: [
            {
              id: 'ecom-products-heading',
              type: 'heading',
              data: {
                text: 'Featured Products',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'ecom-products-widget',
              type: 'ecommerce',
              data: {
                productIds: [],
                layout: 'grid',
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Newsletter Signup
    {
      id: 'ecom-newsletter',
      type: 'section',
      columns: [
        {
          id: 'ecom-newsletter-col',
          width: 100,
          widgets: [
            {
              id: 'ecom-newsletter-widget',
              type: 'newsletter',
              data: {
                heading: 'Get 10% Off Your First Order',
                placeholder: 'Enter your email',
                buttonText: 'Subscribe',
                successMessage: 'Thanks! Check your inbox for your discount code.',
              },
              style: {
                padding: { top: '3rem', right: '2rem', bottom: '3rem', left: '2rem' },
                backgroundColor: '#007bff',
                color: '#ffffff',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 4. Portfolio
 * Showcase your work with project gallery
 */
export const portfolioTemplate: PageTemplate = {
  id: 'portfolio',
  organizationId: undefined,
  name: 'Portfolio',
  description: 'Showcase your work with a beautiful portfolio layout',
  category: 'portfolio',
  thumbnail: 'https://via.placeholder.com/400x300/6f42c1/ffffff?text=Portfolio',
  content: [
    // Hero Introduction
    {
      id: 'portfolio-hero',
      type: 'section',
      columns: [
        {
          id: 'portfolio-hero-col',
          width: 100,
          widgets: [
            {
              id: 'portfolio-hero-heading',
              type: 'heading',
              data: {
                text: 'Hi, I\'m Alex Smith',
                level: 1,
                tag: 'h1',
              },
              style: {
                fontSize: '3.5rem',
                fontWeight: '800',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'portfolio-hero-subheading',
              type: 'heading',
              data: {
                text: 'Creative Designer & Developer',
                level: 3,
                tag: 'h3',
              },
              style: {
                fontSize: '1.5rem',
                fontWeight: '400',
                color: '#6c757d',
                textAlign: 'center',
                margin: { bottom: '2rem' },
              },
            },
            {
              id: 'portfolio-hero-text',
              type: 'text',
              data: {
                content: 'I create beautiful, functional digital experiences that users love. Specializing in web design, UI/UX, and front-end development.',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.8',
                color: '#495057',
                textAlign: 'center',
                margin: { bottom: '2rem' },
                maxWidth: '600px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '6rem', bottom: '4rem' },
    },
    // Project Gallery
    {
      id: 'portfolio-gallery',
      type: 'section',
      columns: [
        {
          id: 'portfolio-gallery-col',
          width: 100,
          widgets: [
            {
              id: 'portfolio-gallery-heading',
              type: 'heading',
              data: {
                text: 'Recent Work',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'portfolio-gallery-widget',
              type: 'gallery',
              data: {
                images: [
                  { src: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800', alt: 'Project 1' },
                  { src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', alt: 'Project 2' },
                  { src: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=800', alt: 'Project 3' },
                  { src: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800', alt: 'Project 4' },
                  { src: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800', alt: 'Project 5' },
                  { src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800', alt: 'Project 6' },
                ],
                columns: 3,
                gap: '1.5rem',
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Skills
    {
      id: 'portfolio-skills',
      type: 'section',
      columns: [
        {
          id: 'portfolio-skills-col',
          width: 100,
          widgets: [
            {
              id: 'portfolio-skills-heading',
              type: 'heading',
              data: {
                text: 'Skills & Expertise',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'skill-1',
              type: 'progress',
              data: {
                label: 'UI/UX Design',
                percentage: 95,
                color: '#007bff',
              },
              style: {
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'skill-2',
              type: 'progress',
              data: {
                label: 'Front-end Development',
                percentage: 90,
                color: '#28a745',
              },
              style: {
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'skill-3',
              type: 'progress',
              data: {
                label: 'Graphic Design',
                percentage: 85,
                color: '#ffc107',
              },
              style: {
                margin: { bottom: '1.5rem' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Contact CTA
    {
      id: 'portfolio-contact',
      type: 'section',
      columns: [
        {
          id: 'portfolio-contact-col',
          width: 100,
          widgets: [
            {
              id: 'portfolio-contact-widget',
              type: 'cta',
              data: {
                heading: 'Let\'s Work Together',
                subheading: 'Have a project in mind? Get in touch!',
                buttonText: 'Contact Me',
                buttonUrl: '#contact',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#6f42c1',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 5. Agency
 * Service-focused agency website
 */
export const agencyTemplate: PageTemplate = {
  id: 'agency',
  organizationId: undefined,
  name: 'Agency',
  description: 'Perfect for digital agencies showcasing services and case studies',
  category: 'agency',
  thumbnail: 'https://via.placeholder.com/400x300/e83e8c/ffffff?text=Agency',
  content: [
    // Hero
    {
      id: 'agency-hero',
      type: 'section',
      columns: [
        {
          id: 'agency-hero-col',
          width: 100,
          widgets: [
            {
              id: 'agency-hero-widget',
              type: 'hero',
              data: {
                heading: 'We Build Digital Experiences',
                subheading: 'Award-winning agency specializing in web design, branding, and digital marketing',
                buttonText: 'View Our Work',
                buttonUrl: '#portfolio',
                backgroundImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920',
              },
              style: {
                padding: { top: '6rem', right: '2rem', bottom: '6rem', left: '2rem' },
                textAlign: 'center',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#ffffff',
              },
            },
          ],
        },
      ],
      backgroundColor: '#000000',
      padding: { top: '0', bottom: '0' },
      fullWidth: true,
    },
    // Services
    {
      id: 'agency-services',
      type: 'section',
      columns: [
        {
          id: 'agency-services-col',
          width: 100,
          widgets: [
            {
              id: 'agency-services-heading',
              type: 'heading',
              data: {
                text: 'Our Services',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'agency-services-grid',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '🎨',
                    title: 'Web Design',
                    description: 'Beautiful, user-centered designs that convert visitors into customers',
                  },
                  {
                    icon: '💻',
                    title: 'Development',
                    description: 'Custom web applications built with modern technologies',
                  },
                  {
                    icon: '📱',
                    title: 'Mobile Apps',
                    description: 'Native and cross-platform mobile solutions',
                  },
                  {
                    icon: '🎯',
                    title: 'Digital Marketing',
                    description: 'Data-driven strategies that grow your business',
                  },
                  {
                    icon: '✨',
                    title: 'Branding',
                    description: 'Memorable brand identities that stand out',
                  },
                  {
                    icon: '📊',
                    title: 'Analytics',
                    description: 'Insights and optimization to maximize your ROI',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Stats
    {
      id: 'agency-stats',
      type: 'section',
      columns: [
        {
          id: 'agency-stats-col',
          width: 100,
          widgets: [
            {
              id: 'agency-stats-widget',
              type: 'stats',
              data: {
                stats: [
                  { number: '200+', label: 'Projects Completed' },
                  { number: '50+', label: 'Happy Clients' },
                  { number: '15+', label: 'Team Members' },
                  { number: '10', label: 'Years Experience' },
                ],
              },
              style: {
                display: 'grid',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
      backgroundColor: '#e83e8c',
      padding: { top: '4rem', bottom: '4rem' },
    },
    // Client Logos
    {
      id: 'agency-clients',
      type: 'section',
      columns: [
        {
          id: 'agency-clients-col',
          width: 100,
          widgets: [
            {
              id: 'agency-clients-heading',
              type: 'heading',
              data: {
                text: 'Trusted by Leading Brands',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'agency-clients-logos',
              type: 'logo-grid',
              data: {
                logos: [
                  { src: 'https://via.placeholder.com/150x60?text=Brand+1', alt: 'Client 1' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+2', alt: 'Client 2' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+3', alt: 'Client 3' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+4', alt: 'Client 4' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+5', alt: 'Client 5' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+6', alt: 'Client 6' },
                ],
                grayscale: true,
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // CTA
    {
      id: 'agency-cta',
      type: 'section',
      columns: [
        {
          id: 'agency-cta-col',
          width: 100,
          widgets: [
            {
              id: 'agency-cta-widget',
              type: 'cta',
              data: {
                heading: 'Ready to Start Your Project?',
                subheading: 'Let\'s create something amazing together',
                buttonText: 'Get in Touch',
                buttonUrl: '#contact',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#212529',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 6. Blog/Magazine
 * Content-focused blog layout
 */
export const blogMagazineTemplate: PageTemplate = {
  id: 'blog-magazine',
  organizationId: undefined,
  name: 'Blog/Magazine',
  description: 'Clean blog layout perfect for content creators',
  category: 'blog',
  thumbnail: 'https://via.placeholder.com/400x300/fd7e14/ffffff?text=Blog',
  content: [
    // Header
    {
      id: 'blog-header',
      type: 'section',
      columns: [
        {
          id: 'blog-header-col',
          width: 100,
          widgets: [
            {
              id: 'blog-header-heading',
              type: 'heading',
              data: {
                text: 'The Daily Insights',
                level: 1,
                tag: 'h1',
              },
              style: {
                fontSize: '3rem',
                fontWeight: '800',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'blog-header-subheading',
              type: 'text',
              data: {
                content: 'Your source for the latest news, trends, and insights',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.6',
                color: '#6c757d',
                textAlign: 'center',
                margin: { bottom: '0' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '4rem', bottom: '3rem' },
    },
    // Featured Post
    {
      id: 'blog-featured',
      type: 'section',
      columns: [
        {
          id: 'blog-featured-col',
          width: 100,
          widgets: [
            {
              id: 'blog-featured-image',
              type: 'image',
              data: {
                src: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200',
                alt: 'Featured post',
                caption: '',
              },
              style: {
                width: '100%',
                height: 'auto',
                borderRadius: '8px',
                margin: { bottom: '2rem' },
              },
            },
            {
              id: 'blog-featured-heading',
              type: 'heading',
              data: {
                text: 'How to Build a Successful Online Business in 2024',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'blog-featured-excerpt',
              type: 'text',
              data: {
                content: 'Discover the essential strategies and tools you need to launch and grow a thriving online business. From marketing to operations, we cover it all.',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.8',
                color: '#495057',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'blog-featured-button',
              type: 'button',
              data: {
                text: 'Read More',
                url: '#',
                openInNewTab: false,
              },
              style: {
                padding: { top: '0.75rem', right: '1.5rem', bottom: '0.75rem', left: '1.5rem' },
                backgroundColor: '#fd7e14',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '500',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '3rem', bottom: '3rem' },
    },
    // Blog Posts List
    {
      id: 'blog-posts',
      type: 'section',
      columns: [
        {
          id: 'blog-posts-col',
          width: 100,
          widgets: [
            {
              id: 'blog-posts-heading',
              type: 'heading',
              data: {
                text: 'Latest Articles',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'blog-posts-widget',
              type: 'blog-list',
              data: {
                postsPerPage: 6,
                layout: 'grid',
                showExcerpt: true,
                showAuthor: true,
                showDate: true,
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Newsletter
    {
      id: 'blog-newsletter',
      type: 'section',
      columns: [
        {
          id: 'blog-newsletter-col',
          width: 100,
          widgets: [
            {
              id: 'blog-newsletter-widget',
              type: 'newsletter',
              data: {
                heading: 'Never Miss an Update',
                placeholder: 'Enter your email address',
                buttonText: 'Subscribe',
                successMessage: 'Thanks for subscribing! Check your inbox.',
              },
              style: {
                padding: { top: '3rem', right: '2rem', bottom: '3rem', left: '2rem' },
                backgroundColor: '#fd7e14',
                color: '#ffffff',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 7. Coming Soon
 * Pre-launch page with countdown
 */
export const comingSoonTemplate: PageTemplate = {
  id: 'coming-soon',
  organizationId: undefined,
  name: 'Coming Soon',
  description: 'Build anticipation with a countdown timer and email capture',
  category: 'other',
  thumbnail: 'https://via.placeholder.com/400x300/20c997/ffffff?text=Coming+Soon',
  content: [
    {
      id: 'coming-soon-section',
      type: 'section',
      columns: [
        {
          id: 'coming-soon-col',
          width: 100,
          widgets: [
            {
              id: 'coming-soon-heading',
              type: 'heading',
              data: {
                text: 'Something Amazing is Coming',
                level: 1,
                tag: 'h1',
              },
              style: {
                fontSize: '3.5rem',
                fontWeight: '800',
                color: '#ffffff',
                textAlign: 'center',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'coming-soon-text',
              type: 'text',
              data: {
                content: 'We\'re working hard to bring you something special. Stay tuned!',
              },
              style: {
                fontSize: '1.25rem',
                lineHeight: '1.6',
                color: '#e9ecef',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'coming-soon-countdown',
              type: 'countdown',
              data: {
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                labels: {
                  days: 'Days',
                  hours: 'Hours',
                  minutes: 'Minutes',
                  seconds: 'Seconds',
                },
              },
              style: {
                display: 'flex',
                justifyContent: 'center',
                padding: { top: '2rem', bottom: '3rem' },
              },
            },
            {
              id: 'coming-soon-newsletter',
              type: 'newsletter',
              data: {
                heading: 'Get Notified When We Launch',
                placeholder: 'Enter your email',
                buttonText: 'Notify Me',
                successMessage: 'Thanks! We\'ll let you know when we launch.',
              },
              style: {
                padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                maxWidth: '500px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
            {
              id: 'coming-soon-social',
              type: 'social-icons',
              data: {
                icons: [
                  { platform: 'facebook', url: '#' },
                  { platform: 'twitter', url: '#' },
                  { platform: 'instagram', url: '#' },
                  { platform: 'linkedin', url: '#' },
                ],
              },
              style: {
                display: 'flex',
                justifyContent: 'center',
                padding: { top: '3rem' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#20c997',
      padding: { top: '8rem', bottom: '8rem' },
      fullWidth: true,
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * 8. Contact/About
 * Contact form with team bios
 */
export const contactAboutTemplate: PageTemplate = {
  id: 'contact-about',
  organizationId: undefined,
  name: 'Contact & About',
  description: 'Contact page with form, map, and team information',
  category: 'business',
  thumbnail: 'https://via.placeholder.com/400x300/17a2b8/ffffff?text=Contact',
  content: [
    // Header
    {
      id: 'contact-header',
      type: 'section',
      columns: [
        {
          id: 'contact-header-col',
          width: 100,
          widgets: [
            {
              id: 'contact-header-heading',
              type: 'heading',
              data: {
                text: 'Get in Touch',
                level: 1,
                tag: 'h1',
              },
              style: {
                fontSize: '3rem',
                fontWeight: '800',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'contact-header-text',
              type: 'text',
              data: {
                content: 'Have a question or want to work together? We\'d love to hear from you.',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.6',
                color: '#6c757d',
                textAlign: 'center',
                margin: { bottom: '0' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '4rem', bottom: '3rem' },
    },
    // Contact Form
    {
      id: 'contact-form-section',
      type: 'section',
      columns: [
        {
          id: 'contact-form-col',
          width: 100,
          widgets: [
            {
              id: 'contact-form-widget',
              type: 'contact-form',
              data: {
                fields: ['name', 'email', 'phone', 'message'],
                submitText: 'Send Message',
                successMessage: 'Thank you! We\'ll get back to you within 24 hours.',
                saveToCRM: true,
              },
              style: {
                padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                maxWidth: '600px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '3rem', bottom: '5rem' },
    },
    // Map
    {
      id: 'contact-map',
      type: 'section',
      columns: [
        {
          id: 'contact-map-col',
          width: 100,
          widgets: [
            {
              id: 'contact-map-widget',
              type: 'map',
              data: {
                address: 'New York, NY',
                latitude: 40.7128,
                longitude: -74.0060,
                zoom: 12,
              },
              style: {
                width: '100%',
                height: '400px',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // Team
    {
      id: 'contact-team',
      type: 'section',
      columns: [
        {
          id: 'contact-team-col',
          width: 100,
          widgets: [
            {
              id: 'contact-team-heading',
              type: 'heading',
              data: {
                text: 'Our Team',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'contact-team-members',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '👨‍💼',
                    title: 'John Doe',
                    description: 'CEO & Founder - Leading the vision and strategy',
                  },
                  {
                    icon: '👩‍💻',
                    title: 'Jane Smith',
                    description: 'CTO - Building world-class technology',
                  },
                  {
                    icon: '👨‍🎨',
                    title: 'Mike Johnson',
                    description: 'Creative Director - Crafting beautiful experiences',
                  },
                ],
              },
              style: {
                display: 'grid',
              },
            },
          ],
        },
      ],
      backgroundColor: '#ffffff',
      padding: { top: '5rem', bottom: '5rem' },
    },
    // FAQ
    {
      id: 'contact-faq',
      type: 'section',
      columns: [
        {
          id: 'contact-faq-col',
          width: 100,
          widgets: [
            {
              id: 'contact-faq-heading',
              type: 'heading',
              data: {
                text: 'Frequently Asked Questions',
                level: 2,
                tag: 'h2',
              },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#212529',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'contact-faq-widget',
              type: 'faq',
              data: {
                faqs: [
                  {
                    question: 'What are your business hours?',
                    answer: 'We\'re available Monday through Friday, 9 AM to 6 PM EST.',
                  },
                  {
                    question: 'How quickly do you respond to inquiries?',
                    answer: 'We typically respond within 24 hours during business days.',
                  },
                  {
                    question: 'Do you offer consultations?',
                    answer: 'Yes! We offer free 30-minute consultations for new clients.',
                  },
                  {
                    question: 'What services do you provide?',
                    answer: 'We offer web design, development, branding, and digital marketing services.',
                  },
                ],
              },
              style: {
                maxWidth: '800px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  ],
  isPublic: true,
  isPremium: false,
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  usageCount: 0,
};

/**
 * All templates exported as array
 */
export const allTemplates: PageTemplate[] = [
  businessLandingTemplate,
  saasHomepageTemplate,
  ecommerceStorefrontTemplate,
  portfolioTemplate,
  agencyTemplate,
  blogMagazineTemplate,
  comingSoonTemplate,
  contactAboutTemplate,
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: PageTemplate['category']): PageTemplate[] {
  return allTemplates.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PageTemplate | undefined {
  return allTemplates.find(t => t.id === id);
}


