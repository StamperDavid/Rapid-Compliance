/**
 * Create platform-admin organization
 * Quick script to create the org document that the landing page needs
 */

const admin = require('firebase-admin');

// Get Firebase config from environment
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ai-sales-platform-dev';

// Initialize Firebase Admin with project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId,
  });
}

const db = admin.firestore();

async function createPlatformAdminOrg() {
  console.log('\n🔧 Creating platform-admin organization...\n');
  
  try {
    const orgId = 'platform-admin';
    const now = new Date();

    // Create organization document
    await db.collection('organizations').doc(orgId).set({
      id: orgId,
      name: 'Platform Admin - Sales Agent',
      industry: 'AI Sales Automation',
      plan: 'enterprise',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      settings: {
        timezone: 'America/New_York',
        currency: 'USD'
      }
    }, { merge: true }); // merge: true won't overwrite if it exists
    
    console.log('✅ Organization created: organizations/platform-admin');

    // Enable chat widget
    await db.collection('organizations')
      .doc(orgId)
      .collection('settings')
      .doc('chatWidget')
      .set({
        enabled: true,
        welcomeMessage: "Hi! I'm Jasper. How can I help you today?",
        primaryColor: '#6366f1',
        position: 'bottom-right',
        updatedAt: now.toISOString()
      }, { merge: true });
    
    console.log('✅ Chat widget enabled');
    
    // Set default agent config
    await db.collection('organizations')
      .doc(orgId)
      .collection('agentConfig')
      .doc('default')
      .set({
        selectedModel: 'openrouter/anthropic/claude-3.5-sonnet',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 800,
          topP: 0.9
        },
        updatedAt: now.toISOString()
      }, { merge: true });
    
    console.log('✅ Agent config set');
    
    console.log('\n✅ Done! The landing page should now work.');
    console.log('   Make sure you have a golden master deployed from /admin/sales-agent/training\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

createPlatformAdminOrg()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });



