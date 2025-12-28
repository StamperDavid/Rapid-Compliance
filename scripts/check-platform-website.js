/**
 * Check if platform org has a published website
 */

const admin = require('firebase-admin');

// Use PRODUCTION credentials
const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function checkWebsite() {
  try {
    const orgId = 'platform';
    
    console.log('🔍 Checking platform organization website...\n');
    
    // Check website config
    const configDoc = await db.collection('organizations')
      .doc(orgId)
      .collection('website')
      .doc('config')
      .get();
    
    console.log('Website Config:');
    if (configDoc.exists) {
      console.log(JSON.stringify(configDoc.data(), null, 2));
    } else {
      console.log('❌ No website config found');
    }
    
    console.log('\n---\n');
    
    // Check published pages
    const pagesSnapshot = await db.collection('organizations')
      .doc(orgId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .where('status', '==', 'published')
      .get();
    
    console.log(`Published Pages: ${pagesSnapshot.size}`);
    
    if (!pagesSnapshot.empty) {
      pagesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n- ${data.title || 'Untitled'} (${data.slug || 'no-slug'})`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Status: ${data.status}`);
      });
    } else {
      console.log('❌ No published pages found\n');
      
      // Check draft pages
      const draftSnapshot = await db.collection('organizations')
        .doc(orgId)
        .collection('website')
        .doc('pages')
        .collection('items')
        .get();
      
      console.log(`\nDraft/All Pages: ${draftSnapshot.size}`);
      draftSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n- ${data.title || 'Untitled'} (${data.slug || 'no-slug'})`);
        console.log(`  Status: ${data.status || 'unknown'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkWebsite();


