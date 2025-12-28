/**
 * Remove www.salesvelocity.ai from custom-domains
 * It's the main platform domain, not a customer website domain
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function removeDomain() {
  try {
    console.log('🗑️  Removing www.salesvelocity.ai from custom-domains...\n');
    
    // Remove from global custom-domains collection
    await db.collection('custom-domains').doc('www.salesvelocity.ai').delete();
    console.log('✅ Removed from custom-domains collection');
    
    // Remove from platform org subcollection
    await db.collection('organizations')
      .doc('platform')
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .doc('www.salesvelocity.ai')
      .delete();
    console.log('✅ Removed from platform org\n');
    
    console.log('✨ Domain removed successfully!');
    console.log('ℹ️  www.salesvelocity.ai will now show the landing page\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeDomain();


