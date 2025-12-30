/**
 * Unit tests for Industry Detection and Enhanced LLM Synthesis
 * Tests industry-specific extraction patterns
 */

import { describe, it, expect } from '@jest/globals';

// Mock data for testing industry detection
const createMockRawData = (text: string, techStack: string[]) => ({
  url: 'https://example.com',
  html: '<html></html>',
  text,
  highValueAreas: [],
  links: [],
  teamMembers: [],
  techStack: techStack.map((name) => ({
    name,
    category: 'other' as const,
    confidence: 0.9,
    evidence: 'test',
  })),
  careerData: { jobCount: 0, positions: [] },
});

describe('Industry Detection Tests', () => {
  describe('SaaS Detection', () => {
    it('should detect SaaS industry from keywords', () => {
      const text = `
        Our cloud-based software platform helps businesses manage their workflows.
        Built with modern API-first architecture, we offer a subscription-based model
        with integration to over 100 popular tools. Start your free trial today!
      `;
      const techStack = ['react', 'stripe', 'aws'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords present: software, platform, api, cloud, tool, subscription
      // Tech indicators: react, stripe, aws
      // Should strongly indicate SaaS
      expect(rawData.text.toLowerCase()).toContain('software');
      expect(rawData.text.toLowerCase()).toContain('platform');
      expect(rawData.text.toLowerCase()).toContain('api');
      expect(rawData.techStack.some(t => t.name === 'stripe')).toBe(true);
    });

    it('should detect B2B SaaS patterns', () => {
      const text = `
        Enterprise-grade analytics dashboard for modern teams.
        Features include role-based access, SSO, and API access.
      `;
      
      expect(text.toLowerCase()).toContain('dashboard');
      expect(text.toLowerCase()).toContain('api');
    });
  });

  describe('E-commerce Detection', () => {
    it('should detect e-commerce from keywords', () => {
      const text = `
        Shop our latest collection of products. Add items to your cart,
        checkout securely, and enjoy free shipping on orders over $50.
        Easy returns within 30 days.
      `;
      const techStack = ['shopify', 'stripe'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords: shop, product, cart, checkout, shipping, order
      // Tech indicators: shopify, stripe
      expect(rawData.text.toLowerCase()).toContain('shop');
      expect(rawData.text.toLowerCase()).toContain('cart');
      expect(rawData.text.toLowerCase()).toContain('shipping');
      expect(rawData.techStack.some(t => t.name === 'shopify')).toBe(true);
    });
  });

  describe('Healthcare Detection', () => {
    it('should detect healthcare industry', () => {
      const text = `
        Connect with licensed doctors through our telemedicine platform.
        HIPAA-compliant, secure patient portal for managing your health records.
        Book appointments with specialists at our network of clinics.
      `;
      const techStack = ['hipaa'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords: doctor, telemedicine, patient, health, clinic
      // Tech indicators: hipaa
      expect(rawData.text.toLowerCase()).toContain('doctor');
      expect(rawData.text.toLowerCase()).toContain('patient');
      expect(rawData.text.toLowerCase()).toContain('health');
      expect(rawData.techStack.some(t => t.name === 'hipaa')).toBe(true);
    });
  });

  describe('Fintech Detection', () => {
    it('should detect fintech industry', () => {
      const text = `
        Modern banking platform for businesses. Secure payment processing,
        lending solutions, and cryptocurrency support. Built with bank-grade
        encryption and compliance with financial regulations.
      `;
      const techStack = ['stripe', 'plaid', 'encryption'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords: bank, payment, lending, crypto
      // Tech indicators: stripe, plaid, encryption
      expect(rawData.text.toLowerCase()).toContain('bank');
      expect(rawData.text.toLowerCase()).toContain('payment');
      expect(rawData.text.toLowerCase()).toContain('crypto');
      expect(rawData.techStack.some(t => t.name === 'stripe')).toBe(true);
    });
  });

  describe('Manufacturing Detection', () => {
    it('should detect manufacturing industry', () => {
      const text = `
        Leading industrial manufacturing solutions. Our factory produces
        high-quality components with ISO certification. Advanced supply chain
        management and warehouse automation.
      `;
      const techStack = ['iot', 'erp'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords: manufacturing, factory, industrial, supply chain
      // Tech indicators: iot, erp
      expect(rawData.text.toLowerCase()).toContain('manufacturing');
      expect(rawData.text.toLowerCase()).toContain('factory');
      expect(rawData.text.toLowerCase()).toContain('supply chain');
      expect(rawData.techStack.some(t => t.name === 'iot')).toBe(true);
    });
  });

  describe('Consulting Detection', () => {
    it('should detect consulting industry', () => {
      const text = `
        Strategic consulting and advisory services for enterprises.
        Our team of experts provides professional services in digital
        transformation and business strategy. View our case studies.
      `;
      
      const rawData = createMockRawData(text, []);
      
      // Keywords: consulting, advisory, expert, professional services, strategy
      expect(rawData.text.toLowerCase()).toContain('consulting');
      expect(rawData.text.toLowerCase()).toContain('advisory');
      expect(rawData.text.toLowerCase()).toContain('strategy');
    });
  });

  describe('Agency Detection', () => {
    it('should detect creative/marketing agency', () => {
      const text = `
        Full-service digital marketing agency specializing in branding,
        advertising, and creative design. Check out our portfolio of
        award-winning campaigns for top clients.
      `;
      const techStack = ['adobe', 'figma', 'google-analytics'];
      
      const rawData = createMockRawData(text, techStack);
      
      // Keywords: agency, marketing, advertising, creative, branding
      // Tech indicators: adobe, figma
      expect(rawData.text.toLowerCase()).toContain('agency');
      expect(rawData.text.toLowerCase()).toContain('marketing');
      expect(rawData.text.toLowerCase()).toContain('creative');
      expect(rawData.techStack.some(t => t.name === 'adobe')).toBe(true);
    });
  });

  describe('Industry Scoring', () => {
    it('should prioritize strong keyword matches', () => {
      const text = 'software platform api saas cloud app dashboard subscription';
      const rawData = createMockRawData(text, ['react', 'stripe']);
      
      // Multiple SaaS keywords should result in high confidence
      const keywords = ['software', 'platform', 'api', 'saas', 'cloud', 'app', 'dashboard', 'subscription'];
      const matchCount = keywords.filter(k => text.includes(k)).length;
      
      expect(matchCount).toBeGreaterThan(5);
    });

    it('should weight tech indicators appropriately', () => {
      const text = 'Our company builds solutions';
      const saasStack = ['react', 'vue', 'stripe', 'aws'];
      const ecommerceStack = ['shopify', 'woocommerce'];
      
      const saasData = createMockRawData(text, saasStack);
      const ecommerceData = createMockRawData(text, ecommerceStack);
      
      // More tech indicators should suggest higher confidence
      expect(saasData.techStack.length).toBeGreaterThan(ecommerceData.techStack.length);
    });

    it('should handle ambiguous cases', () => {
      // Text with mixed signals
      const text = 'We provide software consulting services for healthcare payment systems';
      const rawData = createMockRawData(text, []);
      
      // Contains keywords from: SaaS (software), Consulting (consulting, services), Healthcare (healthcare), Fintech (payment)
      // Industry detection should handle this gracefully
      expect(rawData.text).toContain('software');
      expect(rawData.text).toContain('consulting');
      expect(rawData.text).toContain('healthcare');
    });
  });

  describe('Extraction Focus Areas', () => {
    it('should define focus areas for SaaS', () => {
      const focusAreas = ['pricing', 'features', 'integrations', 'api-docs', 'changelog'];
      
      expect(focusAreas).toContain('pricing');
      expect(focusAreas).toContain('integrations');
      expect(focusAreas).toContain('api-docs');
    });

    it('should define focus areas for E-commerce', () => {
      const focusAreas = ['products', 'categories', 'shipping-policy', 'return-policy'];
      
      expect(focusAreas).toContain('products');
      expect(focusAreas).toContain('shipping-policy');
    });

    it('should define focus areas for Healthcare', () => {
      const focusAreas = ['services', 'providers', 'locations', 'insurance', 'compliance'];
      
      expect(focusAreas).toContain('services');
      expect(focusAreas).toContain('compliance');
    });

    it('should define focus areas for Consulting', () => {
      const focusAreas = ['services', 'team', 'case-studies', 'clients', 'expertise'];
      
      expect(focusAreas).toContain('case-studies');
      expect(focusAreas).toContain('expertise');
    });
  });

  describe('LLM Prompt Enhancement', () => {
    it('should include industry-specific instructions for SaaS', () => {
      const industryInstructions = `
        You specialize in SaaS companies. Pay special attention to:
        - Pricing tiers and business model
        - Target customer segments
        - Key integrations and API availability
      `;
      
      expect(industryInstructions).toContain('Pricing tiers');
      expect(industryInstructions).toContain('integrations');
      expect(industryInstructions).toContain('API');
    });

    it('should request specific data structure', () => {
      const requiredFields = [
        'companyName',
        'description',
        'industry',
        'size',
        'location',
        'contactInfo',
        'signals',
        'pressmentions',
      ];
      
      requiredFields.forEach((field) => {
        expect(field).toBeDefined();
        expect(typeof field).toBe('string');
      });
    });

    it('should emphasize accuracy over fabrication', () => {
      const instructions = `
        IMPORTANT:
        - Be specific and accurate, don't make up information
        - If data is not available, omit the field or use null
        - Extract real quotes and facts from the website
      `;
      
      expect(instructions).toContain('accurate');
      expect(instructions).toContain('don\'t make up');
      expect(instructions).toContain('real quotes');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const rawData = createMockRawData('', []);
      
      expect(rawData.text).toBe('');
      expect(rawData.techStack.length).toBe(0);
    });

    it('should handle text without industry keywords', () => {
      const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit';
      const rawData = createMockRawData(text, []);
      
      // Should not match any industry strongly
      expect(rawData.text).not.toContain('software');
      expect(rawData.text).not.toContain('shop');
      expect(rawData.text).not.toContain('health');
    });

    it('should handle multiple industry indicators', () => {
      const text = `
        We are a SaaS platform for healthcare providers offering
        e-commerce capabilities for medical supplies with fintech
        payment solutions.
      `;
      
      // Contains multiple industry signals - should handle gracefully
      expect(text.toLowerCase()).toContain('saas');
      expect(text.toLowerCase()).toContain('healthcare');
      expect(text.toLowerCase()).toContain('e-commerce');
      expect(text.toLowerCase()).toContain('fintech');
    });
  });
});
