/**
 * Seed Test Data for Website Builder
 * Creates 2 test organizations with pages for multi-tenant testing
 * 
 * ⚠️ PROTECTED: This script will NOT run against production
 */

const admin = require('firebase-admin');
const { requireProductionProtection } = require('./PRODUCTION_PROTECTION');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✓ Firebase Admin initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function seedWebsiteTestData() {
  // PRODUCTION PROTECTION - Will exit if running against production
  await requireProductionProtection(admin.app().options.projectId, 'seed-website-test-data.js');
  
  console.log('\n🌱 Seeding Website Builder Test Data...\n');

  try {
    // ========================================
    // ORGANIZATION A
    // ========================================
    
    const orgAId = 'org_test_a';
    const subdomainA = 'testa';

    console.log(`Creating Organization A (${orgAId})...`);

    // Create subdomain registry entry
    await db.collection('subdomains').doc(subdomainA).set({
      subdomain: subdomainA,
      organizationId: orgAId,
      createdAt: admin.firestore.Timestamp.now(),
    });
    console.log(`  ✓ Subdomain registered: ${subdomainA}.yourplatform.com → ${orgAId}`);

    // Create website settings
    await db
      .collection('organizations').doc(orgAId)
      .collection('website').doc('settings')
      .set({
        organizationId: orgAId,
        subdomain: subdomainA,
        customDomain: null,
        customDomainVerified: false,
        sslEnabled: true,
        status: 'published',
        seo: {
          title: 'Organization A - Test Site',
          description: 'This is Organization A\'s test website',
          keywords: ['test', 'org-a'],
          robotsIndex: true,
          robotsFollow: true,
        },
        analytics: {
          googleAnalyticsId: 'G-TESTAAAA',
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    console.log('  ✓ Website settings created');

    // Create homepage
    const homePageAId = `page_${Date.now()}_a_home`;
    await db
      .collection('organizations').doc(orgAId)
      .collection('website').doc('pages')
      .collection('items').doc(homePageAId)
      .set({
        id: homePageAId,
        organizationId: orgAId,
        slug: 'home',
        title: 'Welcome to Organization A',
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
                    id: 'widget_1',
                    type: 'heading',
                    data: {
                      text: 'Welcome to Organization A',
                      level: 1,
                    },
                  },
                  {
                    id: 'widget_2',
                    type: 'text',
                    data: {
                      text: 'This is Organization A\'s homepage. This content should ONLY be visible on testa.yourplatform.com',
                    },
                  },
                ],
              },
            ],
          },
        ],
        seo: {
          metaTitle: 'Home - Organization A',
          metaDescription: 'Organization A homepage',
        },
        status: 'published',
        version: 1,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'seed-script',
        lastEditedBy: 'seed-script',
      });
    console.log(`  ✓ Homepage created: ${homePageAId}`);

    // Create about page
    const aboutPageAId = `page_${Date.now()}_a_about`;
    await db
      .collection('organizations').doc(orgAId)
      .collection('website').doc('pages')
      .collection('items').doc(aboutPageAId)
      .set({
        id: aboutPageAId,
        organizationId: orgAId,
        slug: 'about',
        title: 'About Organization A',
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
                    id: 'widget_1',
                    type: 'heading',
                    data: {
                      text: 'About Us',
                      level: 1,
                    },
                  },
                  {
                    id: 'widget_2',
                    type: 'text',
                    data: {
                      text: 'Organization A is a test organization. This page is org-scoped.',
                    },
                  },
                ],
              },
            ],
          },
        ],
        seo: {
          metaTitle: 'About - Organization A',
        },
        status: 'published',
        version: 1,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'seed-script',
        lastEditedBy: 'seed-script',
      });
    console.log(`  ✓ About page created: ${aboutPageAId}`);

    // Create draft page (should not be publicly visible)
    const draftPageAId = `page_${Date.now()}_a_draft`;
    await db
      .collection('organizations').doc(orgAId)
      .collection('website').doc('pages')
      .collection('items').doc(draftPageAId)
      .set({
        id: draftPageAId,
        organizationId: orgAId,
        slug: 'draft-page',
        title: 'Draft Page (Org A)',
        content: [],
        seo: {},
        status: 'draft',
        version: 1,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'seed-script',
        lastEditedBy: 'seed-script',
      });
    console.log(`  ✓ Draft page created: ${draftPageAId}`);

    console.log('✅ Organization A complete\n');

    // ========================================
    // ORGANIZATION B
    // ========================================
    
    const orgBId = 'org_test_b';
    const subdomainB = 'testb';

    console.log(`Creating Organization B (${orgBId})...`);

    // Create subdomain registry entry
    await db.collection('subdomains').doc(subdomainB).set({
      subdomain: subdomainB,
      organizationId: orgBId,
      createdAt: admin.firestore.Timestamp.now(),
    });
    console.log(`  ✓ Subdomain registered: ${subdomainB}.yourplatform.com → ${orgBId}`);

    // Create website settings
    await db
      .collection('organizations').doc(orgBId)
      .collection('website').doc('settings')
      .set({
        organizationId: orgBId,
        subdomain: subdomainB,
        customDomain: null,
        customDomainVerified: false,
        sslEnabled: true,
        status: 'published',
        seo: {
          title: 'Organization B - Test Site',
          description: 'This is Organization B\'s test website',
          keywords: ['test', 'org-b'],
          robotsIndex: true,
          robotsFollow: true,
        },
        analytics: {
          googleAnalyticsId: 'G-TESTBBBB',
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    console.log('  ✓ Website settings created');

    // Create homepage
    const homePageBId = `page_${Date.now()}_b_home`;
    await db
      .collection('organizations').doc(orgBId)
      .collection('website').doc('pages')
      .collection('items').doc(homePageBId)
      .set({
        id: homePageBId,
        organizationId: orgBId,
        slug: 'home',
        title: 'Welcome to Organization B',
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
                    id: 'widget_1',
                    type: 'heading',
                    data: {
                      text: 'Welcome to Organization B',
                      level: 1,
                    },
                  },
                  {
                    id: 'widget_2',
                    type: 'text',
                    data: {
                      text: 'This is Organization B\'s homepage. This content should ONLY be visible on testb.yourplatform.com',
                    },
                  },
                ],
              },
            ],
          },
        ],
        seo: {
          metaTitle: 'Home - Organization B',
          metaDescription: 'Organization B homepage',
        },
        status: 'published',
        version: 1,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'seed-script',
        lastEditedBy: 'seed-script',
      });
    console.log(`  ✓ Homepage created: ${homePageBId}`);

    // Create contact page
    const contactPageBId = `page_${Date.now()}_b_contact`;
    await db
      .collection('organizations').doc(orgBId)
      .collection('website').doc('pages')
      .collection('items').doc(contactPageBId)
      .set({
        id: contactPageBId,
        organizationId: orgBId,
        slug: 'contact',
        title: 'Contact Organization B',
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
                    id: 'widget_1',
                    type: 'heading',
                    data: {
                      text: 'Contact Us',
                      level: 1,
                    },
                  },
                  {
                    id: 'widget_2',
                    type: 'text',
                    data: {
                      text: 'Get in touch with Organization B. This page is org-scoped.',
                    },
                  },
                ],
              },
            ],
          },
        ],
        seo: {
          metaTitle: 'Contact - Organization B',
        },
        status: 'published',
        version: 1,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: 'seed-script',
        lastEditedBy: 'seed-script',
      });
    console.log(`  ✓ Contact page created: ${contactPageBId}`);

    console.log('✅ Organization B complete\n');

    // ========================================
    // SUMMARY
    // ========================================

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Website Builder Test Data Seeded!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Created:');
    console.log('  • 2 Organizations (org_test_a, org_test_b)');
    console.log('  • 2 Subdomains (testa, testb)');
    console.log('  • 5 Pages (3 for Org A, 2 for Org B)');
    console.log('  • 2 Settings configs');
    console.log('');

    console.log('🧪 Test URLs:');
    console.log('  Organization A:');
    console.log('    http://testa.localhost:3000              (homepage)');
    console.log('    http://testa.localhost:3000/about        (about page)');
    console.log('    http://testa.localhost:3000/draft-page   (should 404 - draft)');
    console.log('');
    console.log('  Organization B:');
    console.log('    http://testb.localhost:3000              (homepage)');
    console.log('    http://testb.localhost:3000/contact      (contact page)');
    console.log('');

    console.log('🔧 Settings Pages:');
    console.log('  http://localhost:3000/workspace/org_test_a/website/settings');
    console.log('  http://localhost:3000/workspace/org_test_b/website/settings');
    console.log('');

    console.log('📡 API Endpoints:');
    console.log('  GET /api/website/pages?organizationId=org_test_a');
    console.log('  GET /api/website/pages?organizationId=org_test_b');
    console.log('  GET /api/website/settings?organizationId=org_test_a');
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('  1. Start dev server: npm run dev');
    console.log('  2. Follow testing guide: WEBSITE_BUILDER_TESTING_GUIDE.md');
    console.log('  3. Verify multi-tenant isolation');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seed script
seedWebsiteTestData()
  .then(() => {
    console.log('✅ Seeding complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });


