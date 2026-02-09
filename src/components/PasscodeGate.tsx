'use client';

import { useState } from 'react';

const CORRECT_PASSCODE = '5150';

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passcode === CORRECT_PASSCODE) {
      setIsVerified(true);
      setError(false);
    } else {
      setError(true);
      setPasscode('');
      // Shake animation
      setTimeout(() => setError(false), 500);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPasscode(value);
  };

  // If verified, show the actual content
  if (isVerified) {
    return <>{children}</>;
  }

  // Show passcode gate
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--color-bg-main)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxWidth: '400px',
        width: '90%',
        animation: error ? 'shake 0.5s' : 'none',
      }}>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
        `}</style>
        
        <h2 style={{
          color: 'var(--color-text-primary)',
          fontSize: '1.5rem',
          fontWeight: '600',
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}>
          Enter Passcode
        </h2>
        
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          This site is currently in development
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={passcode}
            onChange={handleInputChange}
            placeholder="4-digit code"
            autoFocus
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.5rem',
              textAlign: 'center',
              letterSpacing: '0.5rem',
              backgroundColor: 'var(--color-bg-elevated)',
              border: error ? '2px solid var(--color-error)' : '2px solid var(--color-border-strong)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              outline: 'none',
              transition: 'border-color 0.2s',
              marginBottom: '1rem',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-info)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-border-strong)';
            }}
          />

          {error && (
            <p style={{
              color: 'var(--color-error)',
              fontSize: '0.875rem',
              textAlign: 'center',
              marginBottom: '1rem',
            }}>
              Incorrect passcode
            </p>
          )}

          <button
            type="submit"
            disabled={passcode.length !== 4}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: passcode.length === 4 ? 'var(--color-info)' : 'var(--color-border-strong)',
              color: passcode.length === 4 ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
              border: 'none',
              borderRadius: '8px',
              cursor: passcode.length === 4 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (passcode.length === 4) {
                e.currentTarget.style.backgroundColor = 'var(--color-info)';
              }
            }}
            onMouseLeave={(e) => {
              if (passcode.length === 4) {
                e.currentTarget.style.backgroundColor = 'var(--color-info)';
              }
            }}
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

