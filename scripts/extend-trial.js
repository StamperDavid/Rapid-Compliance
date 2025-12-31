/**
 * Extend Trial Period Script
 * 
 * Usage: node scripts/extend-trial.js <orgId> <additionalDays>
 * Example: node scripts/extend-trial.js org_123456 7
 * 
 * This script extends an organization's trial period by a specified number of days.
 * It updates both Firestore and Stripe (if subscription exists).
 * 
 * Manual Reference: Document 3 - Manual Intervention Guide, Section 1.3
 */

const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

/**
 * Extend trial period for an organization
 * @param {string} orgId - Organization ID
 * @param {number} additionalDays - Number of days to extend
 */
async function extendTrial(orgId, additionalDays) {
  try {
    console.log(`\n🔍 Looking up organization: ${orgId}`);
    
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
    
    // Verify organization is on trial
    if (data.status !== 'trialing') {
      console.error(`❌ Error: Organization is not on trial (status: ${data.status})`);
      console.log('This script can only extend trial periods for organizations in "trialing" status');
      process.exit(1);
    }
    
    // Calculate new trial end date
    const currentTrialEnd = new Date(data.trialEndDate);
    const newTrialEnd = new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    
    console.log(`\n📅 Current trial end: ${currentTrialEnd.toISOString()}`);
    console.log(`📅 New trial end: ${newTrialEnd.toISOString()}`);
    console.log(`⏱️  Extension: ${additionalDays} days`);
    
    // Update Firestore
    console.log('\n📝 Updating Firestore...');
    await subscriptionRef.update({
      trialEndDate: newTrialEnd.toISOString(),
      trialExtended: true,
      trialExtensionDays: (data.trialExtensionDays || 0) + additionalDays,
      extendedAt: admin.firestore.FieldValue.serverTimestamp(),
      extendedBy: 'support-team',
      extendedReason: `Extended by ${additionalDays} days via extend-trial.js script`
    });
    
    console.log('✅ Firestore updated successfully');
    
    // Update Stripe if subscription exists
    if (data.stripeSubscriptionId) {
      console.log('\n💳 Updating Stripe subscription...');
      try {
        await stripe.subscriptions.update(data.stripeSubscriptionId, {
          trial_end: Math.floor(newTrialEnd.getTime() / 1000), // Unix timestamp
          proration_behavior: 'none'
        });
        console.log('✅ Stripe subscription updated successfully');
      } catch (stripeError) {
        console.error('⚠️  Warning: Failed to update Stripe subscription');
        console.error(stripeError.message);
        console.log('Firestore has been updated, but Stripe sync failed. You may need to manually update Stripe.');
      }
    } else {
      console.log('ℹ️  No Stripe subscription found (org may not have set up billing yet)');
    }
    
    // Create audit log
    console.log('\n📋 Creating audit log...');
    try {
      await db.collection('admin').doc('auditLogs').collection('entries').add({
        action: 'extend_trial',
        performedBy: 'support-team',
        organizationId: orgId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          additionalDays,
          previousTrialEnd: currentTrialEnd.toISOString(),
          newTrialEnd: newTrialEnd.toISOString()
        }
      });
      console.log('✅ Audit log created');
    } catch (auditError) {
      console.error('⚠️  Warning: Failed to create audit log');
      console.error(auditError.message);
    }
    
    console.log('\n✅ SUCCESS: Trial extended successfully');
    console.log(`   Organization: ${orgId}`);
    console.log(`   Extension: ${additionalDays} days`);
    console.log(`   New trial end: ${newTrialEnd.toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ Error extending trial:', error);
    process.exit(1);
  }
}

// Main execution
const orgId = process.argv[2];
const days = parseInt(process.argv[3]);

if (!orgId || !days || isNaN(days)) {
  console.error('❌ Error: Invalid arguments');
  console.log('\nUsage: node scripts/extend-trial.js <orgId> <additionalDays>');
  console.log('Example: node scripts/extend-trial.js org_1704067200000_abc123xyz 7');
  console.log('\nArguments:');
  console.log('  orgId           Organization ID (format: org_TIMESTAMP_RANDOM)');
  console.log('  additionalDays  Number of days to extend (integer)');
  process.exit(1);
}

if (days < 1 || days > 90) {
  console.error('❌ Error: Additional days must be between 1 and 90');
  process.exit(1);
}

// Confirm action
console.log('⚠️  TRIAL EXTENSION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Organization: ${orgId}`);
console.log(`Extension: ${days} days`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nThis will modify subscription data in Firestore and Stripe.');
console.log('Proceeding in 3 seconds... (Press Ctrl+C to cancel)');

setTimeout(() => {
  extendTrial(orgId, days)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}, 3000);
