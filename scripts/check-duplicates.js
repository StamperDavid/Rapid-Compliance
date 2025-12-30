/**
 * Check if organizations are duplicates or real data
 */

const admin = require('firebase-admin');
const path = require('path');

async function checkDuplicates() {
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  const adminDb = admin.firestore();
  
  console.log('\n📊 DUPLICATE CHECK\n');
  
  const orgsSnapshot = await adminDb.collection('organizations').get();
  console.log(`Total documents: ${orgsSnapshot.size}\n`);
  
  // Group by name to find duplicates
  const byName = {};
  const byPattern = {
    'org_XXXXX (timestamp)': [],
    'test-org-XXXXX': [],
    'unconfigured-XXXXX': [],
    'platform/admin': [],
    'named accounts': []
  };
  
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name || 'UNNAMED';
    const id = doc.id;
    
    // Count by name
    byName[name] = (byName[name] || 0) + 1;
    
    // Categorize by ID pattern
    if (id.startsWith('org_') && id.includes('_')) {
      byPattern['org_XXXXX (timestamp)'].push({
        id,
        name,
        plan: data.plan,
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || 'none',
        billingEmail: data.billingEmail
      });
    } else if (id.startsWith('test-org-')) {
      byPattern['test-org-XXXXX'].push({ id, name, plan: data.plan });
    } else if (id.startsWith('unconfigured-')) {
      byPattern['unconfigured-XXXXX'].push({ id, name, plan: data.plan });
    } else if (id === 'platform' || id === 'platform-admin') {
      byPattern['platform/admin'].push({ id, name, plan: data.plan });
    } else {
      byPattern['named accounts'].push({ id, name, plan: data.plan });
    }
  });
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('ORGANIZATIONS BY NAME (showing duplicates)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      if (count > 1) {
        console.log(`❌ ${count}x duplicates: "${name}"`);
      }
    });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ORGANIZATIONS BY ID PATTERN');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  Object.entries(byPattern).forEach(([pattern, orgs]) => {
    console.log(`\n${pattern}: ${orgs.length} organizations`);
    if (orgs.length > 0) {
      console.log('Sample (first 3):');
      orgs.slice(0, 3).forEach(org => {
        console.log(`  - ${org.id}`);
        console.log(`    Name: ${org.name}`);
        console.log(`    Plan: ${org.plan || 'none'}`);
        if (org.createdAt) console.log(`    Created: ${org.createdAt}`);
        console.log('');
      });
      
      // Check if they're all the same
      if (orgs.length > 1) {
        const first = orgs[0];
        const allSameName = orgs.every(o => o.name === first.name);
        const allSamePlan = orgs.every(o => o.plan === first.plan);
        console.log(`  Are they identical? Name: ${allSameName}, Plan: ${allSamePlan}`);
      }
    }
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Total: ${orgsSnapshot.size} organizations`);
  console.log(`  - org_XXXXX format: ${byPattern['org_XXXXX (timestamp)'].length}`);
  console.log(`  - test-org-XXXXX: ${byPattern['test-org-XXXXX'].length}`);
  console.log(`  - unconfigured-XXXXX: ${byPattern['unconfigured-XXXXX'].length}`);
  console.log(`  - platform/admin: ${byPattern['platform/admin'].length}`);
  console.log(`  - Named accounts: ${byPattern['named accounts'].length}\n`);
  
  process.exit(0);
}

checkDuplicates().catch(console.error);
