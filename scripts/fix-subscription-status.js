/**
 * Fix Subscription Status Script
 * 
 * Usage: node scripts/fix-subscription-status.js <orgId> <newStatus>
 * Example: node scripts/fix-subscription-status.js org_123456 active
 * 
 * This script overrides an organization's subscription status.
 * Use this when payment issues are resolved externally or for emergency fixes.
 * 
 * Valid statuses: active, trialing, past_due, canceled, unpaid
 * 
 * Manual Reference: Document 3 - Manual Intervention Guide, Section 1.1
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Check if service account key file exists
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Error: serviceAccountKey.json not found');
    console.error('Please ensure serviceAccountKey.json exists in the project root');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const VALID_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid'];

/**
 * Fix subscription status for an organization
 * @param {string} orgId - Organization ID
 * @param {string} newStatus - New subscription status
 */
async function fixSubscriptionStatus(orgId, newStatus) {
  try {
    console.log(`\n🔍 Looking up organization: ${orgId}`);
    
    // Validate status
    if (!VALID_STATUSES.includes(newStatus)) {
      console.error(`❌ Error: Invalid status "${newStatus}"`);
      console.log(`Valid statuses: ${VALID_STATUSES.join(', ')}`);
      process.exit(1);
    }
    
    // Get subscription reference
    const subscriptionRef = db.collection('organizations')
      .doc(orgId)
      .collection('subscriptions')
      .doc('current');
    
    const subscriptionDoc = await subscriptionRef.get();
    
    if (!subscriptionDoc.exists) {
      console.error(`❌ Error: No subscription found for organization ${orgId}`);
      process.exit(1);
    }
    
    const data = subscriptionDoc.data();
    const currentStatus = data.status;
    
    console.log(`\n📊 Current subscription status: ${currentStatus}`);
    console.log(`📊 New subscription status: ${newStatus}`);
    
    if (currentStatus === newStatus) {
      console.log('\n⚠️  Warning: New status is the same as current status');
      console.log('No changes needed. Exiting...');
      process.exit(0);
    }
    
    // Update Firestore
    console.log('\n📝 Updating subscription status...');
    await subscriptionRef.update({
      status: newStatus,
      lastPaymentFailed: false,
      lastPaymentFailedAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      manualOverride: true,
      overrideBy: 'support-team',
      overrideReason: 'Manual status fix via fix-subscription-status.js script',
      previousStatus: currentStatus
    });
    
    console.log('✅ Subscription status updated successfully');
    
    // Create audit log
    console.log('\n📋 Creating audit log...');
    try {
      await db.collection('admin').doc('auditLogs').collection('entries').add({
        action: 'fix_subscription_status',
        performedBy: 'support-team',
        organizationId: orgId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          previousStatus: currentStatus,
          newStatus: newStatus
        }
      });
      console.log('✅ Audit log created');
    } catch (auditError) {
      console.error('⚠️  Warning: Failed to create audit log');
      console.error(auditError.message);
    }
    
    console.log('\n✅ SUCCESS: Subscription status fixed');
    console.log(`   Organization: ${orgId}`);
    console.log(`   Previous Status: ${currentStatus}`);
    console.log(`   New Status: ${newStatus}`);
    
    console.log('\n⚠️  NEXT STEPS:');
    if (data.stripeSubscriptionId) {
      console.log(`   1. Verify Stripe subscription status matches: ${data.stripeSubscriptionId}`);
      console.log('   2. Check Stripe dashboard for any webhook failures');
    }
    console.log('   3. Notify customer of status change');
    console.log('   4. Document the reason for this manual override');
    
  } catch (error) {
    console.error('\n❌ Error fixing subscription status:', error);
    process.exit(1);
  }
}

// Main execution
const orgId = process.argv[2];
const newStatus = process.argv[3];

if (!orgId || !newStatus) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage: node scripts/fix-subscription-status.js <orgId> <newStatus>');
  console.log('Example: node scripts/fix-subscription-status.js org_1704067200000_abc123xyz active');
  console.log('\nValid statuses:');
  console.log('  active    - Subscription is active and paid');
  console.log('  trialing  - In trial period');
  console.log('  past_due  - Payment failed, grace period');
  console.log('  canceled  - Subscription canceled');
  console.log('  unpaid    - Payment failed, no access');
  console.log('\nUse Cases:');
  console.log('  - Customer paid via bank transfer, mark as active');
  console.log('  - Payment processor error, restore access');
  console.log('  - Emergency access grant during payment issues');
  process.exit(1);
}

// Confirm action
console.log('⚠️  SUBSCRIPTION STATUS OVERRIDE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Organization: ${orgId}`);
console.log(`New Status: ${newStatus}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n⚠️  WARNING: This will override the subscription status.');
console.log('Make sure you have verified payment status externally before proceeding.');
console.log('Proceeding in 3 seconds... (Press Ctrl+C to cancel)');

setTimeout(() => {
  fixSubscriptionStatus(orgId, newStatus)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}, 3000);
