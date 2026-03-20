import { secp256k1 } from '@noble/curves/secp256k1.js';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyX: string;
  publicKeyY: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateKeyPair(): KeyPair {
  const privateKeyBytes = secp256k1.utils.randomSecretKey();
  const uncompressed = secp256k1.getPublicKey(privateKeyBytes, false);

  if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
    throw new Error('Invalid uncompressed public key encoding');
  }

  const publicKeyX = bytesToHex(uncompressed.slice(1, 33));
  const publicKeyY = bytesToHex(uncompressed.slice(33, 65));
  const publicKey = publicKeyX + publicKeyY;

  if (publicKeyX.length !== 64 || publicKeyY.length !== 64 || publicKey.length !== 128) {
    throw new Error('Generated public key has invalid length');
  }

  const verifyPub = secp256k1.getPublicKey(privateKeyBytes, false);
  const match = bytesToHex(verifyPub.slice(1)) === publicKey;

  if (!match) {
    throw new Error('Key pair verification failed');
  }

  return {
    privateKey: '0x' + bytesToHex(privateKeyBytes),
    publicKey: '0x' + publicKey,
    publicKeyX: '0x' + publicKeyX,
    publicKeyY: '0x' + publicKeyY,
  };
}
