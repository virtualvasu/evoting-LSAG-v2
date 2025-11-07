const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const { ethers } = require('ethers');

/**
 * ECDSA Cryptographic Utilities for LSAG E-Voting System
 * Provides core cryptographic functions for key generation, signing, and verification
 */

class CryptoUtils {
    /**
     * Generate a new ECDSA key pair
     * @returns {Object} Object containing privateKey (Buffer) and publicKey (Buffer)
     */
    static generateKeyPair() {
        let privateKey;
        do {
            privateKey = crypto.randomBytes(32);
        } while (!secp256k1.privateKeyVerify(privateKey));

        const publicKey = secp256k1.publicKeyCreate(privateKey, false); // uncompressed
        
        return {
            privateKey,
            publicKey: Buffer.from(publicKey.slice(1)) // Remove the 0x04 prefix and convert to Buffer
        };
    }

    /**
     * Generate Ethereum-compatible wallet from private key
     * @param {Buffer} privateKey - 32-byte private key
     * @returns {Object} Wallet object with address and signing capabilities
     */
    static createWallet(privateKey) {
        const wallet = new ethers.Wallet(privateKey);
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            publicKey: wallet.publicKey
        };
    }

    /**
     * Sign a message hash using ECDSA (for PKS signatures)
     * @param {Buffer|string} messageHash - Hash to sign
     * @param {Buffer} privateKey - Private key for signing
     * @returns {Buffer} 65-byte signature (r + s + v)
     */
    static signMessageHash(messageHash, privateKey) {
        // Convert Buffer to hex string if needed
        const privateKeyHex = Buffer.isBuffer(privateKey) ? 
            ethers.hexlify(privateKey) : privateKey;
        const wallet = new ethers.Wallet(privateKeyHex);
        const messageHashBytes = typeof messageHash === 'string' ? 
            ethers.getBytes(messageHash) : messageHash;
        
        // Create Ethereum signed message hash
        const ethSignedHash = ethers.hashMessage(messageHashBytes);
        const signature = wallet.signingKey.sign(ethSignedHash);
        
        // Return signature in the format expected by Solidity (65 bytes: r + s + v)
        return ethers.getBytes(signature.serialized);
    }

    /**
     * Verify ECDSA signature against message hash and public key
     * @param {Buffer|string} messageHash - Original message hash
     * @param {Buffer} signature - 65-byte signature
     * @param {Buffer} publicKey - 64-byte uncompressed public key
     * @returns {boolean} True if signature is valid
     */
    static verifySignature(messageHash, signature, publicKey) {
        try {
            const messageHashBytes = typeof messageHash === 'string' ? 
                ethers.getBytes(messageHash) : messageHash;
            
            // Create Ethereum signed message hash
            const ethSignedHash = ethers.hashMessage(messageHashBytes);
            
            // Derive address from public key
            const expectedAddress = this.deriveAddressFromPublicKey(publicKey);
            
            // Recover address from signature
            const recoveredAddress = ethers.recoverAddress(ethSignedHash, signature);
            
            return expectedAddress.toLowerCase() === recoveredAddress.toLowerCase();
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Derive Ethereum address from uncompressed public key (64 bytes)
     * @param {Buffer} publicKey - 64-byte uncompressed public key
     * @returns {string} Ethereum address
     */
    static deriveAddressFromPublicKey(publicKey) {
        if (publicKey.length !== 64) {
            throw new Error('Public key must be 64 bytes (uncompressed format without prefix)');
        }
        
        // Add the 0x04 prefix for full uncompressed format
        const fullPublicKey = Buffer.concat([Buffer.from([0x04]), publicKey]);
        const hash = ethers.keccak256(fullPublicKey.slice(1)); // Hash without 0x04 prefix
        return ethers.getAddress('0x' + hash.slice(-40)); // Last 20 bytes as address
    }

    /**
     * Generate LSAG signature components (simplified version)
     * This is a basic implementation - full LSAG would be more complex
     * @param {Buffer} privateKey - Signer's private key
     * @param {Array} ring - Array of public keys in the ring
     * @param {Buffer} message - Message to sign
     * @returns {Object} LSAG signature components
     */
    static generateLSAGSignature(privateKey, ring, message) {
        // Find signer's position in ring
        const signerPublicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
        const signerIndex = ring.findIndex(pubKey => 
            Buffer.compare(pubKey, signerPublicKey) === 0
        );
        
        if (signerIndex === -1) {
            throw new Error('Signer public key not found in ring');
        }

        // Generate random values for other ring members
        const c = new Array(ring.length);
        const s = new Array(ring.length);
        
        // Generate random challenges and responses for non-signer positions
        for (let i = 0; i < ring.length; i++) {
            if (i !== signerIndex) {
                c[i] = crypto.randomBytes(32);
                s[i] = crypto.randomBytes(32);
            }
        }

        // Generate linking tag (key image)
        const linkingTag = this.generateLinkingTag(privateKey, message);

        // Generate signer's challenge (simplified)
        const messageHash = ethers.keccak256(message);
        const combinedHash = ethers.keccak256(
            ethers.concat([messageHash, linkingTag])
        );
        
        // Signer's challenge is derived from the ring equation
        c[signerIndex] = ethers.keccak256(
            ethers.concat([combinedHash, ...ring.map(pk => ethers.keccak256(pk))])
        );

        // Generate signer's response
        const k = crypto.randomBytes(32);
        s[signerIndex] = k; // Simplified - real LSAG would compute proper response

        return {
            c: c.map(val => ethers.hexlify(val)),
            s: s.map(val => ethers.hexlify(val)),
            linkingTag: ethers.hexlify(linkingTag),
            message: ethers.hexlify(message),
            ring: ring.map(pk => ethers.keccak256(pk))
        };
    }

    /**
     * Generate linking tag (key image) for LSAG
     * @param {Buffer} privateKey - Private key
     * @param {Buffer} message - Message being signed
     * @returns {Buffer} Linking tag
     */
    static generateLinkingTag(privateKey, message) {
        // Simplified linking tag generation
        const publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
        return ethers.getBytes(ethers.keccak256(
            ethers.concat([privateKey, publicKey, message])
        ));
    }

    /**
     * Verify LSAG signature (basic implementation)
     * @param {Object} signature - LSAG signature object
     * @param {Array} ring - Ring of public keys
     * @param {Buffer} message - Original message
     * @returns {boolean} True if signature is valid
     */
    static verifyLSAGSignature(signature, ring, message) {
        try {
            // Basic verification - check if arrays have correct lengths
            if (signature.c.length !== ring.length || 
                signature.s.length !== ring.length) {
                return false;
            }

            // Verify message hash matches
            const messageHash = ethers.keccak256(message);
            const signatureMessageHash = ethers.keccak256(signature.message);
            
            if (messageHash !== signatureMessageHash) {
                return false;
            }

            // Additional verification logic would go here in full implementation
            return true;
        } catch (error) {
            console.error('LSAG verification failed:', error);
            return false;
        }
    }

    /**
     * Create certificate structure for government signing
     * @param {Buffer} voterPublicKey - Voter's public key
     * @param {Buffer} governmentPrivateKey - Government's private key
     * @param {Buffer} governmentPublicKey - Government's public key
     * @returns {Object} Certificate object
     */
    static createCertificate(voterPublicKey, governmentPrivateKey, governmentPublicKey) {
        // Government signs the voter's public key
        const messageHash = ethers.keccak256(voterPublicKey);
        const signature = this.signMessageHash(messageHash, governmentPrivateKey);

        return {
            sigma_tilde_v: signature,
            P_ugov: governmentPublicKey,
            P_uv: voterPublicKey
        };
    }

    /**
     * Hash function for vote commitments
     * @param {string} candidate - Candidate identifier
     * @param {Buffer} randomness - Random value
     * @returns {string} Hash value
     */
    static hashVote(candidate, randomness) {
        return ethers.keccak256(
            ethers.concat([
                ethers.toUtf8Bytes(candidate),
                randomness
            ])
        );
    }

    /**
     * Generate secure random bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Buffer} Random bytes
     */
    static generateRandomBytes(length = 32) {
        return crypto.randomBytes(length);
    }

    /**
     * Convert buffer to hex string with 0x prefix
     * @param {Buffer} buffer - Buffer to convert
     * @returns {string} Hex string
     */
    static bufferToHex(buffer) {
        return ethers.hexlify(buffer);
    }

    /**
     * Convert hex string to buffer
     * @param {string} hex - Hex string (with or without 0x prefix)
     * @returns {Buffer} Buffer
     */
    static hexToBuffer(hex) {
        return Buffer.from(ethers.getBytes(hex));
    }
}

module.exports = CryptoUtils;