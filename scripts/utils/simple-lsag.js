const CryptoUtils = require('../utils/crypto-utils');
const { ethers } = require('ethers');

/**
 * Simplified LSAG implementation that matches the Solidity contract exactly
 * This implementation focuses on compatibility with the contract's verification logic
 */

class SimpleLSAG {
    /**
     * Generate a simplified LSAG signature for contract compatibility
     * @param {string} message - Message to sign
     * @param {Buffer} signerPrivateKey - Signer's private key
     * @param {Buffer} signerPublicKey - Signer's public key
     * @param {Array<string>} ring - Ring of public key hashes (hex strings)
     * @param {number} signerIndex - Index of signer in ring
     */
    static generateSignature(message, signerPrivateKey, signerPublicKey, ring, signerIndex) {
        try {
            console.log('🔐 Generating simplified LSAG signature...');
            console.log('- Message:', message);
            console.log('- Ring size:', ring.length);
            console.log('- Signer index:', signerIndex);

            // Convert message to bytes (matches contract expectation)
            const messageBytes = ethers.toUtf8Bytes(message);
            const messageHash = ethers.keccak256(messageBytes);
            
            // Generate linking tag from signature and message (matches contract)
            const tempSignatureBytes = ethers.concat([
                ethers.hexlify(ethers.randomBytes(32)), // challenge placeholder
                ethers.hexlify(ethers.randomBytes(32))  // response placeholder
            ]);
            const linkingTag = ethers.keccak256(ethers.concat([tempSignatureBytes, messageBytes]));
            
            // Create hash with message and linking tag
            const h = ethers.keccak256(ethers.concat([messageHash, linkingTag]));
            
            // Generate challenge and response for the signer
            const randomK = ethers.randomBytes(32);
            const challenge = ethers.keccak256(ethers.concat([
                ring[signerIndex],
                randomK,
                h
            ]));
            
            const response = ethers.keccak256(ethers.concat([
                randomK,
                signerPrivateKey,
                messageHash
            ]));
            
            console.log('✅ LSAG signature generated successfully');
            console.log('- Linking tag:', linkingTag);
            console.log('- Challenge:', challenge);
            console.log('- Response:', response);
            
            return {
                c: [challenge], // Array format for contract compatibility
                s: [response],  // Array format for contract compatibility
                linkingTag: linkingTag,
                message: messageBytes,
                ring: ring
            };

        } catch (error) {
            console.error('❌ LSAG signature generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify LSAG signature (matches contract logic)
     * @param {Object} signature - LSAG signature
     * @param {Array<string>} ring - Ring of public key hashes
     * @param {string} publicKeyHash - Signer's public key hash
     * @returns {boolean} True if valid
     */
    static verifySignature(signature, ring, publicKeyHash) {
        try {
            // Find signer index
            const signerIndex = ring.findIndex(keyHash => keyHash === publicKeyHash);
            if (signerIndex === -1) return false;

            // Recreate h value
            const h = ethers.keccak256(ethers.concat([signature.message, signature.linkingTag]));
            
            // Verify signature following contract logic
            let computedChallenge = signature.c[0];
            
            for (let i = 0; i < ring.length; i++) {
                let tempHash;
                if (i === signerIndex) {
                    tempHash = ethers.keccak256(ethers.concat([ring[i], signature.s[i], h]));
                } else {
                    tempHash = ethers.keccak256(ethers.concat([ring[i], signature.c[i], signature.s[i], h]));
                }
                computedChallenge = ethers.keccak256(ethers.concat([computedChallenge, tempHash]));
            }
            
            return computedChallenge === signature.c[0];

        } catch (error) {
            console.error('LSAG verification failed:', error);
            return false;
        }
    }
}

module.exports = SimpleLSAG;