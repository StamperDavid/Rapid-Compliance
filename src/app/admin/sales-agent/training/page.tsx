'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin Platform Sales Agent Training
 * Redirects to the client training environment but for the platform sales agent
 * This is dogfooding - using the same training system we sell to clients
 */
export default function AdminSalesAgentTrainingPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual client training environment
    // Using a special 'platform-admin' org that contains the platform sales agent
    router.push('/workspace/platform-admin/settings/ai-agents/training');
  }, [router]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
        <p>Loading platform sales agent training...</p>
      </div>
    </div>
  );
}










