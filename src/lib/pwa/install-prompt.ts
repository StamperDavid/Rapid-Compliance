/**
 * PWA Install Prompt
 * Handles "Add to Home Screen" functionality
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Listen for beforeinstallprompt event
 */
export function setupInstallPrompt() {
  if (typeof window === 'undefined') return;

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
  if (!deferredPrompt) {
    return false;
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      deferredPrompt = null;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error showing install prompt:', error);
    return false;
  }
}

/**
 * Check if app is installed
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check if running in iOS standalone mode
  if ((window.navigator as any).standalone === true) {
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





















