/**
 * E2E Test: Email Sequences
 * REAL end-to-end testing with actual Firebase and test data
 * NO MOCKS - tests the actual system
 * 
 * Prerequisites:
 * 1. Firebase emulators running (npm run firebase:emulators)
 * 2. Test data seeded (node scripts/seed-e2e-test-data.js)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { handleEmailOpen, handleEmailClick, handleEmailBounce } from '@/lib/outbound/sequence-scheduler';

// Initialize Firebase for tests
if (getApps().length === 0) {
  initializeApp({
    projectId: 'demo-ai-sales-platform',
  });
}

const db = getFirestore();

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

describe('Email Sequences E2E', () => {
  let orgId: string;
  let prospectId: string;
  let sequenceId: string;

  beforeAll(async () => {
    // Find the E2E test organization
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'E2E Automated Testing Org')
      .limit(1)
      .get();

    if (orgsSnapshot.empty) {
      throw new Error('E2E test organization not found. Run: node scripts/seed-e2e-test-data.js');
    }

    orgId = orgsSnapshot.docs[0].id;
    prospectId = 'e2e-prospect-001';
    sequenceId = 'e2e-test-sequence-001';

    console.log(`✅ Using test org: ${orgId}`);
  }, 30000);

  describe('Prospect Enrollment - REAL Firebase', () => {
    it('should enroll a prospect in a sequence', async () => {
      console.log(`\n📝 Enrolling prospect ${prospectId} in sequence ${sequenceId}...`);
      
      const enrollment = await SequenceEngine.enrollProspect(
        prospectId,
        sequenceId,
        orgId
      );

      expect(enrollment).toBeDefined();
      expect(enrollment.prospectId).toBe(prospectId);
      expect(enrollment.sequenceId).toBe(sequenceId);
      expect(enrollment.status).toBe('active');
      expect(enrollment.currentStep).toBe(0);

      // Verify it was ACTUALLY saved to Firestore (not mocked!)
      const saved = await db.collection('organizations')
        .doc(orgId)
        .collection('enrollments')
        .doc(enrollment.id)
        .get();

      expect(saved.exists).toBe(true);
      const savedData = saved.data();
      expect(savedData?.prospectId).toBe(prospectId);
      expect(savedData?.status).toBe('active');
      
      console.log(`✅ Enrollment created in real Firestore: ${enrollment.id}`);
    }, 15000);

    it('should prevent duplicate enrollments', async () => {
      // Try to enroll the same prospect again - should fail
      await expect(
        SequenceEngine.enrollProspect(prospectId, sequenceId, orgId)
      ).rejects.toThrow('already enrolled');
      
      console.log('✅ Duplicate enrollment prevention works');
    }, 10000);
  });

  describe('Email Tracking Webhooks - REAL Handlers', () => {
    let enrollmentId: string;

    beforeAll(async () => {
      // Get the real enrollment ID from Firestore
      const enrollments = await db.collection('organizations')
        .doc(orgId)
        .collection('enrollments')
        .where('prospectId', '==', prospectId)
        .where('sequenceId', '==', sequenceId)
        .limit(1)
        .get();

      if (!enrollments.empty) {
        enrollmentId = enrollments.docs[0].id;
        console.log(`\n✅ Found enrollment: ${enrollmentId}`);
      }
    });

    it('should handle email open webhook', async () => {
      expect(enrollmentId).toBeDefined();

      console.log('\n📧 Handling email open webhook...');
      await handleEmailOpen(enrollmentId, 'step-001', orgId);

      // Verify it was ACTUALLY updated in Firestore
      const enrollment = await db.collection('organizations')
        .doc(orgId)
        .collection('enrollments')
        .doc(enrollmentId)
        .get();

      const data = enrollment.data();
      const stepAction = data?.stepActions?.find((a: any) => a.stepId === 'step-001');

      expect(stepAction).toBeDefined();
      expect(stepAction?.openedAt).toBeDefined();
      console.log(`✅ Email open tracked in real Firestore`);
    }, 10000);

    it('should handle email click webhook', async () => {
      console.log('\n🖱️  Handling email click webhook...');
      await handleEmailClick(enrollmentId, 'step-001', orgId);

      // Verify in REAL Firestore
      const enrollment = await db.collection('organizations')
        .doc(orgId)
        .collection('enrollments')
        .doc(enrollmentId)
        .get();

      const data = enrollment.data();
      const stepAction = data?.stepActions?.find((a: any) => a.stepId === 'step-001');

      expect(stepAction?.clickedAt).toBeDefined();
      console.log(`✅ Email click tracked in real Firestore`);
    }, 10000);
  });

  describe('Sequence Analytics - REAL Calculations', () => {
    it('should update sequence analytics in real Firestore', async () => {
      console.log('\n📊 Checking real sequence analytics...');
      
      const sequenceDoc = await db.collection('organizations')
        .doc(orgId)
        .collection('sequences')
        .doc(sequenceId)
        .get();

      const analytics = sequenceDoc.data()?.analytics;

      expect(analytics).toBeDefined();
      expect(analytics.totalEnrolled).toBeGreaterThan(0);
      expect(analytics.activeProspects).toBeGreaterThan(0);
      
      console.log(`✅ Analytics verified in real Firestore:`);
      console.log(`   Total Enrolled: ${analytics.totalEnrolled}`);
      console.log(`   Active: ${analytics.activeProspects}`);
    }, 10000);
  });
});

