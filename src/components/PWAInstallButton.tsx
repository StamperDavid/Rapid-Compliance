'use client';

import React, { useState, useEffect } from 'react';
import { setupInstallPrompt, showInstallPrompt, isAppInstalled, isInstallPromptAvailable } from '@/lib/pwa/install-prompt';

export default function PWAInstallButton() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setupInstallPrompt();
    
    // Check if already installed
    setIsInstalled(isAppInstalled());

    // Listen for installable event
    const handleInstallable = () => {
      setIsInstallable(true);
    };

    window.addEventListener('pwa-installable', handleInstallable);

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstall = async () => {
    const installed = await showInstallPrompt();
    if (installed) {
      setIsInstalled(true);
      setIsInstallable(false);
    }
  };

  if (isInstalled || !isInstallable) {
    return null;
  }

  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';

  return (
    <button
      onClick={handleInstall}
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: primaryColor,
        color: '#fff',
        border: 'none',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}
    >
      <span>📱</span>
      <span>Install App</span>
    </button>
  );
}




