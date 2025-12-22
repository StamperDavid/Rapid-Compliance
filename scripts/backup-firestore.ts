/**
 * Firestore Backup Script
 * Automated database backups with point-in-time recovery
 * 
 * Run with: ts-node scripts/backup-firestore.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
const COLLECTIONS_TO_BACKUP = [
  'organizations',
  'workspaces',
  'customers',
  'products',
  'orders',
  'workflows',
  'agents',
  'integrations',
];

/**
 * Initialize Firebase Admin
 */
function initializeFirebase() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }
  
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  });
  
  return getFirestore();
}

/**
 * Create backup directory
 */
function ensureBackupDir(timestamp: string): string {
  const backupPath = path.join(BACKUP_DIR, timestamp);
  
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  
  return backupPath;
}

/**
 * Backup a single collection
 */
async function backupCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  backupPath: string
): Promise<number> {
  console.log(`[Backup] Starting backup of ${collectionName}...`);
  
  const collection = db.collection(collectionName);
  const snapshot = await collection.get();
  
  const documents: any[] = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      data: doc.data(),
    });
  });
  
  const filePath = path.join(backupPath, `${collectionName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
  
  console.log(`[Backup] ✓ Backed up ${documents.length} documents from ${collectionName}`);
  
  return documents.length;
}

/**
 * Backup all collections
 */
async function backupAllCollections(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = ensureBackupDir(timestamp);
  
  console.log(`[Backup] Starting full backup to ${backupPath}`);
  console.log(`[Backup] Timestamp: ${timestamp}`);
  
  const db = initializeFirebase();
  
  let totalDocuments = 0;
  
  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    try {
      const count = await backupCollection(db, collectionName, backupPath);
      totalDocuments += count;
    } catch (error) {
      console.error(`[Backup] Error backing up ${collectionName}:`, error);
    }
  }
  
  // Create metadata file
  const metadata = {
    timestamp,
    collections: COLLECTIONS_TO_BACKUP,
    totalDocuments,
    completed: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(backupPath, '_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`[Backup] ✓ Backup complete! Total documents: ${totalDocuments}`);
  console.log(`[Backup] Backup location: ${backupPath}`);
}

/**
 * Restore from backup
 */
async function restoreFromBackup(backupTimestamp: string): Promise<void> {
  const backupPath = path.join(BACKUP_DIR, backupTimestamp);
  
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }
  
  console.log(`[Restore] Starting restore from ${backupPath}`);
  
  const db = initializeFirebase();
  
  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    const filePath = path.join(backupPath, `${collectionName}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[Restore] Skipping ${collectionName} (file not found)`);
      continue;
    }
    
    console.log(`[Restore] Restoring ${collectionName}...`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const collection = db.collection(collectionName);
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of data) {
      batch.set(collection.doc(doc.id), doc.data);
      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount === 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`[Restore] ✓ Restored ${data.length} documents to ${collectionName}`);
  }
  
  console.log(`[Restore] ✓ Restore complete!`);
}

/**
 * Clean up old backups
 */
function cleanupOldBackups(): void {
  console.log(`[Cleanup] Removing backups older than ${BACKUP_RETENTION_DAYS} days...`);
  
  if (!fs.existsSync(BACKUP_DIR)) {
    return;
  }
  
  const now = Date.now();
  const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  
  const backups = fs.readdirSync(BACKUP_DIR);
  let removed = 0;
  
  for (const backup of backups) {
    const backupPath = path.join(BACKUP_DIR, backup);
    const stats = fs.statSync(backupPath);
    
    if (now - stats.mtimeMs > retentionMs) {
      fs.rmSync(backupPath, { recursive: true, force: true });
      console.log(`[Cleanup] Removed old backup: ${backup}`);
      removed++;
    }
  }
  
  console.log(`[Cleanup] ✓ Removed ${removed} old backups`);
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'backup':
        await backupAllCollections();
        cleanupOldBackups();
        break;
      
      case 'restore':
        const timestamp = process.argv[3];
        if (!timestamp) {
          console.error('Usage: ts-node backup-firestore.ts restore <timestamp>');
          process.exit(1);
        }
        await restoreFromBackup(timestamp);
        break;
      
      case 'list':
        if (fs.existsSync(BACKUP_DIR)) {
          const backups = fs.readdirSync(BACKUP_DIR);
          console.log('Available backups:');
          backups.forEach(backup => {
            const metadataPath = path.join(BACKUP_DIR, backup, '_metadata.json');
            if (fs.existsSync(metadataPath)) {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
              console.log(`  ${backup} - ${metadata.totalDocuments} documents`);
            }
          });
        } else {
          console.log('No backups found');
        }
        break;
      
      default:
        console.log('Usage:');
        console.log('  ts-node backup-firestore.ts backup          - Create new backup');
        console.log('  ts-node backup-firestore.ts restore <time>  - Restore from backup');
        console.log('  ts-node backup-firestore.ts list            - List available backups');
        process.exit(1);
    }
  } catch (error) {
    console.error('[Error]', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { backupAllCollections, restoreFromBackup, cleanupOldBackups };



















