import { secp256k1 } from '@noble/curves/secp256k1';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyX: string;
  publicKeyY: string;
}

export function generateKeyPair(): KeyPair {
  // Generate random private key
  const privateKeyBytes = secp256k1.utils.randomPrivateKey();
  const privateKey = BigInt('0x' + Buffer.from(privateKeyBytes).toString('hex'));

  // Derive public key
  const publicKeyPoint = secp256k1.ProjectivePoint.BASE.multiply(privateKey).toAffine();

  // Format as 64-byte uncompressed public key (32 bytes X + 32 bytes Y)
  const publicKeyX = publicKeyPoint.x.toString(16).padStart(64, '0');
  const publicKeyY = publicKeyPoint.y.toString(16).padStart(64, '0');
  const publicKey = publicKeyX + publicKeyY;

  // Verify the pair
  const verifyPub = secp256k1.ProjectivePoint.BASE.multiply(privateKey).toAffine();
  const match = verifyPub.x === publicKeyPoint.x && verifyPub.y === publicKeyPoint.y;
  
  if (!match) {
    throw new Error('Key pair verification failed');
  }

  return {
    privateKey: '0x' + privateKey.toString(16),
    publicKey: '0x' + publicKey,
    publicKeyX: '0x' + publicKeyX,
    publicKeyY: '0x' + publicKeyY,
  };
}
