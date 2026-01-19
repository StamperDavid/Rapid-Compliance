/**
 * Local State Persistence
 * Client-side persistence for UI resilience during database downtime
 *
 * @module LocalPersistence
 * @status FUNCTIONAL
 */

// ============== Type Definitions ==============

export interface WriteOperation {
  id: string;
  collection: string;
  documentId: string;
  operation: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

export interface SyncResult {
  success: boolean;
  operationsSynced: number;
  operationsFailed: number;
  errors: string[];
}

export interface PersistenceConfig {
  dbName: string;
  version: number;
  maxQueueSize: number;
  syncIntervalMs: number;
  maxRetries: number;
}

interface StoredDocument {
  collection: string;
  documentId: string;
  data: Record<string, unknown>;
  cachedAt: string;
  expiresAt?: string;
}

// ============== Constants ==============

const DEFAULT_CONFIG: PersistenceConfig = {
  dbName: 'ai-sales-platform-cache',
  version: 1,
  maxQueueSize: 1000,
  syncIntervalMs: 5000,
  maxRetries: 3,
};

const STORES = {
  DOCUMENTS: 'documents',
  QUEUE: 'writeQueue',
  METADATA: 'metadata',
};

// ============== IndexedDB Helpers ==============

function openDatabase(config: PersistenceConfig): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(config.dbName, config.version);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Documents store
      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: ['collection', 'documentId'] });
        docStore.createIndex('collection', 'collection', { unique: false });
        docStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Write queue store
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Metadata store
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };
  });
}

function transaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB operation failed: ${request.error?.message}`));
  });
}

// ============== Local Persistence Class ==============

export class LocalPersistence {
  private config: PersistenceConfig;
  private db: IDBDatabase | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private onlineStatus: boolean = true;
  private connectionListeners: Set<(online: boolean) => void> = new Set();

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the database, throwing if not initialized
   */
  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('LocalPersistence not initialized');
    }
    return this.db;
  }

  /**
   * Initialize the persistence layer
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      // Server-side - skip initialization
      return;
    }

    this.db = await openDatabase(this.config);

    // Set up online/offline listeners
    this.setupConnectionListeners();

    // Start sync interval
    this.startSyncInterval();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.stopSyncInterval();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await Promise.resolve(); // Ensure async
  }

  /**
   * Save a document locally
   */
  async saveLocally<T extends Record<string, unknown>>(
    collection: string,
    docId: string,
    data: T,
    ttlMs?: number
  ): Promise<void> {
    await this.ensureInitialized();

    const document: StoredDocument = {
      collection,
      documentId: docId,
      data: data as Record<string, unknown>,
      cachedAt: new Date().toISOString(),
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : undefined,
    };

    await transaction(this.getDb(), STORES.DOCUMENTS, 'readwrite', (store) =>
      store.put(document)
    );
  }

  /**
   * Get a document from local storage
   */
  async getLocally<T extends Record<string, unknown>>(
    collection: string,
    docId: string
  ): Promise<T | null> {
    await this.ensureInitialized();

    const result = await transaction<StoredDocument | undefined>(
      this.getDb(),
      STORES.DOCUMENTS,
      'readonly',
      (store) => store.get([collection, docId]) as IDBRequest<StoredDocument | undefined>
    );

    if (!result) {
      return null;
    }

    // Check expiration
    if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
      // Delete expired document
      await this.deleteLocally(collection, docId);
      return null;
    }

    return result.data as T;
  }

  /**
   * Delete a document from local storage
   */
  async deleteLocally(collection: string, docId: string): Promise<void> {
    await this.ensureInitialized();

    await transaction(this.getDb(), STORES.DOCUMENTS, 'readwrite', (store) =>
      store.delete([collection, docId])
    );
  }

  /**
   * Get all documents in a collection from local storage
   */
  async getCollectionLocally<T extends Record<string, unknown>>(
    collection: string
  ): Promise<T[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORES.DOCUMENTS, 'readonly');
      const store = tx.objectStore(STORES.DOCUMENTS);
      const index = store.index('collection');
      const request = index.getAll(collection);

      request.onsuccess = () => {
        const now = new Date();
        const documents = (request.result as StoredDocument[])
          .filter((doc) => !doc.expiresAt || new Date(doc.expiresAt) > now)
          .map((doc) => doc.data as T);
        resolve(documents);
      };

      request.onerror = () => reject(new Error(`Failed to get collection: ${request.error?.message}`));
    });
  }

  /**
   * Queue a write operation for later sync
   */
  async queueWrite(operation: Omit<WriteOperation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<void> {
    await this.ensureInitialized();

    // Check queue size
    const queueSize = await this.getQueueSize();
    if (queueSize >= this.config.maxQueueSize) {
      throw new Error('Write queue is full. Please try again later.');
    }

    const writeOp: WriteOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    await transaction(this.getDb(), STORES.QUEUE, 'readwrite', (store) =>
      store.add(writeOp)
    );

    // Also save locally for immediate UI update
    if (operation.operation === 'set' || operation.operation === 'update') {
      if (operation.data) {
        await this.saveLocally(operation.collection, operation.documentId, operation.data);
      }
    } else if (operation.operation === 'delete') {
      await this.deleteLocally(operation.collection, operation.documentId);
    }
  }

  /**
   * Sync pending writes to the server
   */
  async syncPendingWrites(): Promise<SyncResult> {
    await this.ensureInitialized();

    if (!this.onlineStatus) {
      return {
        success: false,
        operationsSynced: 0,
        operationsFailed: 0,
        errors: ['Device is offline'],
      };
    }

    const operations = await this.getPendingOperations();

    if (operations.length === 0) {
      return {
        success: true,
        operationsSynced: 0,
        operationsFailed: 0,
        errors: [],
      };
    }

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const op of operations) {
      try {
        await this.executeOperation(op);
        await this.removeFromQueue(op.id);
        synced++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`${op.collection}/${op.documentId}: ${err.message}`);

        // Update retry count
        op.retryCount++;

        if (op.retryCount >= op.maxRetries) {
          // Remove from queue after max retries
          await this.removeFromQueue(op.id);
          failed++;
        } else {
          // Update the operation with new retry count
          await this.updateQueuedOperation(op);
        }
      }
    }

    return {
      success: failed === 0,
      operationsSynced: synced,
      operationsFailed: failed,
      errors,
    };
  }

  /**
   * Get current queue size
   */
  async getQueueSize(): Promise<number> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORES.QUEUE, 'readonly');
      const store = tx.objectStore(STORES.QUEUE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count queue: ${request.error?.message}`));
    });
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return this.onlineStatus;
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: (online: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Clear all local data
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const tx = this.getDb().transaction([STORES.DOCUMENTS, STORES.QUEUE, STORES.METADATA], 'readwrite');

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.DOCUMENTS).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.QUEUE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.METADATA).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  }

  /**
   * Get local storage statistics
   */
  async getStats(): Promise<{
    documentCount: number;
    queueSize: number;
    estimatedSizeBytes: number;
  }> {
    await this.ensureInitialized();

    const documentCount = await new Promise<number>((resolve, reject) => {
      const request = this.getDb().transaction(STORES.DOCUMENTS, 'readonly')
        .objectStore(STORES.DOCUMENTS)
        .count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const queueSize = await this.getQueueSize();

    // Estimate storage size
    let estimatedSizeBytes = 0;
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      estimatedSizeBytes = estimate.usage ?? 0;
    }

    return {
      documentCount,
      queueSize,
      estimatedSizeBytes,
    };
  }

  // ============== Private Methods ==============

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('LocalPersistence not initialized');
    }
  }

  private setupConnectionListeners(): void {
    if (typeof window === 'undefined') {return;}

    this.onlineStatus = navigator.onLine;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    this.onlineStatus = true;
    this.notifyConnectionChange(true);

    // Trigger sync when coming online
    void this.syncPendingWrites();
  };

  private handleOffline = (): void => {
    this.onlineStatus = false;
    this.notifyConnectionChange(false);
  };

  private notifyConnectionChange(online: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(online);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private startSyncInterval(): void {
    if (this.syncInterval) {return;}

    this.syncInterval = setInterval(() => {
      if (this.onlineStatus) {
        void this.syncPendingWrites();
      }
    }, this.config.syncIntervalMs);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async getPendingOperations(): Promise<WriteOperation[]> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORES.QUEUE, 'readonly');
      const store = tx.objectStore(STORES.QUEUE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result as WriteOperation[]);
      request.onerror = () => reject(new Error(`Failed to get queue: ${request.error?.message}`));
    });
  }

  private async removeFromQueue(operationId: string): Promise<void> {
    await transaction(this.getDb(), STORES.QUEUE, 'readwrite', (store) =>
      store.delete(operationId)
    );
  }

  private async updateQueuedOperation(operation: WriteOperation): Promise<void> {
    await transaction(this.getDb(), STORES.QUEUE, 'readwrite', (store) =>
      store.put(operation)
    );
  }

  private async executeOperation(operation: WriteOperation): Promise<void> {
    // Import Firestore service dynamically
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    switch (operation.operation) {
      case 'set':
        if (!operation.data) {
          throw new Error('Data is required for set operation');
        }
        await FirestoreService.set(
          operation.collection,
          operation.documentId,
          operation.data,
          false
        );
        break;

      case 'update':
        if (!operation.data) {
          throw new Error('Data is required for update operation');
        }
        await FirestoreService.update(
          operation.collection,
          operation.documentId,
          operation.data
        );
        break;

      case 'delete':
        await FirestoreService.delete(operation.collection, operation.documentId);
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.operation}`);
    }
  }
}

// Singleton instance
let localPersistenceInstance: LocalPersistence | null = null;

export function getLocalPersistence(config?: Partial<PersistenceConfig>): LocalPersistence {
  localPersistenceInstance ??= new LocalPersistence(config);
  return localPersistenceInstance;
}

export function resetLocalPersistence(): void {
  if (localPersistenceInstance) {
    void localPersistenceInstance.close();
    localPersistenceInstance = null;
  }
}
