/**
 * Database Initialization Script for Website Builder
 * Creates initial collections and indexes for Sprints 5-8 features
 * 
 * Run with: node scripts/init-website-builder-db.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initializeWebsiteBuilder() {
  console.log('🚀 Initializing Website Builder Database...\n');

  try {
    // Get list of organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (orgsSnapshot.empty) {
      console.log('⚠️  No organizations found. Please create organizations first.\n');
      return;
    }

    console.log(`Found ${orgsSnapshot.size} organization(s)\n`);

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      
      console.log(`\n📦 Setting up ${orgData.name || orgId}...`);

      // Create website config structure
      await createWebsiteConfig(orgId);
      
      // Create sample page (if none exists)
      await createSamplePage(orgId);
      
      // Create audit log structure
      await createAuditLogStructure(orgId);
      
      console.log(`✅ ${orgData.name || orgId} setup complete`);
    }

    // Create global custom domains collection (if needed)
    await createGlobalCollections();

    console.log('\n✨ Website Builder database initialization complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

async function createWebsiteConfig(orgId) {
  const configRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('website')
    .doc('config');

  const configDoc = await configRef.get();
  
  if (!configDoc.exists) {
    await configRef.set({
      siteName: 'My Website',
      subdomain: `org-${orgId.substring(0, 8)}`,
      status: 'draft',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log('  ✓ Created website config');
  } else {
    console.log('  - Website config already exists');
  }
}

async function createSamplePage(orgId) {
  const pagesRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('website')
    .doc('pages')
    .collection('items');

  const pagesSnapshot = await pagesRef.limit(1).get();
  
  if (pagesSnapshot.empty) {
    const samplePageId = `page_${Date.now()}`;
    await pagesRef.doc(samplePageId).set({
      id: samplePageId,
      organizationId: orgId,
      title: 'Welcome',
      slug: 'home',
      content: [
        {
          id: 'section_1',
          type: 'section',
          columns: [
            {
              id: 'col_1',
              width: 100,
              widgets: [
                {
                  id: 'hero_1',
                  type: 'hero',
                  data: {
                    heading: 'Welcome to Your Website',
                    subheading: 'Start building your dream website today',
                    buttonText: 'Get Started',
                    buttonUrl: '#',
                  },
                  style: {
                    textAlign: 'center',
                    padding: { top: '80px', bottom: '80px' },
                  },
                },
              ],
            },
          ],
        },
      ],
      seo: {
        metaTitle: 'Welcome',
        metaDescription: 'Welcome to our website',
      },
      status: 'draft',
      version: 1,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      lastEditedBy: 'system',
    });
    console.log('  ✓ Created sample homepage');
  } else {
    console.log('  - Pages already exist');
  }
}

async function createAuditLogStructure(orgId) {
  // Just create the parent document
  const auditRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('website')
    .doc('audit-log');

  const auditDoc = await auditRef.get();
  
  if (!auditDoc.exists) {
    await auditRef.set({
      created: admin.firestore.Timestamp.now(),
    });
    console.log('  ✓ Created audit log structure');
  } else {
    console.log('  - Audit log structure exists');
  }
}

async function createGlobalCollections() {
  console.log('\n📦 Setting up global collections...');
  
  // Custom domains collection (just create a placeholder)
  const domainsRef = db.collection('custom-domains');
  const domainsSnapshot = await domainsRef.limit(1).get();
  
  if (domainsSnapshot.empty) {
    // Create a placeholder doc to initialize the collection
    await domainsRef.doc('_placeholder').set({
      placeholder: true,
      created: admin.firestore.Timestamp.now(),
    });
    console.log('  ✓ Initialized custom-domains collection');
  }

  // Subdomains collection
  const subdomainsRef = db.collection('subdomains');
  const subdomainsSnapshot = await subdomainsRef.limit(1).get();
  
  if (subdomainsSnapshot.empty) {
    await subdomainsRef.doc('_placeholder').set({
      placeholder: true,
      created: admin.firestore.Timestamp.now(),
    });
    console.log('  ✓ Initialized subdomains collection');
  }
}

// Run initialization
initializeWebsiteBuilder();

