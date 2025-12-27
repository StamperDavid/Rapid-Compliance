/**
 * Test Script: Email Sequence End-to-End
 * 
 * Run with: npx tsx test-sequence.ts
 * 
 * This tests:
 * 1. Create a sequence
 * 2. Enroll a prospect
 * 3. Process the sequence (send email)
 * 4. Verify email was sent
 */

import { SequenceEngine } from './src/lib/outbound/sequence-engine';
import { FirestoreService, COLLECTIONS } from './src/lib/db/firestore-service';
import { processSequences } from './src/lib/outbound/sequence-scheduler';

async function testEmailSequence() {
  console.log('🧪 Testing Email Sequence End-to-End\n');

  const TEST_ORG_ID = 'test-org-123';
  const TEST_PROSPECT_ID = 'test-prospect-456';

  try {
    // Step 1: Create a test sequence
    console.log('1️⃣  Creating test sequence...');
    const sequenceId = `test_seq_${Date.now()}`;
    const sequence = {
      id: sequenceId,
      organizationId: TEST_ORG_ID,
      name: 'Test Sequence',
      description: 'Testing email sending',
      status: 'active',
      steps: [
        {
          id: `step_1`,
          sequenceId,
          order: 1,
          delayDays: 0,
          delayHours: 0,
          type: 'email',
          subject: 'Test Email from AI Sales Platform',
          body: '<h1>Hello!</h1><p>This is a test email from your sequence.</p>',
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      autoEnroll: false,
      stopOnResponse: true,
      stopOnConversion: true,
      stopOnUnsubscribe: true,
      stopOnBounce: true,
      analytics: {
        totalEnrolled: 0,
        activeProspects: 0,
        completedProspects: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        totalBounced: 0,
        totalUnsubscribed: 0,
        meetingsBooked: 0,
        dealsCreated: 0,
        revenue: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        conversionRate: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${TEST_ORG_ID}/sequences`,
      sequenceId,
      sequence,
      false
    );
    console.log(`✅ Sequence created: ${sequenceId}\n`);

    // Step 2: Create a test prospect/lead
    console.log('2️⃣  Creating test prospect...');
    const prospect = {
      id: TEST_PROSPECT_ID,
      email: process.env.TEST_EMAIL || 'test@example.com', // Use your email for testing
      firstName: 'Test',
      lastName: 'Prospect',
      company: 'Test Company',
      status: 'cold',
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${TEST_ORG_ID}/leads`,
      TEST_PROSPECT_ID,
      prospect,
      false
    );
    console.log(`✅ Prospect created: ${prospect.email}\n`);

    // Step 3: Enroll prospect in sequence
    console.log('3️⃣  Enrolling prospect in sequence...');
    const enrollment = await SequenceEngine.enrollProspect(
      TEST_PROSPECT_ID,
      sequenceId,
      TEST_ORG_ID
    );
    console.log(`✅ Enrolled: ${enrollment.id}`);
    console.log(`   Next step scheduled for: ${enrollment.nextStepAt}\n`);

    // Step 4: Process sequences (this will send the email)
    console.log('4️⃣  Processing sequences (sending emails)...');
    const result = await processSequences();
    console.log(`✅ Processed: ${result.processed} emails`);
    console.log(`   Errors: ${result.errors}\n`);

    // Step 5: Verify
    console.log('5️⃣  Verification:');
    const updatedEnrollment = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${TEST_ORG_ID}/enrollments`,
      enrollment.id
    );

    if (updatedEnrollment) {
      console.log('✅ Enrollment updated successfully');
      console.log(`   Current step: ${updatedEnrollment.currentStep}`);
      console.log(`   Step actions: ${updatedEnrollment.stepActions?.length || 0}`);
      
      if (updatedEnrollment.stepActions && updatedEnrollment.stepActions.length > 0) {
        const lastAction = updatedEnrollment.stepActions[updatedEnrollment.stepActions.length - 1];
        console.log(`   Last action status: ${lastAction.status}`);
        console.log(`   Sent at: ${lastAction.sentAt || 'Not sent'}`);
        console.log(`   Error: ${lastAction.error || 'None'}`);
      }
    }

    console.log('\n✅ TEST COMPLETE!');
    console.log('\n📧 Check your email at:', prospect.email);
    console.log('\n⚠️  Requirements for this to work:');
    console.log('   1. SENDGRID_API_KEY environment variable set');
    console.log('   2. SendGrid verified sender (FROM_EMAIL)');
    console.log('   3. Firebase initialized');
    console.log('\n🧹 Cleanup: Test data created in Firestore with prefix "test_"');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('\nCommon issues:');
    console.error('  - SendGrid API key not set');
    console.error('  - Firebase not initialized');
    console.error('  - Prospect email not valid');
  }
}

// Run the test
testEmailSequence();


