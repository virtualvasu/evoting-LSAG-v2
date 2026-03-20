const { secp256k1 } = require('@noble/curves/secp256k1.js');

console.log("Generating new secp256k1 key pair...\n");

const privateKeyBytes = secp256k1.utils.randomSecretKey();
const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
const uncompressed = secp256k1.getPublicKey(privateKeyBytes, false);

if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
	throw new Error('Invalid uncompressed public key encoding');
}

const publicKeyX = Buffer.from(uncompressed.slice(1, 33)).toString('hex');
const publicKeyY = Buffer.from(uncompressed.slice(33, 65)).toString('hex');
const publicKey = publicKeyX + publicKeyY;

if (publicKeyX.length !== 64 || publicKeyY.length !== 64 || publicKey.length !== 128) {
	throw new Error('Generated public key has invalid length');
}

console.log("✅ New Key Pair Generated:\n");
console.log("Private Key:");
console.log("  0x" + privateKeyHex);
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
const verifyPub = secp256k1.getPublicKey(privateKeyBytes, false);
const match = Buffer.from(verifyPub.slice(1)).toString('hex') === publicKey;
console.log("\n✓ Verification:", match ? "PASSED" : "FAILED");
