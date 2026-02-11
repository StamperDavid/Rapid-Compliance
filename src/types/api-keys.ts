/**
 * API Keys Configuration Types
 * Centralized API key management for white-label instances
 */

export interface APIKeysConfig {
  id: string;

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
  // NOTE: OpenRouter can be used for ALL AI models (GPT-4, Claude, Gemini, etc.)
  ai: {
    openrouterApiKey?: string;  // RECOMMENDED: One key for all AI models
    openaiApiKey?: string;      // Direct OpenAI access
    anthropicApiKey?: string;   // Direct Claude access
    geminiApiKey?: string;      // Direct Gemini access
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
  
  // SMS Services (also used for Voice/VoIP providers)
  sms: {
    twilio?: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
    telnyx?: {
      apiKey: string;
      apiSecret?: string;
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

  // Video Generation Services
  video?: {
    heygen?: {
      apiKey: string;
    };
    sora?: {
      apiKey: string;
    };
    runway?: {
      apiKey: string;
    };
  };
  
  // Voice Generation Services
  voice?: {
    elevenlabs?: {
      apiKey: string;
    };
    unrealSpeech?: {
      apiKey: string;
    };
  };

  // Prospect Research & Enrichment
  enrichment?: {
    /** @deprecated Use native discovery-engine.ts instead. Will be removed in future release. */
    clearbitApiKey?: string;
    crunchbaseApiKey?: string;
    builtWithApiKey?: string;
    newsApiKey?: string;
    rapidApiKey?: string; // For LinkedIn and other APIs
    serperApiKey?: string; // Serper.dev Google Search API
  };
  
  // Social Media Integrations
  social?: {
    twitter?: {
      clientId: string;
      clientSecret: string;
      bearerToken?: string;
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
    };
    linkedin?: {
      clientId?: string;
      clientSecret?: string;
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
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
    twitter?: {
      clientId: string;
      clientSecret: string;
      bearerToken?: string;
      accessToken?: string;
      refreshToken?: string;
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
  details?: unknown;
}

export type APIServiceName =
  | 'firebase'
  | 'googleCloud'
  | 'openrouter'    // Universal AI provider (RECOMMENDED - one key for all AI)
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'stripe'
  | 'square'
  | 'paypal'
  | 'authorizenet'
  | '2checkout'
  | 'mollie'
  | 'sendgrid'
  | 'resend'
  | 'integrations'
  | 'smtp'
  | 'twilio'
  | 'telnyx'
  | 'bandwidth'
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
  | 'hubspot'
  | 'google-calendar'
  | 'gmail'
  | 'clearbit'
  | 'crunchbase'
  | 'builtwith'
  | 'newsapi'
  | 'rapidapi'
  | 'twitter'      // Twitter/X API v2
  | 'linkedin'     // LinkedIn API
  | 'heygen'       // HeyGen AI Avatar Video
  | 'sora'         // OpenAI Sora Text-to-Video
  | 'runway'       // Runway Gen-3 Video Generation
  | 'elevenlabs'   // ElevenLabs Voice AI
  | 'unrealSpeech' // Unreal Speech TTS
  | 'serper';      // Serper.dev Google Search API


