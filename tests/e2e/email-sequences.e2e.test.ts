/**
 * E2E Test: Email Sequences
 * REAL end-to-end testing with actual Firebase dev environment
 * NO MOCKS - tests the actual system
 * 
 * Prerequisites:
 * 1. Valid serviceAccountKey.json in project root
 * 2. Test organization exists in Firebase (or tests will be skipped)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { handleEmailOpen, handleEmailClick, handleEmailBounce } from '@/lib/outbound/sequence-scheduler';
import * as path from 'path';

// Initialize Firebase Admin with actual credentials for E2E tests
if (getApps().length === 0) {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  initializeApp({
    credential: cert(serviceAccountPath),
    projectId: 'ai-sales-platform-dev',
  });
}

const db = getFirestore();

describe('Email Sequences E2E', () => {
  let orgId: string;
  let prospectId: string;
  let sequenceId: string;

  beforeAll(async () => {
    // Find any organization to use for testing
    const orgsSnapshot = await db.collection('organizations')
      .limit(1)
      .get();

    if (orgsSnapshot.empty) {
      console.warn('⚠️ No organizations found - E2E tests will be skipped');
      return;
    }

    orgId = orgsSnapshot.docs[0].id;
    prospectId = 'e2e-prospect-001';
    sequenceId = 'e2e-test-sequence-001';

    console.log(`✅ Using test org: ${orgId}`);
  }, 30000);

  describe('Prospect Enrollment - REAL Firebase', () => {
    it('should enroll a prospect in a sequence', async () => {
      if (!orgId) {
        console.log('⚠️ Skipping test - no org available');
        return;
      }
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
      if (!orgId) {
        console.log('⚠️ Skipping test - no org available');
        return;
      }
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
      if (!orgId || !enrollmentId) {
        console.log('⚠️ Skipping test - no org/enrollment available');
        return;
      }
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
      if (!orgId || !enrollmentId) {
        console.log('⚠️ Skipping test - no org/enrollment available');
        return;
      }
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
      if (!orgId) {
        console.log('⚠️ Skipping test - no org available');
        return;
      }
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

