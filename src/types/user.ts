import type { Timestamp } from 'firebase/firestore';

/**
 * User Profile
 * Core user information (stored separately from org membership)
 */
export interface User {
  id: string; // Firebase Auth UID
  email: string;
  
  // Profile
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string; // Cloud Storage URL
    phoneNumber?: string;
    timezone: string;
  };
  
  // Preferences
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      slack: boolean;
    };
  };
  
  // Current context (for multi-tenancy)
  currentContext?: {
    organizationId: string;
    workspaceId: string;
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp;
  
  // Status
  status: 'active' | 'suspended';
  emailVerified: boolean;
}

/**
 * User Session
 * Track active sessions for security
 */
export interface UserSession {
  id: string;
  userId: string;
  
  // Session details
  token: string;
  refreshToken?: string;
  expiresAt: Timestamp;
  
  // Device info
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
    ipAddress: string;
  };
  
  // Context
  organizationId?: string;
  workspaceId?: string;
  
  // Metadata
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  
  // Status
  status: 'active' | 'expired' | 'revoked';
}

/**
 * Invitation
 * Invite users to organizations/workspaces
 */
export interface Invitation {
  id: string;
  organizationId: string;
  workspaceId?: string;
  
  // Invitee
  email: string;
  role: string;
  permissions?: string[];
  
  // Inviter
  invitedBy: string;
  invitedByEmail: string;
  
  // Message
  message?: string;
  
  // Metadata
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  
  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
}


