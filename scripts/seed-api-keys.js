/**
 * Seed Platform API Keys to Firestore Emulator
 * Run this after starting emulators to add your API keys
 * Uses Admin SDK to bypass security rules
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (for emulator - bypasses security rules)
admin.initializeApp({
  projectId: 'demo-ai-sales-platform',
});

const db = admin.firestore();

// Connect to emulator
db.settings({
  host: 'localhost:8080',
  ssl: false,
});

async function seedApiKeys() {
  console.log('🔑 Seeding Platform API Keys...\n');

  // REPLACE THESE WITH YOUR ACTUAL API KEYS
  const apiKeys = {
    ai: {
      openrouterApiKey: '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',
      geminiApiKey: '',  // Or add Gemini key here
      openaiApiKey: '',
      anthropicApiKey: '',
    },
    integrations: {
      sendgridApiKey: '',
      stripeSecretKey: '',
      stripePublishableKey: '',
    },
    enrichment: {
      clearbitApiKey: '',
      builtwithApiKey: '',
      newsApiKey: '',
    },
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = db.collection('admin').doc('platform-api-keys');
    await docRef.set(apiKeys);
    
    console.log('✅ API Keys saved successfully!\n');
    console.log('Saved keys:');
    console.log('  - OpenRouter:', apiKeys.ai.openrouterApiKey ? '✓ Set' : '✗ Not set');
    console.log('  - Gemini:', apiKeys.ai.geminiApiKey ? '✓ Set' : '✗ Not set');
    console.log('  - OpenAI:', apiKeys.ai.openaiApiKey ? '✓ Set' : '✗ Not set');
    console.log('  - Anthropic:', apiKeys.ai.anthropicApiKey ? '✓ Set' : '✗ Not set');
    console.log('\n💡 Edit scripts/seed-api-keys.js to update your API keys');
    console.log('📍 Or visit: http://localhost:3000/admin/system/api-keys\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding API keys:', error);
    process.exit(1);
  }
}

seedApiKeys();

