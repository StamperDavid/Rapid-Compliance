/**
 * Unit tests for Proxy Rotation in BrowserController
 * Tests proxy configuration and rotation functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BrowserController, createBrowserControllerWithProxies, type ProxyConfig } from '@/lib/services/BrowserController';

describe('Proxy Rotation Tests', () => {
  let controller: BrowserController;

  afterEach(async () => {
    if (controller) {
      await controller.close();
    }
  });

  describe('Proxy Configuration', () => {
    it('should create BrowserController without proxy', () => {
      controller = new BrowserController({ headless: true });
      const status = controller.getProxyStatus();

      expect(status.totalProxies).toBe(0);
      expect(status.currentProxy).toBeNull();
      expect(status.currentIndex).toBe(0);
    });

    it('should create BrowserController with single proxy', () => {
      const proxy: ProxyConfig = {
        server: 'http://proxy.example.com:8080',
        username: 'user',
        password: 'pass',
      };

      controller = new BrowserController({
        headless: true,
        proxy,
      });

      const status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(1);
      expect(status.currentProxy).toEqual(proxy);
    });

    it('should create BrowserController with proxy list', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
        { server: 'http://proxy3.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      const status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(3);
      expect(status.currentProxy).toEqual(proxies[0]);
    });

    it('should create BrowserController with helper function', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
      ];

      controller = createBrowserControllerWithProxies(proxies, {
        headless: true,
      });

      const status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(2);
      expect(status.currentProxy).toEqual(proxies[0]);
    });
  });

  describe('Proxy Rotation', () => {
    it('should rotate to next proxy', async () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
        { server: 'http://proxy3.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      // Initial proxy should be first one
      let status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(0);
      expect(status.currentProxy?.server).toBe(proxies[0].server);

      // Rotate to next proxy
      await controller.rotateProxy();
      status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(1);
      expect(status.currentProxy?.server).toBe(proxies[1].server);

      // Rotate again
      await controller.rotateProxy();
      status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(2);
      expect(status.currentProxy?.server).toBe(proxies[2].server);

      // Rotate back to first (circular)
      await controller.rotateProxy();
      status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(0);
      expect(status.currentProxy?.server).toBe(proxies[0].server);
    }, 30000);

    it('should not rotate when only one proxy', async () => {
      const proxy: ProxyConfig = {
        server: 'http://proxy.example.com:8080',
      };

      controller = new BrowserController({
        headless: true,
        proxy,
      });

      const initialStatus = controller.getProxyStatus();
      await controller.rotateProxy();
      const afterStatus = controller.getProxyStatus();

      expect(afterStatus.currentIndex).toBe(initialStatus.currentIndex);
      expect(afterStatus.currentProxy).toEqual(initialStatus.currentProxy);
    });

    it('should not rotate when no proxies', async () => {
      controller = new BrowserController({ headless: true });

      const initialStatus = controller.getProxyStatus();
      await controller.rotateProxy();
      const afterStatus = controller.getProxyStatus();

      expect(afterStatus.currentIndex).toBe(initialStatus.currentIndex);
      expect(afterStatus.currentProxy).toBeNull();
    });
  });

  describe('Manual Proxy Selection', () => {
    it('should manually set proxy by index', async () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
        { server: 'http://proxy3.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      // Set to second proxy
      await controller.setProxyByIndex(1);
      let status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(1);
      expect(status.currentProxy?.server).toBe(proxies[1].server);

      // Set to third proxy
      await controller.setProxyByIndex(2);
      status = controller.getProxyStatus();
      expect(status.currentIndex).toBe(2);
      expect(status.currentProxy?.server).toBe(proxies[2].server);
    }, 30000);

    it('should throw error for invalid proxy index', async () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      await expect(
        controller.setProxyByIndex(5)
      ).rejects.toThrow('Invalid proxy index');

      await expect(
        controller.setProxyByIndex(-1)
      ).rejects.toThrow('Invalid proxy index');
    });
  });

  describe('Dynamic Proxy Management', () => {
    it('should add proxy to rotation list', () => {
      controller = new BrowserController({ headless: true });

      const proxy1: ProxyConfig = { server: 'http://proxy1.example.com:8080' };
      const proxy2: ProxyConfig = { server: 'http://proxy2.example.com:8080' };

      controller.addProxy(proxy1);
      let status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(1);

      controller.addProxy(proxy2);
      status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(2);
    });

    it('should remove proxy from rotation list', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
        { server: 'http://proxy3.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: [...proxies],
      });

      // Remove middle proxy
      controller.removeProxy(1);
      const status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(2);
    });

    it('should adjust current index after removal', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
        { server: 'http://proxy2.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: [...proxies],
      });

      // Remove all proxies
      controller.removeProxy(1);
      controller.removeProxy(0);
      
      const status = controller.getProxyStatus();
      expect(status.totalProxies).toBe(0);
      expect(status.currentIndex).toBe(0);
    });

    it('should throw error when removing invalid index', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      expect(() => {
        controller.removeProxy(5);
      }).toThrow('Invalid proxy index');

      expect(() => {
        controller.removeProxy(-1);
      }).toThrow('Invalid proxy index');
    });
  });

  describe('Proxy Status', () => {
    it('should track request failure count', () => {
      controller = new BrowserController({ headless: true });
      const status = controller.getProxyStatus();

      expect(status.failureCount).toBe(0);
    });

    it('should provide complete proxy status', () => {
      const proxies: ProxyConfig[] = [
        { server: 'http://proxy1.example.com:8080', username: 'user1' },
        { server: 'http://proxy2.example.com:8080', username: 'user2' },
      ];

      controller = new BrowserController({
        headless: true,
        proxyList: proxies,
      });

      const status = controller.getProxyStatus();
      
      expect(status).toHaveProperty('currentIndex');
      expect(status).toHaveProperty('totalProxies');
      expect(status).toHaveProperty('currentProxy');
      expect(status).toHaveProperty('failureCount');
      
      expect(typeof status.currentIndex).toBe('number');
      expect(typeof status.totalProxies).toBe('number');
      expect(typeof status.failureCount).toBe('number');
    });
  });

  describe('Proxy Authentication', () => {
    it('should support proxy with username and password', () => {
      const proxy: ProxyConfig = {
        server: 'http://proxy.example.com:8080',
        username: 'testuser',
        password: 'testpass',
      };

      controller = new BrowserController({
        headless: true,
        proxy,
      });

      const status = controller.getProxyStatus();
      expect(status.currentProxy?.username).toBe('testuser');
      expect(status.currentProxy?.password).toBe('testpass');
    });

    it('should support proxy with bypass domains', () => {
      const proxy: ProxyConfig = {
        server: 'http://proxy.example.com:8080',
        bypass: 'localhost,127.0.0.1',
      };

      controller = new BrowserController({
        headless: true,
        proxy,
      });

      const status = controller.getProxyStatus();
      expect(status.currentProxy?.bypass).toBe('localhost,127.0.0.1');
    });
  });
});
