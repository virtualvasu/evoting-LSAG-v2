import { ethers } from 'ethers';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyX: string;
  publicKeyY: string;
}

export function generateKeyPair(): KeyPair {
  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;

  // Get the public key (uncompressed format without the '04' prefix)
  const publicKeyUncompressed = wallet.signingKey.publicKey.slice(2); // Remove '0x' prefix
  
  // Split into X and Y coordinates (32 bytes each)
  const publicKeyX = publicKeyUncompressed.slice(0, 64);
  const publicKeyY = publicKeyUncompressed.slice(64, 128);
  const publicKey = publicKeyX + publicKeyY;

  return {
    privateKey: privateKey,
    publicKey: '0x' + publicKey,
    publicKeyX: '0x' + publicKeyX,
    publicKeyY: '0x' + publicKeyY,
  };
}
