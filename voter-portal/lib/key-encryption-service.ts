/**
 * Key Encryption Service
 * Handles encryption/decryption of private keys using user password
 * Algorithm: AES-256-GCM with PBKDF2 key derivation
 */

export interface EncryptedKeyData {
  ciphertext: string; // base64 encoded
  iv: string; // base64 encoded
  salt: string; // base64 encoded
  algorithm: string;
  timestamp: number;
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  return Array.from(view, (x) => x.toString(16).padStart(2, '0')).join('');
}

// Convert hex string to ArrayBuffer
function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

// Base64 utilities
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive an encryption key from password
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key
  const baseKey = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);

  // Derive key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt private key with user password
 * @param privateKey - The private key string (e.g., "0x123abc...")
 * @param password - User's password for encryption
 * @returns Encrypted key data with salt and IV
 */
export async function encryptPrivateKey(privateKey: string, password: string): Promise<EncryptedKeyData> {
  try {
    // Generate random salt (16 bytes)
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from password
    const encryptionKey = await deriveKeyFromPassword(password, salt);

    // Encode private key
    const encoder = new TextEncoder();
    const privateKeyBuffer = encoder.encode(privateKey);

    // Encrypt using AES-256-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      encryptionKey,
      privateKeyBuffer
    );

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer),
      algorithm: 'AES-256-GCM',
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(`Failed to encrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt private key with user password
 * @param encryptedData - Encrypted key data from storage
 * @param password - User's password for decryption
 * @returns Decrypted private key string
 */
export async function decryptPrivateKey(encryptedData: EncryptedKeyData, password: string): Promise<string> {
  try {
    // Parse base64 encoded data
    const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
    const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedData.ciphertext));

    // Derive decryption key from password
    const decryptionKey = await deriveKeyFromPassword(password, salt);

    // Decrypt using AES-256-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      decryptionKey,
      ciphertext
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new Error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify password by attempting partial decryption
 * @param encryptedData - Encrypted key data
 * @param password - Password to verify
 * @returns True if password is correct, false otherwise
 */
export async function verifyPassword(encryptedData: EncryptedKeyData, password: string): Promise<boolean> {
  try {
    await decryptPrivateKey(encryptedData, password);
    return true;
  } catch {
    return false;
  }
}
