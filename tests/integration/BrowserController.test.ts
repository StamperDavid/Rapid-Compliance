/**
 * Integration tests for BrowserController
 * Tests the Universal Browser Agent with stealth capabilities
 */

import { BrowserController, createBrowserController } from '@/lib/services/BrowserController';

describe('BrowserController Integration Tests', () => {
  let controller: BrowserController;

  beforeEach(() => {
    controller = createBrowserController();
  });

  afterEach(async () => {
    if (controller) {
      await controller.close();
    }
  });

  describe('Browser Lifecycle', () => {
    it('should launch browser successfully', async () => {
      await controller.launch();
      expect(controller.getPage()).not.toBeNull();
    });

    it('should close browser without errors', async () => {
      await controller.launch();
      await expect(controller.close()).resolves.not.toThrow();
    });

    it('should handle multiple close calls gracefully', async () => {
      await controller.launch();
      await controller.close();
      await expect(controller.close()).resolves.not.toThrow();
    });
  });

  describe('Navigation', () => {
    it('should navigate to URL successfully', async () => {
      await controller.navigate('https://example.com');
      expect(controller.getCurrentUrl()).toBe('https://example.com');
    }, 30000);

    it('should auto-launch browser if not launched', async () => {
      await controller.navigate('https://example.com');
      expect(controller.getPage()).not.toBeNull();
    }, 30000);
  });

  describe('Page Interaction', () => {
    beforeEach(async () => {
      await controller.navigate('https://example.com');
    }, 30000);

    it('should get page content', async () => {
      const content = await controller.getContent();
      expect(content).toContain('<!DOCTYPE html>');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should get text content', async () => {
      const text = await controller.getTextContent();
      expect(text).toContain('Example Domain');
    });

    it('should scroll to bottom', async () => {
      await expect(controller.scrollToBottom()).resolves.not.toThrow();
    });

    it('should take screenshot', async () => {
      const screenshot = await controller.screenshot();
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(0);
    });
  });

  describe('High-Value Area Detection', () => {
    it('should identify high-value areas on example.com', async () => {
      await controller.navigate('https://example.com');
      const areas = await controller.identifyHighValueAreas();
      
      expect(Array.isArray(areas)).toBe(true);
      // Example.com should have at least navigation/header
      expect(areas.length).toBeGreaterThan(0);
    }, 30000);

    it('should classify area types correctly', async () => {
      await controller.navigate('https://example.com');
      const areas = await controller.identifyHighValueAreas();
      
      const validTypes = ['footer', 'header', 'navigation', 'team', 'career', 'press', 'contact'];
      areas.forEach((area) => {
        expect(validTypes).toContain(area.type);
        expect(area.confidence).toBeGreaterThan(0);
        expect(area.confidence).toBeLessThanOrEqual(1);
        expect(area.selector).toBeTruthy();
      });
    }, 30000);
  });

  describe('Data Extraction', () => {
    it('should extract footer links', async () => {
      await controller.navigate('https://example.com');
      const links = await controller.findFooterLinks();
      
      expect(Array.isArray(links)).toBe(true);
      links.forEach((link) => {
        expect(link).toHaveProperty('href');
        expect(link).toHaveProperty('text');
      });
    }, 30000);

    it('should find career portal (may return null)', async () => {
      await controller.navigate('https://example.com');
      const careerData = await controller.findCareerPortal();
      
      // Example.com doesn't have career page, should return null
      expect(careerData === null || typeof careerData === 'object').toBe(true);
    }, 30000);

    it('should find team directory (may return empty array)', async () => {
      await controller.navigate('https://example.com');
      const teamMembers = await controller.findTeamDirectory();
      
      expect(Array.isArray(teamMembers)).toBe(true);
    }, 30000);

    it('should extract tech stack', async () => {
      await controller.navigate('https://example.com');
      const techStack = await controller.extractTechStack();
      
      expect(Array.isArray(techStack)).toBe(true);
      techStack.forEach((tech) => {
        expect(tech).toHaveProperty('name');
        expect(tech).toHaveProperty('category');
        expect(tech).toHaveProperty('confidence');
        expect(tech).toHaveProperty('evidence');
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should throw error when clicking without launching', async () => {
      await expect(controller.click('button')).rejects.toThrow('Browser not launched');
    });

    it('should throw error when scrolling without launching', async () => {
      await expect(controller.scrollToBottom()).rejects.toThrow('Browser not launched');
    });

    it('should throw error when waiting for selector without launching', async () => {
      await expect(controller.waitForSelector('div')).rejects.toThrow('Browser not launched');
    });

    it('should handle navigation errors gracefully', async () => {
      await expect(controller.navigate('https://invalid-domain-that-does-not-exist-12345.com'))
        .rejects.toThrow();
    }, 30000);
  });

  describe('Factory Function', () => {
    it('should create controller instance', () => {
      const newController = createBrowserController();
      expect(newController).toBeInstanceOf(BrowserController);
    });

    it('should accept launch options', () => {
      const newController = createBrowserController({ headless: true });
      expect(newController).toBeInstanceOf(BrowserController);
    });
  });
});
