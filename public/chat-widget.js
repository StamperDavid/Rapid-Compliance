/**
 * AI Sales Agent Chat Widget
 * Embeddable JavaScript SDK for customer-facing AI chat
 * 
 * Usage:
 * <script src="https://salesvelocity.ai/chat-widget.js"></script>
 *
 * Or with configuration:
 * <script src="https://salesvelocity.ai/chat-widget.js"></script>
 * <script>
 *   AIChatWidget.init({
 *     primaryColor: '#6366f1',
 *     title: 'Chat with us',
 *     position: 'bottom-right'
 *   });
 * </script>
 */

(function (window, document) {
  'use strict';

  // Configuration
  const DEFAULT_API_BASE = window.location.origin || 'https://yourplatform.com';
  const DEFAULT_API_ENDPOINT = '/api/chat/public';
  
  class AIChatWidget {
    constructor() {
      this.config = null;
      this.customerId = null;
      this.messages = [];
      this.isOpen = false;
      this.isTyping = false;
      this.container = null;
      this.initialized = false;
    }

    /**
     * Initialize the chat widget
     */
    init(options = {}) {
      if (this.initialized) {
        console.warn('AIChatWidget already initialized');
        return;
      }

      // Merge options with defaults
      this.config = {
        apiEndpoint: options.apiEndpoint || `${DEFAULT_API_BASE}${DEFAULT_API_ENDPOINT}`,
        position: options.position || 'bottom-right',
        primaryColor: options.primaryColor || '#6366f1',
        title: options.title || 'Chat with us',
        subtitle: options.subtitle || 'We typically reply in a few seconds',
        placeholder: options.placeholder || 'Type your message...',
        welcomeMessage: options.welcomeMessage || "Hi there! 👋 How can I help you today?",
        agentName: options.agentName || 'Sales Agent',
        agentAvatar: options.agentAvatar || null,
        autoOpen: options.autoOpen || false,
        showTimestamps: options.showTimestamps || false,
        onMessage: options.onMessage || null,
        onOpen: options.onOpen || null,
        onClose: options.onClose || null,
      };

      // Generate or restore customer ID
      this.initCustomerId();

      // Create widget container
      this.createWidget();

      // Add welcome message
      if (this.config.welcomeMessage) {
        this.addMessage('assistant', this.config.welcomeMessage);
      }

      this.initialized = true;

      // Auto open if configured
      if (this.config.autoOpen) {
        this.open();
      }
    }

    /**
     * Initialize or restore customer ID
     */
    initCustomerId() {
      const storageKey = 'ai_chat_customer';
      this.customerId = localStorage.getItem(storageKey);
      
      if (!this.customerId) {
        this.customerId = 'cust_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem(storageKey, this.customerId);
      }
    }

    /**
     * Create the widget DOM elements
     */
    createWidget() {
      // Create container
      this.container = document.createElement('div');
      this.container.id = 'ai-chat-widget-container';
      this.container.innerHTML = this.getWidgetHTML();
      document.body.appendChild(this.container);

      // Add styles
      this.addStyles();

      // Bind events
      this.bindEvents();
    }

    /**
     * Get widget HTML
     */
    getWidgetHTML() {
      const { position, primaryColor, title, subtitle, placeholder, agentName, agentAvatar } = this.config;
      const positionClass = position === 'bottom-left' ? 'acw-left' : 'acw-right';

      return `
        <!-- Chat Button -->
        <button id="acw-toggle-btn" class="acw-toggle-btn ${positionClass}" style="background-color: ${primaryColor}">
          <svg class="acw-icon-chat" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <svg class="acw-icon-close" width="20" height="20" viewBox="0 0 24 24" fill="white" style="display: none;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </button>

        <!-- Chat Window -->
        <div id="acw-window" class="acw-window ${positionClass}" style="display: none;">
          <!-- Header -->
          <div class="acw-header" style="background-color: ${primaryColor}">
            <div class="acw-header-content">
              <div class="acw-avatar">
                ${agentAvatar 
                  ? `<img src="${agentAvatar}" alt="${agentName}" />`
                  : `<svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>`
                }
              </div>
              <div class="acw-header-text">
                <div class="acw-title">${title}</div>
                <div class="acw-subtitle">${subtitle}</div>
              </div>
            </div>
            <button id="acw-close-btn" class="acw-close-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
              </svg>
            </button>
          </div>

          <!-- Messages -->
          <div id="acw-messages" class="acw-messages"></div>

          <!-- Input -->
          <div class="acw-input-container">
            <input 
              type="text" 
              id="acw-input" 
              class="acw-input" 
              placeholder="${placeholder}"
            />
            <button id="acw-send-btn" class="acw-send-btn" style="background-color: ${primaryColor}" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    /**
     * Add widget styles
     */
    addStyles() {
      const style = document.createElement('style');
      style.textContent = `
        #ai-chat-widget-container * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .acw-toggle-btn {
          position: fixed;
          bottom: 20px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 99999;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .acw-toggle-btn.acw-right { right: 20px; }
        .acw-toggle-btn.acw-left { left: 20px; }

        .acw-toggle-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
        }

        .acw-window {
          position: fixed;
          bottom: 100px;
          width: 380px;
          height: 520px;
          background-color: #fff;
          border-radius: 16px;
          box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: acw-slide-up 0.3s ease-out;
        }

        .acw-window.acw-right { right: 20px; }
        .acw-window.acw-left { left: 20px; }

        @keyframes acw-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .acw-header {
          padding: 20px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .acw-header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .acw-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .acw-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .acw-title {
          font-weight: 600;
          font-size: 16px;
        }

        .acw-subtitle {
          font-size: 12px;
          opacity: 0.9;
        }

        .acw-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: white;
          padding: 8px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .acw-close-btn:hover {
          opacity: 1;
        }

        .acw-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: #f9fafb;
        }

        .acw-message {
          display: flex;
          flex-direction: column;
        }

        .acw-message.acw-user {
          align-items: flex-end;
        }

        .acw-message.acw-assistant {
          align-items: flex-start;
        }

        .acw-message-bubble {
          max-width: 80%;
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.5;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .acw-user .acw-message-bubble {
          border-radius: 18px 18px 4px 18px;
          background-color: ${this.config.primaryColor};
          color: white;
        }

        .acw-assistant .acw-message-bubble {
          border-radius: 18px 18px 18px 4px;
          background-color: white;
          color: #1f2937;
        }

        .acw-message-time {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .acw-typing {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background-color: white;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .acw-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #9ca3af;
          animation: acw-typing 1.4s infinite ease-in-out;
        }

        .acw-typing-dot:nth-child(1) { animation-delay: 0s; }
        .acw-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .acw-typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes acw-typing {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }

        .acw-input-container {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background-color: white;
          display: flex;
          gap: 8px;
        }

        .acw-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .acw-input:focus {
          border-color: ${this.config.primaryColor};
        }

        .acw-send-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }

        .acw-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background-color: #e5e7eb !important;
        }

        @media (max-width: 480px) {
          .acw-window {
            width: calc(100% - 20px);
            height: calc(100% - 120px);
            bottom: 90px;
            right: 10px !important;
            left: 10px !important;
            border-radius: 12px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
      const toggleBtn = document.getElementById('acw-toggle-btn');
      const closeBtn = document.getElementById('acw-close-btn');
      const input = document.getElementById('acw-input');
      const sendBtn = document.getElementById('acw-send-btn');

      toggleBtn.addEventListener('click', () => this.toggle());
      closeBtn.addEventListener('click', () => this.close());
      
      input.addEventListener('input', (e) => {
        sendBtn.disabled = !e.target.value.trim() || this.isTyping;
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    /**
     * Toggle chat window
     */
    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    /**
     * Open chat window
     */
    open() {
      const window = document.getElementById('acw-window');
      const chatIcon = document.querySelector('.acw-icon-chat');
      const closeIcon = document.querySelector('.acw-icon-close');
      
      window.style.display = 'flex';
      chatIcon.style.display = 'none';
      closeIcon.style.display = 'block';
      this.isOpen = true;

      // Focus input
      setTimeout(() => {
        document.getElementById('acw-input')?.focus();
      }, 100);

      // Callback
      if (this.config.onOpen) this.config.onOpen();
    }

    /**
     * Close chat window
     */
    close() {
      const window = document.getElementById('acw-window');
      const chatIcon = document.querySelector('.acw-icon-chat');
      const closeIcon = document.querySelector('.acw-icon-close');
      
      window.style.display = 'none';
      chatIcon.style.display = 'block';
      closeIcon.style.display = 'none';
      this.isOpen = false;

      // Callback
      if (this.config.onClose) this.config.onClose();
    }

    /**
     * Send message
     */
    async sendMessage() {
      const input = document.getElementById('acw-input');
      const message = input.value.trim();
      
      if (!message || this.isTyping) return;

      // Add user message
      this.addMessage('user', message);
      input.value = '';
      document.getElementById('acw-send-btn').disabled = true;

      // Show typing indicator
      this.showTyping();

      try {
        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: this.customerId,
            message: message,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        
        // Hide typing and add response
        this.hideTyping();
        this.addMessage('assistant', data.response || 'Sorry, I could not process your request.');

      } catch (error) {
        console.error('Chat error:', error);
        this.hideTyping();
        this.addMessage('assistant', "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.");
      }
    }

    /**
     * Add message to chat
     */
    addMessage(role, content) {
      const message = {
        id: 'msg_' + Date.now(),
        role,
        content,
        timestamp: new Date(),
      };
      
      this.messages.push(message);
      this.renderMessage(message);

      // Callback
      if (this.config.onMessage) {
        this.config.onMessage(message);
      }
    }

    /**
     * Render message to DOM
     */
    renderMessage(message) {
      const container = document.getElementById('acw-messages');
      const div = document.createElement('div');
      div.className = `acw-message acw-${message.role}`;
      
      let html = `<div class="acw-message-bubble">${this.escapeHtml(message.content)}</div>`;
      
      if (this.config.showTimestamps) {
        html += `<span class="acw-message-time">${this.formatTime(message.timestamp)}</span>`;
      }
      
      div.innerHTML = html;
      container.appendChild(div);
      
      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    }

    /**
     * Show typing indicator
     */
    showTyping() {
      this.isTyping = true;
      const container = document.getElementById('acw-messages');
      const div = document.createElement('div');
      div.id = 'acw-typing-indicator';
      div.className = 'acw-message acw-assistant';
      div.innerHTML = `
        <div class="acw-typing">
          <div class="acw-typing-dot"></div>
          <div class="acw-typing-dot"></div>
          <div class="acw-typing-dot"></div>
        </div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    /**
     * Hide typing indicator
     */
    hideTyping() {
      this.isTyping = false;
      const indicator = document.getElementById('acw-typing-indicator');
      if (indicator) indicator.remove();
    }

    /**
     * Format timestamp
     */
    formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Destroy widget
     */
    destroy() {
      if (this.container) {
        this.container.remove();
      }
      this.initialized = false;
    }
  }

  // Create global instance
  const widget = new AIChatWidget();

  // Expose to window
  window.AIChatWidget = widget;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      widget.init();
    });
  } else {
    widget.init();
  }

})(window, document);

