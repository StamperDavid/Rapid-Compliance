/**
 * PWA Install Prompt
 * Handles "Add to Home Screen" functionality
 */

import { logger } from '@/lib/logger/logger';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Listen for beforeinstallprompt event
 */
export function setupInstallPrompt() {
  if (typeof window === 'undefined') {return;}

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    
    // Dispatch custom event to notify UI
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
}

/**
 * Show install prompt
 */
export async function showInstallPrompt(): Promise<boolean> {
  // Capture local reference to avoid race condition
  const promptEvent = deferredPrompt;

  if (!promptEvent) {
    return false;
  }

  // Clear the deferred prompt before awaiting to avoid race condition
  deferredPrompt = null;

  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    if (outcome === 'accepted') {
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error showing install prompt:', error instanceof Error ? error : new Error(String(error)), { file: 'install-prompt.ts' });
    return false;
  }
}

/**
 * Extended Navigator interface for iOS standalone detection
 */
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

/**
 * Check if app is installed
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') {return false;}

  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check if running in iOS standalone mode
  if ((window.navigator as NavigatorStandalone).standalone === true) {
    return true;
  }

  return false;
}

/**
 * Check if install prompt is available
 */
export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}






















