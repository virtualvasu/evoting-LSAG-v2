/**
 * Key Storage Service
 * Manages IndexedDB storage for encrypted keys and public keys
 */

import { KeyPair } from './keypair-utils';
import { EncryptedKeyData } from './key-encryption-service';

export interface StoredKeyPair {
  id: string; // Unique identifier
  type: 'registration' | 'voting'; // Key type
  publicKey: string; // Unencrypted public key
  publicKeyX: string;
  publicKeyY: string;
  encryptedPrivateKey: EncryptedKeyData; // Encrypted private key
  label: string; // User-friendly label
  createdAt: string; // ISO timestamp
  isLocked: boolean; // Lock state
}

const DB_NAME = 'VoterPortalDB';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';

/**
 * Initialize IndexedDB
 */
function initializeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for keypairs
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('type', 'type', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Save encrypted keypair to IndexedDB
 */
export async function saveKeyPair(
  keyPair: KeyPair,
  encryptedPrivateKey: EncryptedKeyData,
  keyType: 'registration' | 'voting',
  label?: string
): Promise<StoredKeyPair> {
  const db = await initializeDB();

  const storedKeyPair: StoredKeyPair = {
    id: `key-${keyType}-${Date.now()}`,
    type: keyType,
    publicKey: keyPair.publicKey,
    publicKeyX: keyPair.publicKeyX,
    publicKeyY: keyPair.publicKeyY,
    encryptedPrivateKey,
    label: label || `${keyType.charAt(0).toUpperCase() + keyType.slice(1)} Key (${new Date().toLocaleDateString()})`,
    createdAt: new Date().toISOString(),
    isLocked: true,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.add(storedKeyPair);

    request.onerror = () => {
      reject(new Error('Failed to save keypair'));
    };

    request.onsuccess = () => {
      resolve(storedKeyPair);
    };
  });
}

/**
 * Get stored keypair by ID
 */
export async function getKeyPairById(id: string): Promise<StoredKeyPair | null> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onerror = () => {
      reject(new Error('Failed to retrieve keypair'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Get all stored keypairs
 */
export async function getAllKeyPairs(): Promise<StoredKeyPair[]> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onerror = () => {
      reject(new Error('Failed to retrieve keypairs'));
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };
  });
}

/**
 * Get keypairs by type
 */
export async function getKeyPairsByType(type: 'registration' | 'voting'): Promise<StoredKeyPair[]> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('type');
    const request = index.getAll(type);

    request.onerror = () => {
      reject(new Error('Failed to retrieve keypairs by type'));
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };
  });
}

/**
 * Update keypair lock status
 */
export async function updateKeyPairLockStatus(id: string, isLocked: boolean): Promise<void> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const getRequest = objectStore.get(id);

    getRequest.onsuccess = () => {
      const keyPair = getRequest.result;
      if (keyPair) {
        keyPair.isLocked = isLocked;
        const updateRequest = objectStore.put(keyPair);

        updateRequest.onerror = () => {
          reject(new Error('Failed to update lock status'));
        };

        updateRequest.onsuccess = () => {
          resolve();
        };
      } else {
        reject(new Error('Keypair not found'));
      }
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to retrieve keypair'));
    };
  });
}

/**
 * Delete keypair from storage
 */
export async function deleteKeyPair(id: string): Promise<void> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onerror = () => {
      reject(new Error('Failed to delete keypair'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Clear all stored keypairs
 */
export async function clearAllKeyPairs(): Promise<void> {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    request.onerror = () => {
      reject(new Error('Failed to clear keypairs'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}
