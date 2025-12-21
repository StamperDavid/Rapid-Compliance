/**
 * Error Toast Notification Component
 * Shows user-friendly error messages
 */

'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export interface APIErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  timestamp?: string;
}

/**
 * Show error toast with user-friendly message
 */
export function showErrorToast(error: unknown, fallbackMessage = 'An error occurred') {
  let message = fallbackMessage;
  let details: any = null;

  // Handle API error responses
  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = error as APIErrorResponse;
    message = apiError.error.message || fallbackMessage;
    details = apiError.error.details;
    
    // Add helpful context for common errors
    if (apiError.error.code === 'MISSING_API_KEY') {
      message = `⚠️ ${message}\n\nGo to Settings → API Keys to configure.`;
    }
  } 
  // Handle Error objects
  else if (error instanceof Error) {
    message = error.message;
  }
  // Handle string errors
  else if (typeof error === 'string') {
    message = error;
  }

  toast.error(message, {
    duration: 5000,
    position: 'top-right',
    style: {
      background: '#7f1d1d',
      color: '#fff',
      border: '1px solid #991b1b',
      borderRadius: '0.5rem',
      padding: '1rem',
      maxWidth: '500px',
    },
  });

  // Log details for debugging
  if (details) {
    console.error('[Error Details]', details);
  }
}

/**
 * Show success toast
 */
export function showSuccessToast(message: string) {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#065f46',
      color: '#fff',
      border: '1px solid #047857',
      borderRadius: '0.5rem',
      padding: '1rem',
    },
  });
}

/**
 * Show loading toast (returns ID for dismissal)
 */
export function showLoadingToast(message: string) {
  return toast.loading(message, {
    position: 'top-right',
    style: {
      background: '#1e3a8a',
      color: '#fff',
      border: '1px solid #1e40af',
      borderRadius: '0.5rem',
      padding: '1rem',
    },
  });
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string) {
  toast.dismiss(toastId);
}

/**
 * Handle fetch response with error toasts
 */
export async function fetchWithToast<T = any>(
  url: string,
  options?: RequestInit,
  successMessage?: string
): Promise<{ success: boolean; data?: T; error?: any }> {
  const loadingToast = showLoadingToast('Processing...');

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    dismissToast(loadingToast);

    if (!response.ok || !data.success) {
      showErrorToast(data);
      return { success: false, error: data };
    }

    if (successMessage) {
      showSuccessToast(successMessage);
    }

    return { success: true, data };
  } catch (error) {
    dismissToast(loadingToast);
    showErrorToast(error);
    return { success: false, error };
  }
}














