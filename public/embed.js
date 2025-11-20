/**
 * CRM Store Embed SDK
 * Universal JavaScript SDK for embedding storefronts
 * 
 * Usage:
 * <script src="https://yourplatform.com/embed.js"></script>
 * <div data-crm-widget="WIDGET_ID"></div>
 */

(function (window, document) {
  'use strict';

  const API_BASE = 'https://api.yourplatform.com/v1';
  const WIDGET_BASE = 'https://widgets.yourplatform.com';

  class CRMStore {
    constructor() {
      this.widgets = new Map();
      this.carts = new Map();
      this.eventListeners = new Map();
      this.initialized = false;
    }

    /**
     * Initialize all widgets on page load
     */
    initAll() {
      if (this.initialized) return;
      this.initialized = true;

      // Find all widget placeholders
      const placeholders = document.querySelectorAll('[data-crm-widget]');
      
      placeholders.forEach((element) => {
        const widgetId = element.getAttribute('data-crm-widget');
        const config = this.extractConfigFromElement(element);
        
        this.init({
          widgetId,
          container: element,
          ...config
        });
      });
    }

    /**
     * Initialize a single widget
     */
    async init(options) {
      const {
        widgetId,
        container,
        containerId,
        type,
        config = {}
      } = options;

      // Get container element
      const containerElement = container || document.getElementById(containerId);
      
      if (!containerElement) {
        console.error(`CRMStore: Container not found for widget ${widgetId}`);
        return null;
      }

      try {
        // Fetch widget configuration from API
        const widgetConfig = await this.fetchWidgetConfig(widgetId);
        
        // Create widget instance
        const widget = {
          id: widgetId,
          container: containerElement,
          config: { ...widgetConfig, ...config },
          type: type || widgetConfig.type,
          iframe: null
        };

        // Store widget
        this.widgets.set(widgetId, widget);

        // Initialize cart for this widget
        await this.initCart(widgetId);

        // Render widget
        await this.renderWidget(widget);

        // Set up message listener for iframe communication
        this.setupMessageListener(widgetId);

        // Emit initialized event
        this.emit('widget:initialized', { widgetId, widget });

        return widget;
      } catch (error) {
        console.error(`CRMStore: Failed to initialize widget ${widgetId}`, error);
        return null;
      }
    }

    /**
     * Extract configuration from DOM element
     */
    extractConfigFromElement(element) {
      const config = {};
      
      // Extract all data attributes
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          const key = attr.name
            .replace('data-', '')
            .replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          
          // Parse value (handle booleans and numbers)
          let value = attr.value;
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = Number(value);
          
          config[key] = value;
        }
      }
      
      return config;
    }

    /**
     * Fetch widget configuration from API
     */
    async fetchWidgetConfig(widgetId) {
      const response = await fetch(`${API_BASE}/widgets/${widgetId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch widget config: ${response.statusText}`);
      }
      
      return response.json();
    }

    /**
     * Initialize or restore cart
     */
    async initCart(widgetId) {
      const sessionId = this.getOrCreateSessionId(widgetId);
      
      try {
        // Try to restore cart from server
        const response = await fetch(`${API_BASE}/widgets/${widgetId}/cart/${sessionId}`);
        
        if (response.ok) {
          const cart = await response.json();
          this.carts.set(widgetId, cart);
        } else {
          // Create new cart
          this.carts.set(widgetId, {
            id: sessionId,
            items: [],
            subtotal: 0,
            total: 0
          });
        }
      } catch (error) {
        console.error('Failed to initialize cart:', error);
        this.carts.set(widgetId, {
          id: sessionId,
          items: [],
          subtotal: 0,
          total: 0
        });
      }
    }

    /**
     * Get or create session ID
     */
    getOrCreateSessionId(widgetId) {
      const storageKey = `crm_store_session_${widgetId}`;
      let sessionId = localStorage.getItem(storageKey);
      
      if (!sessionId) {
        sessionId = this.generateSessionId();
        localStorage.setItem(storageKey, sessionId);
      }
      
      return sessionId;
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Render widget
     */
    async renderWidget(widget) {
      const { id, container, config, type } = widget;
      
      // Build iframe URL
      const iframeUrl = this.buildIframeUrl(id, type, config);
      
      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.width = config.width || '100%';
      iframe.style.height = config.height || '600px';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.setAttribute('data-crm-widget-iframe', id);
      
      // Optional: Set max width
      if (config.maxWidth) {
        iframe.style.maxWidth = config.maxWidth;
      }
      
      // Clear container and append iframe
      container.innerHTML = '';
      container.appendChild(iframe);
      
      widget.iframe = iframe;
    }

    /**
     * Build iframe URL with configuration
     */
    buildIframeUrl(widgetId, type, config) {
      const url = new URL(`${WIDGET_BASE}/${widgetId}`);
      
      // Add config as query params
      url.searchParams.set('type', type);
      url.searchParams.set('session', this.getOrCreateSessionId(widgetId));
      
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      }
      
      return url.toString();
    }

    /**
     * Set up message listener for iframe communication
     */
    setupMessageListener(widgetId) {
      window.addEventListener('message', (event) => {
        // Verify origin
        if (!event.origin.startsWith(WIDGET_BASE)) {
          return;
        }
        
        const { type, payload } = event.data;
        
        // Handle different message types
        switch (type) {
          case 'cart:updated':
            this.handleCartUpdated(widgetId, payload);
            break;
          case 'cart:add':
            this.handleAddToCart(widgetId, payload);
            break;
          case 'checkout:initiated':
            this.emit('checkout', payload);
            break;
          case 'purchase:completed':
            this.handlePurchaseCompleted(widgetId, payload);
            break;
          case 'widget:resized':
            this.handleWidgetResized(widgetId, payload);
            break;
        }
      });
    }

    /**
     * Handle cart updated
     */
    handleCartUpdated(widgetId, cart) {
      this.carts.set(widgetId, cart);
      this.emit('cart:updated', { widgetId, cart });
    }

    /**
     * Handle add to cart
     */
    async handleAddToCart(widgetId, payload) {
      try {
        const sessionId = this.getOrCreateSessionId(widgetId);
        
        const response = await fetch(`${API_BASE}/widgets/${widgetId}/cart/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            ...payload
          })
        });
        
        if (response.ok) {
          const cart = await response.json();
          this.handleCartUpdated(widgetId, cart);
          this.emit('cart:add', { widgetId, product: payload });
        }
      } catch (error) {
        console.error('Failed to add to cart:', error);
        this.emit('error', { type: 'cart:add', error });
      }
    }

    /**
     * Handle purchase completed
     */
    handlePurchaseCompleted(widgetId, order) {
      // Clear cart
      this.carts.set(widgetId, {
        id: this.getOrCreateSessionId(widgetId),
        items: [],
        subtotal: 0,
        total: 0
      });
      
      this.emit('purchase', { widgetId, order });
      
      // Track in analytics if available
      if (window.gtag) {
        gtag('event', 'purchase', {
          transaction_id: order.id,
          value: order.total,
          currency: order.currency,
          items: order.items.map(item => ({
            item_id: item.productId,
            item_name: item.productName,
            quantity: item.quantity,
            price: item.price
          }))
        });
      }
    }

    /**
     * Handle widget resized
     */
    handleWidgetResized(widgetId, { height }) {
      const widget = this.widgets.get(widgetId);
      if (widget && widget.iframe) {
        widget.iframe.style.height = height + 'px';
      }
    }

    /**
     * Get cart for widget
     */
    getCart(widgetId) {
      return this.carts.get(widgetId) || null;
    }

    /**
     * Add product to cart
     */
    async addToCart(widgetId, product) {
      return this.handleAddToCart(widgetId, product);
    }

    /**
     * Remove product from cart
     */
    async removeFromCart(widgetId, itemId) {
      try {
        const sessionId = this.getOrCreateSessionId(widgetId);
        
        const response = await fetch(`${API_BASE}/widgets/${widgetId}/cart/remove`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            itemId
          })
        });
        
        if (response.ok) {
          const cart = await response.json();
          this.handleCartUpdated(widgetId, cart);
        }
      } catch (error) {
        console.error('Failed to remove from cart:', error);
      }
    }

    /**
     * Open checkout
     */
    openCheckout(widgetId) {
      const widget = this.widgets.get(widgetId);
      
      if (widget && widget.iframe) {
        // Send message to iframe to open checkout
        widget.iframe.contentWindow.postMessage({
          type: 'checkout:open'
        }, WIDGET_BASE);
      }
    }

    /**
     * Event system
     */
    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
      if (this.eventListeners.has(event)) {
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }

    emit(event, data) {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error);
          }
        });
      }
    }

    /**
     * Destroy widget
     */
    destroy(widgetId) {
      const widget = this.widgets.get(widgetId);
      
      if (widget) {
        if (widget.iframe && widget.iframe.parentNode) {
          widget.iframe.parentNode.removeChild(widget.iframe);
        }
        
        this.widgets.delete(widgetId);
        this.carts.delete(widgetId);
        
        this.emit('widget:destroyed', { widgetId });
      }
    }
  }

  // Create global instance
  const crmStore = new CRMStore();

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => crmStore.initAll());
  } else {
    crmStore.initAll();
  }

  // Expose to window
  window.CRMStore = crmStore;

})(window, document);

