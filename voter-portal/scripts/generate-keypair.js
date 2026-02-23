const { secp256k1 } = require('@noble/curves/secp256k1');

console.log("Generating new secp256k1 key pair...\n");

// Generate random private key
const privateKeyBytes = secp256k1.utils.randomPrivateKey();
const privateKey = BigInt('0x' + Buffer.from(privateKeyBytes).toString('hex'));

// Derive public key
const publicKeyPoint = secp256k1.ProjectivePoint.BASE.multiply(privateKey).toAffine();

// Format as 64-byte uncompressed public key (32 bytes X + 32 bytes Y)
const publicKeyX = publicKeyPoint.x.toString(16).padStart(64, '0');
const publicKeyY = publicKeyPoint.y.toString(16).padStart(64, '0');
const publicKey = publicKeyX + publicKeyY;

console.log("✅ New Key Pair Generated:\n");
console.log("Private Key:");
console.log("  0x" + privateKey.toString(16));
console.log();
console.log("Public Key (64 bytes, uncompressed):");
console.log("  0x" + publicKey);
console.log();
console.log("Public Key X:");
console.log("  0x" + publicKeyX);
console.log();
console.log("Public Key Y:");
console.log("  0x" + publicKeyY);
console.log();
console.log("─".repeat(70));
console.log("Save these values! You'll need:");
console.log("1. Private Key: for signing LSAG signatures");
console.log("2. Public Key: for registration in the voter ring");
console.log("─".repeat(70));

// Verify the pair
const verifyPub = secp256k1.ProjectivePoint.BASE.multiply(privateKey).toAffine();
const match = verifyPub.x === publicKeyPoint.x && verifyPub.y === publicKeyPoint.y;
console.log("\n✓ Verification:", match ? "PASSED" : "FAILED");
