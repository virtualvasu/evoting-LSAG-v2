// Template for LSAG signature generation matching Solidity verification
// This shows the exact format and algorithm needed

const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');

/**
 * Generate LSAG signature that matches Solidity verification
 * 
 * IMPORTANT: This implementation must match the Solidity verification exactly:
 * - Use keccak256 for all hashing
 * - Use uncompressed point format (32 bytes X, 32 bytes Y)
 * - Match HashToPoint behavior from Secp256k1.sol
 * - Match challenge computation: keccak256(electionId, Lix, Liy, Rix, Riy)
 */

/**
 * Hash to point - MUST match Secp256k1.HashToPoint behavior
 * Solidity does: hash = keccak256(abi.encodePacked(x, y)); scalar = uint256(hash) % n; return scalar * G
 */
function hashToPoint(Px, Py) {
    // Convert to 32-byte buffers
    const pxBuffer = bigIntToBuffer(Px);
    const pyBuffer = bigIntToBuffer(Py);
    
    // Hash with keccak256
    const concatenated = new Uint8Array([...pxBuffer, ...pyBuffer]);
    const hash = keccak_256(concatenated);
    
    // Convert to scalar (mod n)
    const scalar = BigInt('0x' + Buffer.from(hash).toString('hex')) % secp256k1.CURVE.n;
    
    // Multiply generator by scalar
    const point = secp256k1.ProjectivePoint.BASE.multiply(scalar);
    
    return point.toAffine();
}

/**
 * Convert BigInt to 32-byte buffer (big-endian)
 */
function bigIntToBuffer(value) {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

/**
 * Compute challenge: keccak256(electionId, Lx, Ly, Rx, Ry)
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
 * Generate LSAG signature
 * 
 * @param {BigInt} electionId - Election identifier
 * @param {BigInt} privateKey - Signer's private key
 * @param {Object} publicKey - Signer's public key {x, y}
 * @param {Array} ring - Array of public keys [{x, y}, ...]
 * @param {number} signerIndex - Index of signer in ring
 * @returns {Object} - {keyImageX, keyImageY, c, s: []}
 */
function generateLSAGSignature(electionId, privateKey, publicKey, ring, signerIndex) {
    const n = secp256k1.CURVE.n; // curve order
    const G = secp256k1.ProjectivePoint.BASE;
    
    console.log("Generating LSAG signature...");
    console.log("  Ring size:", ring.length);
    console.log("  Signer index:", signerIndex);
    
    // Step 1: Compute key image I = privateKey * H(publicKey)
    const H_Pk = hashToPoint(publicKey.x, publicKey.y);
    const H_Pk_point = secp256k1.ProjectivePoint.fromAffine(H_Pk);
    const keyImage = H_Pk_point.multiply(privateKey).toAffine();
    
    console.log("  Key image computed");
    
    // Step 2: Generate random alpha
    const alpha = secp256k1.utils.randomPrivateKey();
    const alphaBigInt = BigInt('0x' + Buffer.from(alpha).toString('hex'));
    
    // Step 3: Initialize arrays
    const s = new Array(ring.length);
    const ci = new Array(2); // alternating challenge array like Solidity
    
    // Step 4: Compute alpha-based L and R at signer position
    // This matches the Go implementation exactly
    let j = (signerIndex + 1) % ring.length;
    const L_alpha = G.multiply(alphaBigInt).toAffine();
    const H_Pk_signer = hashToPoint(ring[signerIndex].x, ring[signerIndex].y);
    const R_alpha = secp256k1.ProjectivePoint.fromAffine(H_Pk_signer).multiply(alphaBigInt).toAffine();
    
    // Compute initial hash
    let hash = computeChallenge(electionId, L_alpha.x, L_alpha.y, R_alpha.x, R_alpha.y);
    
    // Set ci[0] if j == 0 (matching Go implementation)
    if (j === 0) {
        ci[0] = hash;
    }
    
    console.log("  Initial hash computed, j =", j);
    if (j === 0) {
        console.log("    Set ci[0] =", "0x" + hash.toString(16).substring(0, 16) + "...");
    }
    
    // Step 5: Loop through ring from (signer+1) to signer-1
    // This exactly matches the Go implementation
    for (let counter = 0; counter < ring.length - 1; counter++) {
        // Generate random response for position j
        const s_j_bytes = secp256k1.utils.randomPrivateKey();
        s[j] = BigInt('0x' + Buffer.from(s_j_bytes).toString('hex')) % n;
        
        console.log(`  Position ${j}: generating s[${j}], using hash`);
        
        // Compute L = s[j]*G + hash*P[j]
        const sG = G.multiply(s[j]).toAffine();
        const cP = secp256k1.ProjectivePoint.fromAffine({x: ring[j].x, y: ring[j].y}).multiply(hash).toAffine();
        const L = secp256k1.ProjectivePoint.fromAffine(sG).add(secp256k1.ProjectivePoint.fromAffine(cP)).toAffine();
        
        // Compute R = s[j]*H(P[j]) + hash*I
        const H_Pj = hashToPoint(ring[j].x, ring[j].y);
        const sH = secp256k1.ProjectivePoint.fromAffine(H_Pj).multiply(s[j]).toAffine();
        const cI = secp256k1.ProjectivePoint.fromAffine(keyImage).multiply(hash).toAffine();
        const R = secp256k1.ProjectivePoint.fromAffine(sH).add(secp256k1.ProjectivePoint.fromAffine(cI)).toAffine();
        
        // Compute next hash
        hash = computeChallenge(electionId, L.x, L.y, R.x, R.y);
        
        // Increment j and wrap around
        j = (j + 1) % ring.length;
        
        // Set ci[0] if j wrapped to 0
        if (j === 0) {
            ci[0] = hash;
            console.log("    After position, j wrapped to 0, set ci[0] =", "0x" + hash.toString(16).substring(0, 16) + "...");
        }
    }
    
    // Step 6: Close the ring at signer position
    // j should now equal signerIndex
    // hash contains the challenge we need to close with
    console.log("  Closing at position", j, "(should be", signerIndex, ")");
    s[signerIndex] = (alphaBigInt - (hash * privateKey % n) + n) % n;
    
    console.log("  Ring closed");
    console.log("    c_signer:", "0x" + hash.toString(16).substring(0, 16) + "...");
    console.log("    s[" + signerIndex + "]:", "0x" + s[signerIndex].toString(16).substring(0, 16) + "...");
    
    // Step 7: Return ci[0] as the initial challenge
    // This matches the Go implementation and Solidity verification
    const c_initial = ci[0];
    
    console.log("✓ LSAG signature generated");
    console.log("  Returning ci[0] =", "0x" + c_initial.toString(16).substring(0, 16) + "...");
    
    return {
        keyImageX: keyImage.x,
        keyImageY: keyImage.y,
        c: c_initial,
        s: s
    };
}

module.exports = {
    generateLSAGSignature,
    hashToPoint,
    computeChallenge,
    bigIntToBuffer
};

// Example usage (commented out):
/*
const exampleRing = [
    { x: BigInt('0x...'), y: BigInt('0x...') },
    { x: BigInt('0x...'), y: BigInt('0x...') },
    { x: BigInt('0x...'), y: BigInt('0x...') }
];

const privateKey = BigInt('0x...');
const publicKey = { x: BigInt('0x...'), y: BigInt('0x...') };
const signerIndex = 0;
const electionId = 1;

const signature = generateLSAGSignature(electionId, privateKey, publicKey, exampleRing, signerIndex);
console.log('Signature:', signature);
*/
