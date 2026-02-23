const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');

function bigIntToBuffer(value) {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

function hashToPoint(Px, Py) {
    const pxBuffer = bigIntToBuffer(Px);
    const pyBuffer = bigIntToBuffer(Py);
    const concatenated = new Uint8Array([...pxBuffer, ...pyBuffer]);
    const hash = keccak_256(concatenated);
    const scalar = BigInt('0x' + Buffer.from(hash).toString('hex')) % secp256k1.CURVE.n;
    const point = secp256k1.ProjectivePoint.BASE.multiply(scalar);
    return point.toAffine();
}

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

// Test with actual values
const privateKey = BigInt('0x219b0a0ca69114e5e070494561742870aa70a3a15e5ac6b97b8f2b86e5113b61');
const publicKey = {
    x: BigInt('0x70b51ec2aeb6b4933d4a0a88199f5c26f9bb2541dfbf6685f80d303a8afb9c9a'),
    y: BigInt('0xd690c9d274a61dd9b3b93ff29a14433e10af1fc5f88d3b0cf5170368205085fb')
};
const electionId = BigInt('0x3880f3ec42b6e388c0b850db1c7ce8111cdf912870acad8b8e02d7ac03561595');

const G = secp256k1.ProjectivePoint.BASE;
const n = secp256k1.CURVE.n;

console.log("Testing LSAG generation for ring size 1...\n");

// Step 1: Compute key image
const H_P = hashToPoint(publicKey.x, publicKey.y);
const keyImage = secp256k1.ProjectivePoint.fromAffine(H_P).multiply(privateKey).toAffine();
console.log("Key Image:");
console.log("  X:", "0x" + keyImage.x.toString(16));
console.log("  Y:", "0x" + keyImage.y.toString(16));
console.log();

// Step 2: Pick random alpha
const alpha = BigInt('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'); // fixed for testing

// Step 3: Compute L_alpha, R_alpha
const L_alpha = G.multiply(alpha).toAffine();
const R_alpha = secp256k1.ProjectivePoint.fromAffine(H_P).multiply(alpha).toAffine();

console.log("Alpha-based computation:");
console.log("  L_alpha:", "0x" + L_alpha.x.toString(16).substring(0, 16) + "...");
console.log("  R_alpha:", "0x" + R_alpha.x.toString(16).substring(0, 16) + "...");

// Step 4: Compute initial challenge
const c = computeChallenge(electionId, L_alpha.x, L_alpha.y, R_alpha.x, R_alpha.y);
console.log("  Initial c:", "0x" + c.toString(16).substring(0, 16) + "...");
console.log();

// Step 5: Compute s[0] = alpha - c * privateKey (mod n)
const s0 = (alpha - (c * privateKey % n) + n) % n;
console.log("Computed s[0]:", "0x" + s0.toString(16).substring(0, 16) + "...");
console.log();

// Step 6: Verify - compute L, R using s[0] and c
console.log("Verification:");
const sG = G.multiply(s0).toAffine();
const cP = secp256k1.ProjectivePoint.fromAffine(publicKey).multiply(c).toAffine();
const L = secp256k1.ProjectivePoint.fromAffine(sG).add(secp256k1.ProjectivePoint.fromAffine(cP)).toAffine();

const sH = secp256k1.ProjectivePoint.fromAffine(H_P).multiply(s0).toAffine();
const cI = secp256k1.ProjectivePoint.fromAffine(keyImage).multiply(c).toAffine();
const R = secp256k1.ProjectivePoint.fromAffine(sH).add(secp256k1.ProjectivePoint.fromAffine(cI)).toAffine();

console.log("  L:", "0x" + L.x.toString(16).substring(0, 16) + "...");
console.log("  R:", "0x" + R.x.toString(16).substring(0, 16) + "...");

// Check if L == L_alpha and R == R_alpha
console.log();
console.log("L == L_alpha?", L.x === L_alpha.x && L.y === L_alpha.y ? "✅ YES" : "❌ NO");
console.log("R == R_alpha?", R.x === R_alpha.x && R.y === R_alpha.y ? "✅ YES" : "❌ NO");

// Compute challenge from L, R
const c_verify = computeChallenge(electionId, L.x, L.y, R.x, R.y);
console.log();
console.log("Challenge from verification:", "0x" + c_verify.toString(16).substring(0, 16) + "...");
console.log("Original challenge:         ", "0x" + c.toString(16).substring(0, 16) + "...");
console.log("Match?", c_verify === c ? "✅ YES" : "❌ NO");
