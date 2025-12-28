/**
 * Fix salesvelocity.ai domain in production
 * Adds www.salesvelocity.ai to custom-domains collection
 */

const admin = require('firebase-admin');

// Use PRODUCTION credentials
const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function fixDomain() {
  try {
    console.log('🔍 Checking for platform organization...\n');
    
    // Use the 'platform' org that exists in production
    const orgId = 'platform';
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      console.log('❌ Platform organization not found in production');
      process.exit(1);
    }
    
    const orgData = orgDoc.data();
    console.log(`✅ Found organization: ${orgData.name} (${orgId})\n`);
    
    // Add domain to custom-domains collection
    console.log('📝 Adding www.salesvelocity.ai to custom-domains collection...');
    
    await db.collection('custom-domains').doc('www.salesvelocity.ai').set({
      organizationId: orgId,
      domain: 'www.salesvelocity.ai',
      verified: true,
      sslEnabled: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    
    console.log('✅ Added www.salesvelocity.ai to custom-domains\n');
    
    // Add domain to organization's custom-domains subcollection
    console.log('📝 Adding domain to organization subcollection...');
    
    await db.collection('organizations')
      .doc(orgId)
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .doc('www.salesvelocity.ai')
      .set({
        domain: 'www.salesvelocity.ai',
        verified: true,
        sslEnabled: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    
    console.log('✅ Added domain to organization\n');
    
    console.log('✨ Domain configuration complete!');
    console.log('🌐 www.salesvelocity.ai should now work in production\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDomain();

