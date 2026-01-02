/**
 * Setup Platform Configuration
 * 
 * Creates the platformConfig/website document in Firestore
 * to eliminate useWebsiteTheme errors
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-prod-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function setupPlatformConfig() {
  try {
    console.log('Setting up platform configuration...');

    const defaultConfig = {
      branding: {
        logoUrl: '/logo.png',
        logoHeight: 48,
        companyName: 'SalesVelocity.ai',
        tagline: 'Accelerate Your Growth',
        colors: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#10b981',
          background: '#000000',
          text: '#ffffff',
          navBackground: 'rgba(15, 23, 42, 0.8)',
          footerBackground: '#0a0a0a',
        },
        fonts: {
          body: 'Inter',
          heading: 'Inter',
        },
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Check if document exists
    const docRef = db.collection('platformConfig').doc('website');
    const doc = await docRef.get();

    if (doc.exists) {
      console.log('✅ platformConfig/website already exists');
      console.log('Current config:', doc.data());
    } else {
      // Create the document
      await docRef.set(defaultConfig);
      console.log('✅ Created platformConfig/website with default branding');
    }

    console.log('\n✅ Platform configuration setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up platform config:', error);
    process.exit(1);
  }
}

setupPlatformConfig();
