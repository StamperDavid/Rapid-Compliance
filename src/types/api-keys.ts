/**
 * API Keys Configuration Types
 * Centralized API key management for white-label instances
 */

export interface APIKeysConfig {
  id: string;
  organizationId: string;
  
  // Firebase / Google Cloud
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  
  // Google Cloud Platform
  googleCloud: {
    projectId: string;
    serviceAccountKey?: string; // JSON key file content
    location: string; // e.g., 'us-central1'
  };
  
  // AI Services
  ai: {
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    vertexAIProjectId?: string;
    vertexAILocation?: string;
  };
  
  // Payment Processing
  payments: {
    stripe?: {
      publicKey: string;
      secretKey: string;
      webhookSecret: string;
    };
    square?: {
      applicationId: string;
      accessToken: string;
      locationId: string;
    };
    paypal?: {
      clientId: string;
      clientSecret: string;
      mode: 'sandbox' | 'live';
    };
  };
  
  // Email Services
  email: {
    sendgrid?: {
      apiKey: string;
      fromEmail: string;
      fromName: string;
    };
    resend?: {
      apiKey: string;
      fromEmail: string;
    };
    smtp?: {
      host: string;
      port: number;
      username: string;
      password: string;
      secure: boolean;
    };
  };
  
  // SMS Services
  sms: {
    twilio?: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
    vonage?: {
      apiKey: string;
      apiSecret: string;
      phoneNumber: string;
    };
  };
  
  // Storage Services
  storage: {
    cloudStorage?: {
      bucketName: string;
      serviceAccountKey?: string;
    };
    s3?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucket: string;
    };
  };
  
  // Analytics
  analytics: {
    googleAnalytics?: {
      measurementId: string;
      apiSecret?: string;
    };
    mixpanel?: {
      projectToken: string;
    };
  };
  
  // Other Integrations
  integrations: {
    slack?: {
      webhookUrl: string;
      botToken?: string;
      teamId?: string;
    };
    zapier?: {
      webhookUrl: string;
      apiKey?: string;
    };
    googleWorkspace?: {
      clientId: string;
      clientSecret: string;
      refreshToken?: string;
    };
    microsoft365?: {
      clientId: string;
      clientSecret: string;
      tenantId: string;
      refreshToken?: string;
    };
    mailchimp?: {
      apiKey: string;
      serverPrefix: string; // e.g., 'us1', 'us2'
      audienceId?: string;
    };
    hubspot?: {
      apiKey: string;
      portalId?: string;
    };
    custom?: Array<{
      name: string;
      apiKey: string;
      apiUrl?: string;
      description?: string;
    }>;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
  isEncrypted: boolean;
}

export interface APIKeyStatus {
  service: string;
  configured: boolean;
  valid: boolean;
  lastChecked?: Date;
  errorMessage?: string;
}

export interface APIKeyValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

export type APIServiceName = 
  | 'firebase'
  | 'googleCloud'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'stripe'
  | 'square'
  | 'paypal'
  | 'sendgrid'
  | 'resend'
  | 'smtp'
  | 'twilio'
  | 'vonage'
  | 'cloudStorage'
  | 's3'
  | 'googleAnalytics'
  | 'mixpanel'
  | 'slack'
  | 'zapier'
  | 'googleWorkspace'
  | 'microsoft365'
  | 'mailchimp'
  | 'hubspot';


