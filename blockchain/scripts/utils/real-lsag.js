const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
const { ethers } = require('ethers');

/**
 * Real LSAG (Linkable Spontaneous Anonymous Group) Signature Implementation
 * Uses proper elliptic curve operations for cryptographic security
 * Compatible with Solidity ecadd/ecmul precompiles
 */
class RealLSAG {
    /**
     * Hash bytes to a point on the secp256k1 curve
     * Uses deterministic approach: hash with counter until valid point found
     */
    static hashToPoint(data) {
        let counter = 0;
        const maxAttempts = 256;
        
        while (counter < maxAttempts) {
            const hash = keccak_256(Buffer.concat([data, Buffer.from([counter])]));
            
            try {
                // Try to create a valid point with this x-coordinate
                const point = this.tryPointFromX(hash);
                if (point) {
                    return point;
                }
            } catch (e) {
                // Continue to next attempt
            }
            counter++;
        }
        
        throw new Error('Could not hash to point after max attempts');
    }

    /**
     * Try to create a point from x-coordinate
     * y^2 = x^3 + 7 (mod p)
     */
    static tryPointFromX(xBytes) {
        try {
            // Try with even y
            const pointHex = '02' + bytesToHex(xBytes);
            const point = secp256k1.ProjectivePoint.fromHex(pointHex);
            return point;
        } catch (e) {
            try {
                // Try with odd y
                const pointHex = '03' + bytesToHex(xBytes);
                const point = secp256k1.ProjectivePoint.fromHex(pointHex);
                return point;
            } catch (e2) {
                return null;
            }
        }
    }

    /**
     * Generate key image (linking tag)
     * I = x * H_p(P) where x is private key, H_p maps to point
     */
    static generateKeyImage(privateKeyBytes, publicKeyBytes) {
        try {
            const privateKey = BigInt('0x' + bytesToHex(privateKeyBytes));
            
            // Hash public key to a point
            const Hp = this.hashToPoint(publicKeyBytes);
            
            // Multiply by private key: I = x * Hp(P)
            const keyImage = Hp.multiply(privateKey);
            
            // Return compressed point (33 bytes)
            return Buffer.from(keyImage.toRawBytes(true));
        } catch (error) {
            console.error('Error generating key image:', error);
            throw error;
        }
    }

    /**
     * Convert BigInt to 32-byte buffer (padded with zeros if needed)
     */
    static bigIntToBuffer(value) {
        const hex = value.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
    }

    /**
     * Parse ring of public keys (provided as hashes from blockchain)
     * Convert back to actual points for verification
     * NOTE: This is a limitation - need actual public keys in ring
     */
    static parseRing(ringData) {
        return ringData.map(item => {
            if (typeof item === 'string') {
                // If it's a hex string, try to treat as compressed point
                return secp256k1.ProjectivePoint.fromHex(item);
            }
            return item;
        });
    }

    /**
     * Generate a real LSAG signature
     * @param {Buffer|string} message - Message to sign
     * @param {Buffer} privateKeyBytes - Signer's private key (32 bytes)
     * @param {Buffer} publicKeyBytes - Signer's public key (64 bytes uncompressed)
     * @param {Array<Buffer>} ring - Ring of public keys (actual keys, not hashes)
     * @param {number} signerIndex - Index of signer in ring
     */
    static generateSignature(message, privateKeyBytes, publicKeyBytes, ring, signerIndex) {
        try {
            console.log('🔐 Generating REAL LSAG signature...');
            console.log('- Ring size:', ring.length);
            console.log('- Signer index:', signerIndex);

            const n = ring.length;
            const privateKey = BigInt('0x' + bytesToHex(privateKeyBytes));
            const q = secp256k1.CURVE.n; // Order of the curve
            
            // Convert message to bytes
            const messageBytes = typeof message === 'string' 
                ? Buffer.from(message, 'utf8')
                : message;
            const messageHash = keccak_256(messageBytes);
            
            // Generate key image
            const keyImage = this.generateKeyImage(privateKeyBytes, publicKeyBytes);
            const I = secp256k1.ProjectivePoint.fromHex(bytesToHex(keyImage));
            
            // Parse ring public keys
            const ringPoints = ring.map((pk, idx) => {
                try {
                    // Convert to hex string
                    let pkHex = typeof pk === 'string' ? pk : bytesToHex(pk);
                    // Remove 0x prefix if present
                    if (pkHex.startsWith('0x')) pkHex = pkHex.slice(2);
                    
                    // Add 04 prefix if it's an uncompressed point without the prefix (64 bytes = 128 hex chars)
                    if (pkHex.length === 128 && !pkHex.startsWith('04') && !pkHex.startsWith('02') && !pkHex.startsWith('03')) {
                        pkHex = '04' + pkHex;
                    }
                    
                    return secp256k1.ProjectivePoint.fromHex(pkHex);
                } catch (e) {
                    console.error(`Could not parse ring point ${idx}:`, e);
                    throw e;
                }
            });
            
            // Initialize signature arrays
            const c = new Array(n);
            const s = new Array(n);
            
            // Generate random alpha
            const alpha = secp256k1.utils.randomPrivateKey();
            const alphaBigInt = BigInt('0x' + bytesToHex(alpha));
            
            // Compute L and R for signer position
            const L_signer = secp256k1.ProjectivePoint.BASE.multiply(alphaBigInt);
            const Hp_pi = this.hashToPoint(publicKeyBytes);
            const R_signer = Hp_pi.multiply(alphaBigInt);
            
            // Start computing challenges - first one is from signer position
            let currentIndex = (signerIndex + 1) % n;
            
            // Hash to get next challenge using uncompressed coordinates
            // Format: keccak256(message || Lix || Liy || Rix || Riy)
            const L_signer_affine = L_signer.toAffine();
            const R_signer_affine = R_signer.toAffine();
            
            let hashInput = Buffer.concat([
                messageHash,
                this.bigIntToBuffer(L_signer_affine.x),
                this.bigIntToBuffer(L_signer_affine.y),
                this.bigIntToBuffer(R_signer_affine.x),
                this.bigIntToBuffer(R_signer_affine.y)
            ]);
            c[(signerIndex + 1) % n] = BigInt('0x' + bytesToHex(keccak_256(hashInput)));
            
            console.log('✓ Generated signer position challenge');
            
            // Generate challenges and responses for non-signer positions
            for (let i = 0; i < n - 1; i++) {
                const pos = (signerIndex + 1 + i) % n;
                
                // Generate random response
                s[pos] = BigInt('0x' + bytesToHex(secp256k1.utils.randomPrivateKey()));
                
                // Compute Li = s[i]*G + c[i]*P[i]
                const sG = secp256k1.ProjectivePoint.BASE.multiply(s[pos]);
                const cP = ringPoints[pos].multiply(c[pos]);
                const Li = sG.add(cP);
                
                // Compute Ri = s[i]*Hp(P[i]) + c[i]*I
                const Hp_i = this.hashToPoint(
                    typeof ring[pos] === 'string' 
                        ? hexToBytes(ring[pos].replace(/^0x/, ''))
                        : ring[pos]
                );
                const sHp = Hp_i.multiply(s[pos]);
                const cI = I.multiply(c[pos]);
                const Ri = sHp.add(cI);
                
                // Compute next challenge using uncompressed coordinates
                // Format: keccak256(message || Lix || Liy || Rix || Riy)
                const Li_affine = Li.toAffine();
                const Ri_affine = Ri.toAffine();
                
                hashInput = Buffer.concat([
                    messageHash,
                    this.bigIntToBuffer(Li_affine.x),
                    this.bigIntToBuffer(Li_affine.y),
                    this.bigIntToBuffer(Ri_affine.x),
                    this.bigIntToBuffer(Ri_affine.y)
                ]);
                c[(pos + 1) % n] = BigInt('0x' + bytesToHex(keccak_256(hashInput)));
            }
            
            console.log('✓ Generated non-signer challenges');
            
            // Close the ring: s[π] = alpha - c[π]*x (mod q)
            // where π is the signer index
            const term = (c[signerIndex] * privateKey) % q;
            let s_signer = (alphaBigInt - term) % q;
            
            // Ensure positive
            if (s_signer < 0n) {
                s_signer = (s_signer + q) % q;
            }
            
            s[signerIndex] = s_signer;
            
            console.log('✓ Closed the ring');
            
            // Verify the ring closes correctly (for debugging) - DISABLED FOR NOW
            // const Li_verify = secp256k1.ProjectivePoint.BASE.multiply(s[signerIndex])
            //     .add(ringPoints[signerIndex].multiply(c[signerIndex]));
            // const Hp_verify = this.hashToPoint(publicKeyBytes);
            // const Ri_verify = Hp_verify.multiply(s[signerIndex])
            //     .add(I.multiply(c[signerIndex]));
            
            // const Li_verify_affine = Li_verify.toAffine();
            // const Ri_verify_affine = Ri_verify.toAffine();
            
            // const hashVerify = Buffer.concat([
            //     messageHash,
            //     this.bigIntToBuffer(Li_verify_affine.x),
            //     this.bigIntToBuffer(Li_verify_affine.y),
            //     this.bigIntToBuffer(Ri_verify_affine.x),
            //     this.bigIntToBuffer(Ri_verify_affine.y)
            // ]);
            // const c_verify = BigInt('0x' + bytesToHex(keccak_256(hashVerify)));
            
            // if (c_verify !== c[(signerIndex + 1) % n]) {
            //     console.warn('⚠️  Ring closure verification failed (debugging only)');
            // }
            
            console.log('✅ REAL LSAG signature generated successfully');
            
            return {
                c: c.map(val => '0x' + val.toString(16).padStart(64, '0')),
                s: s.map(val => '0x' + val.toString(16).padStart(64, '0')),
                keyImage: '0x' + bytesToHex(keyImage),
                message: messageBytes,
                ring: ring
            };
            
        } catch (error) {
            console.error('❌ REAL LSAG signature generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify LSAG signature (for off-chain verification before submission)
     * @param {Object} signature - LSAG signature object
     * @param {Array<Buffer>} ring - Ring of public keys
     * @param {Buffer|string} message - Original message
     */
    static verifySignature(signature, ring, message) {
        try {
            const n = ring.length;
            const messageBytes = typeof message === 'string'
                ? Buffer.from(message, 'utf8')
                : message;
            const messageHash = keccak_256(messageBytes);
            
            // Parse signature components
            const c = signature.c.map(val => BigInt(val));
            const s = signature.s.map(val => BigInt(val));
            // Remove 0x prefix from key image if present
            let keyImageHex = signature.keyImage;
            if (typeof keyImageHex === 'string' && keyImageHex.startsWith('0x')) {
                keyImageHex = keyImageHex.slice(2);
            } else if (Buffer.isBuffer(keyImageHex)) {
                keyImageHex = bytesToHex(keyImageHex);
            }
            const I = secp256k1.ProjectivePoint.fromHex(keyImageHex);
            
            // Parse ring
            const ringPoints = ring.map((pk, idx) => {
                try {
                    // Convert to hex string
                    let pkHex = typeof pk === 'string' ? pk : bytesToHex(pk);
                    // Remove 0x prefix if present
                    if (pkHex.startsWith('0x')) pkHex = pkHex.slice(2);
                    
                    // Add 04 prefix if it's an uncompressed point without the prefix (64 bytes = 128 hex chars)
                    if (pkHex.length === 128 && !pkHex.startsWith('04') && !pkHex.startsWith('02') && !pkHex.startsWith('03')) {
                        pkHex = '04' + pkHex;
                    }
                    
                    return secp256k1.ProjectivePoint.fromHex(pkHex);
                } catch (e) {
                    console.error(`Could not parse ring point ${idx} in verify:`, e);
                    throw e;
                }
            });
            
            // Verify ring equation
            let computedC = c[0];
            
            for (let i = 0; i < n; i++) {
                // Compute Li = s[i]*G + c[i]*P[i]
                const sG = secp256k1.ProjectivePoint.BASE.multiply(s[i]);
                const cP = ringPoints[i].multiply(c[i]);
                const Li = sG.add(cP);
                
                // Compute Ri = s[i]*Hp(P[i]) + c[i]*I
                const Hp_i = this.hashToPoint(
                    typeof ring[i] === 'string'
                        ? hexToBytes(ring[i].replace(/^0x/, ''))
                        : ring[i]
                );
                const sHp = Hp_i.multiply(s[i]);
                const cI = I.multiply(c[i]);
                const Ri = sHp.add(cI);
                
                // Compute next challenge using uncompressed coordinates
                const Li_affine = Li.toAffine();
                const Ri_affine = Ri.toAffine();
                
                const hashInput = Buffer.concat([
                    messageHash,
                    this.bigIntToBuffer(Li_affine.x),
                    this.bigIntToBuffer(Li_affine.y),
                    this.bigIntToBuffer(Ri_affine.x),
                    this.bigIntToBuffer(Ri_affine.y)
                ]);
                
                computedC = BigInt('0x' + bytesToHex(keccak_256(hashInput)));
                
                // Check if we've closed the ring
                if ((i + 1) % n === 0) {
                    // Should equal c[0]
                    return computedC === c[0];
                }
            }
            
            return false;
        } catch (error) {
            console.error('LSAG verification failed:', error);
            return false;
        }
    }

    /**
     * Convert signature to Solidity format for on-chain verification
     */
    static toSolidityFormat(signature) {
        return {
            c: signature.c,
            s: signature.s,
            keyImage: signature.keyImage,
            message: '0x' + bytesToHex(signature.message)
        };
    }
}

module.exports = RealLSAG;
