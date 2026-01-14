/**
 * Cryptographic Utilities for LSAG E-Voting System
 * Standalone implementation - no external script dependencies
 * Ported from scripts/utils/crypto-utils.js
 */

import { ethers } from 'ethers';

export class CryptoUtils {
  /**
   * Sign voter's credentials using government's private key
   * This generates a PKS signature (σ̃_v = PKS.sign({voterName, sid, publicKey}, P_rgov))
   */
  static signVoterCredentials(
    voterName: string,
    voterStudentId: string,
    voterPublicKey: string,
    governmentPrivateKey: string
  ): string {
    try {
      // Create wallet from government private key
      const wallet = new ethers.Wallet(governmentPrivateKey);

      // Hash all three fields using Solidity-compatible packed encoding
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'string', 'bytes'],
        [voterName, voterStudentId, voterPublicKey]
      );

      // Sign the hash using Ethereum's personal_sign method
      // This automatically adds the Ethereum message prefix
      const messageBytes = ethers.getBytes(messageHash);
      const ethSignedHash = ethers.hashMessage(messageBytes);
      const signature = wallet.signingKey.sign(ethSignedHash);

      // Return the serialized signature (65 bytes: r + s + v)
      return signature.serialized;
    } catch (error) {
      throw new Error(`Signature generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify the signature
   */
  static verifySignature(
    voterName: string,
    voterStudentId: string,
    voterPublicKey: string,
    signature: string,
    governmentAddress: string
  ): boolean {
    try {
      // Hash all three fields using Solidity-compatible packed encoding
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'string', 'bytes'],
        [voterName, voterStudentId, voterPublicKey]
      );
      const messageBytes = ethers.getBytes(messageHash);
      const ethSignedHash = ethers.hashMessage(messageBytes);

      // Recover the address from the signature
      const recoveredAddress = ethers.recoverAddress(ethSignedHash, signature);

      // Compare with government address
      return recoveredAddress.toLowerCase() === governmentAddress.toLowerCase();
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }
}
