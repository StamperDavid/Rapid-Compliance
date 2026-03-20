/* eslint-env jest */
// Load environment variables FIRST (before any other imports)
import { config } from 'dotenv'
config({ path: '.env.local' })

// Set NODE_ENV to test
process.env.NODE_ENV = 'test'

// 🛡️ PROTECTION: Block tests from running against PRODUCTION
// DEV database (rapid-compliance-65f87) is correct for tests
// PROD databases must NEVER have tests run against them
const PRODUCTION_PROJECT_IDS = ['ai-sales-platform-4f5e4'];
const DEV_PROJECT_IDS = ['rapid-compliance-65f87', 'ai-sales-platform-dev', 'demo-ai-sales-platform'];

const currentProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Block if hitting PRODUCTION
if (currentProjectId && PRODUCTION_PROJECT_IDS.some(id => currentProjectId.includes(id))) {
  console.error('\n❌ ========================================');
  console.error('❌ TESTS BLOCKED - PRODUCTION DATABASE');
  console.error('❌ ========================================\n');
  console.error(`Current: ${currentProjectId}`);
  console.error('\nTests must use DEV database, not PROD!');
  console.error('❌ ========================================\n');
  process.exit(1);
}

// Verify we're using DEV
if (!currentProjectId || !DEV_PROJECT_IDS.some(id => currentProjectId.includes(id))) {
  console.warn('\n⚠️  WARNING: Tests may not be using DEV database');
  console.warn(`   Current Project: ${currentProjectId || 'NOT SET'}`);
  console.warn(`   Expected one of: ${DEV_PROJECT_IDS.join(', ')}\n`);
}

console.log('✅ Test environment: DEV database');
console.log(`   Project ID: ${currentProjectId}\n`);

// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

// Node test environment polyfills
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder
}
if (!global.TextDecoder) {
  // @ts-expect-error - Node polyfill type compatibility
  global.TextDecoder = TextDecoder
}
if (!global.ReadableStream) {
  // @ts-expect-error - Node polyfill type compatibility
  global.ReadableStream = ReadableStream
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock FirestoreService to use AdminFirestoreService (bypasses security rules for tests)
// This is CRITICAL - Admin SDK bypasses Firestore security rules, allowing tests to write to dev database
jest.mock('@/lib/db/firestore-service', () => {
  const { AdminFirestoreService } = jest.requireActual('@/lib/db/admin-firestore-service');
  const actualModule = jest.requireActual('@/lib/db/firestore-service');
  return {
    FirestoreService: AdminFirestoreService,
    COLLECTIONS: actualModule.COLLECTIONS,
    RecordService: actualModule.RecordService,
    WorkflowService: actualModule.WorkflowService,
    EmailCampaignService: actualModule.EmailCampaignService,
    LeadNurturingService: actualModule.LeadNurturingService,
  };
});

// Mock API Key Service
jest.mock('@/lib/api-keys/api-key-service', () => ({
  apiKeyService: {
    getKeys: jest.fn(),
    getServiceKey: jest.fn(),
    saveKeys: jest.fn(),
  },
}));

// Firebase will use real config from environment variables
// Tests connect to actual Firebase DEV database using Admin SDK (bypasses security rules)

// Log Firebase Admin config for debugging
console.log('[Jest Setup] Firebase Admin Config:', {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT SET',
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'NOT SET',
  privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.length : 0
})




















