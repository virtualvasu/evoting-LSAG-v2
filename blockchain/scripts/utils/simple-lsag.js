/**
 * Simple LSAG (Linkable Spontaneous Anonymous Group) Signature
 * 
 * This is a straightforward implementation without complex alternating arrays.
 * Uses a simple forward-chaining challenge approach: c[0] -> c[1] -> c[2] -> ... -> c[0]
 */

const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');

/**
 * Convert BigInt to 32-byte buffer (big-endian)
 */
function bigIntToBuffer(value) {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

/**
 * Hash to point - matches Solidity Secp256k1.HashToPoint
 * H(P) = keccak256(Px || Py) * G
 */
function hashToPoint(Px, Py) {
    const pxBuffer = bigIntToBuffer(Px);
    const pyBuffer = bigIntToBuffer(Py);
    
    const concatenated = new Uint8Array([...pxBuffer, ...pyBuffer]);
    const hash = keccak_256(concatenated);
    
    const scalar = BigInt('0x' + Buffer.from(hash).toString('hex')) % secp256k1.CURVE.n;
    const point = secp256k1.ProjectivePoint.BASE.multiply(scalar);
    
    return point.toAffine();
}

/**
 * Compute challenge: keccak256(electionId || Lx || Ly || Rx || Ry)
 */
function computeChallenge(electionId, Lx, Ly, Rx, Ry) {
    const electionIdBuffer = bigIntToBuffer(BigInt(electionId));
    const lxBuffer = bigIntToBuffer(Lx);
    const lyBuffer = bigIntToBuffer(Ly);
    const rxBuffer = bigIntToBuffer(Rx);
    const ryBuffer = bigIntToBuffer(Ry);
    
    const concatenated = new Uint8Array([
        ...electionIdBuffer,
        ...lxBuffer,
        ...lyBuffer,
        ...rxBuffer,
        ...ryBuffer
    ]);
    
    const hash = keccak_256(concatenated);
    return BigInt('0x' + Buffer.from(hash).toString('hex'));
}

/**
 * Generate LSAG signature - SIMPLE VERSION
 * 
 * @param {BigInt} electionId - Election identifier
 * @param {BigInt} privateKey - Signer's private key
 * @param {Object} publicKey - Signer's public key {x, y}
 * @param {Array} ring - Array of public keys [{x, y}, ...]
 * @param {number} signerIndex - Index of signer in ring
 * @returns {Object} - {keyImageX, keyImageY, c0, s: []}
 */
function generateSimpleLSAG(electionId, privateKey, publicKey, ring, signerIndex) {
    const n = secp256k1.CURVE.n;
    const G = secp256k1.ProjectivePoint.BASE;
    const ringSize = ring.length;
    
    console.log("Generating simple LSAG signature...");
    console.log("  Ring size:", ringSize);
    console.log("  Signer index:", signerIndex);
    
    // Step 1: Compute key image I = privateKey * H(publicKey)
    const H_Pk = hashToPoint(publicKey.x, publicKey.y);
    const keyImage = secp256k1.ProjectivePoint.fromAffine(H_Pk).multiply(privateKey).toAffine();
    console.log("  ✓ Key image computed");
    
    // Step 2: Generate random alpha
    const alphaBytes = secp256k1.utils.randomPrivateKey();
    const alpha = BigInt('0x' + Buffer.from(alphaBytes).toString('hex'));
    console.log("  ✓ Random alpha generated");
    
    // Step 3: Initialize response array
    const s = new Array(ringSize);
    
    // Step 4: Compute alpha-based L and R at signer position
    const L_alpha = G.multiply(alpha).toAffine();
    const H_Pk_signer = hashToPoint(ring[signerIndex].x, ring[signerIndex].y);
    const R_alpha = secp256k1.ProjectivePoint.fromAffine(H_Pk_signer).multiply(alpha).toAffine();
    
    // Step 5: Compute first challenge at position AFTER signer
    const startPos = (signerIndex + 1) % ringSize;
    let currentChallenge = computeChallenge(electionId, L_alpha.x, L_alpha.y, R_alpha.x, R_alpha.y);
    console.log("  ✓ Initial challenge at position", startPos);
    
    // Store c[0] if we're starting at position 0
    let c0;
    if (startPos === 0) {
        c0 = currentChallenge;
    }
    
    // Step 6: Loop through ring (except signer)
    for (let j = 0; j < ringSize - 1; j++) {
        const i = (startPos + j) % ringSize;
        
        // Generate random response for this position
        const sBytes = secp256k1.utils.randomPrivateKey();
        s[i] = BigInt('0x' + Buffer.from(sBytes).toString('hex')) % n;
        
        // Compute L = s[i]*G + c[i]*P[i]
        const sG = G.multiply(s[i]).toAffine();
        const cP = secp256k1.ProjectivePoint.fromAffine({x: ring[i].x, y: ring[i].y})
            .multiply(currentChallenge).toAffine();
        const L = secp256k1.ProjectivePoint.fromAffine(sG)
            .add(secp256k1.ProjectivePoint.fromAffine(cP)).toAffine();
        
        // Compute R = s[i]*H(P[i]) + c[i]*I
        const H_Pi = hashToPoint(ring[i].x, ring[i].y);
        const sH = secp256k1.ProjectivePoint.fromAffine(H_Pi).multiply(s[i]).toAffine();
        const cI = secp256k1.ProjectivePoint.fromAffine(keyImage)
            .multiply(currentChallenge).toAffine();
        const R = secp256k1.ProjectivePoint.fromAffine(sH)
            .add(secp256k1.ProjectivePoint.fromAffine(cI)).toAffine();
        
        // Compute next challenge
        currentChallenge = computeChallenge(electionId, L.x, L.y, R.x, R.y);
        
        // Store c[0] if next position is 0
        const nextPos = (i + 1) % ringSize;
        if (nextPos === 0) {
            c0 = currentChallenge;
            console.log("  ✓ Stored c[0] after position", i);
        }
    }
    
    // Step 7: Close the ring at signer position
    // currentChallenge is c[signerIndex]
    s[signerIndex] = (alpha - (currentChallenge * privateKey % n) + n) % n;
    console.log("  ✓ Ring closed at position", signerIndex);
    
    console.log("✅ Simple LSAG signature generated");
    console.log("  c[0]:", "0x" + c0.toString(16).substring(0, 16) + "...");
    
    return {
        keyImageX: keyImage.x,
        keyImageY: keyImage.y,
        c0: c0,
        s: s
    };
}

/**
 * Verify LSAG signature - SIMPLE VERSION
 * 
 * @param {BigInt} electionId - Election identifier
 * @param {Object} signature - {keyImageX, keyImageY, c0, s: []}
 * @param {Array} ring - Array of public keys [{x, y}, ...]
 * @returns {boolean} - True if valid
 */
function verifySimpleLSAG(electionId, signature, ring) {
    const G = secp256k1.ProjectivePoint.BASE;
    const ringSize = ring.length;
    
    if (signature.s.length !== ringSize) {
        console.log("❌ Invalid signature: wrong number of responses");
        return false;
    }
    
    console.log("Verifying simple LSAG signature...");
    console.log("  Ring size:", ringSize);
    console.log("  Starting c[0]:", "0x" + signature.c0.toString(16).substring(0, 16) + "...");
    
    let currentChallenge = signature.c0;
    const keyImage = { x: signature.keyImageX, y: signature.keyImageY };
    
    // Loop through entire ring
    for (let i = 0; i < ringSize; i++) {
        // Compute L = s[i]*G + c[i]*P[i]
        const sG = G.multiply(signature.s[i]).toAffine();
        const cP = secp256k1.ProjectivePoint.fromAffine({x: ring[i].x, y: ring[i].y})
            .multiply(currentChallenge).toAffine();
        const L = secp256k1.ProjectivePoint.fromAffine(sG)
            .add(secp256k1.ProjectivePoint.fromAffine(cP)).toAffine();
        
        // Compute R = s[i]*H(P[i]) + c[i]*I
        const H_Pi = hashToPoint(ring[i].x, ring[i].y);
        const sH = secp256k1.ProjectivePoint.fromAffine(H_Pi).multiply(signature.s[i]).toAffine();
        const cI = secp256k1.ProjectivePoint.fromAffine(keyImage)
            .multiply(currentChallenge).toAffine();
        const R = secp256k1.ProjectivePoint.fromAffine(sH)
            .add(secp256k1.ProjectivePoint.fromAffine(cI)).toAffine();
        
        // Compute next challenge
        const nextChallenge = computeChallenge(electionId, L.x, L.y, R.x, R.y);
        
        console.log(`  Position ${i}: c -> 0x${nextChallenge.toString(16).substring(0, 16)}...`);
        
        currentChallenge = nextChallenge;
    }
    
    // After full loop, should arrive back at c[0]
    const valid = currentChallenge === signature.c0;
    console.log("  Final challenge:", "0x" + currentChallenge.toString(16).substring(0, 16) + "...");
    console.log("  Expected c[0]:", "0x" + signature.c0.toString(16).substring(0, 16) + "...");
    console.log(valid ? "✅ Signature VALID" : "❌ Signature INVALID");
    
    return valid;
}

module.exports = {
    generateSimpleLSAG,
    verifySimpleLSAG,
    hashToPoint,
    computeChallenge,
    bigIntToBuffer
};
