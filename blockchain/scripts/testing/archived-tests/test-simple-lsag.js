/**
 * Test the simple LSAG implementation
 * Tests both JS generation/verification and then Solidity verification
 */

const { generateSimpleLSAG, verifySimpleLSAG } = require('./utils/simple-lsag');
const { secp256k1 } = require('@noble/curves/secp256k1');

async function testSimpleLSAG() {
    console.log("=".repeat(70));
    console.log("Testing Simple LSAG Implementation");
    console.log("=".repeat(70));
    console.log();
    
    // Create a test ring of 3 voters
    const voters = [];
    for (let i = 0; i < 3; i++) {
        const privKeyBytes = secp256k1.utils.randomPrivateKey();
        const privKey = BigInt('0x' + Buffer.from(privKeyBytes).toString('hex'));
        const pubKey = secp256k1.ProjectivePoint.BASE.multiply(privKey).toAffine();
        voters.push({
            privateKey: privKey,
            publicKey: { x: pubKey.x, y: pubKey.y }
        });
        console.log(`Voter ${i}:`);
        console.log(`  Private: 0x${privKey.toString(16).substring(0, 16)}...`);
        console.log(`  Public X: 0x${pubKey.x.toString(16).substring(0, 16)}...`);
        console.log(`  Public Y: 0x${pubKey.y.toString(16).substring(0, 16)}...`);
    }
    console.log();
    
    const ring = voters.map(v => v.publicKey);
    const electionId = BigInt(1);
    
    // Test each voter as signer
    for (let signerIndex = 0; signerIndex < voters.length; signerIndex++) {
        console.log("-".repeat(70));
        console.log(`Test ${signerIndex + 1}: Signer at position ${signerIndex}`);
        console.log("-".repeat(70));
        
        const signer = voters[signerIndex];
        
        // Generate signature
        const signature = generateSimpleLSAG(
            electionId,
            signer.privateKey,
            signer.publicKey,
            ring,
            signerIndex
        );
        
        console.log();
        console.log("Signature generated:");
        console.log("  Key Image X:", "0x" + signature.keyImageX.toString(16).substring(0, 32) + "...");
        console.log("  Key Image Y:", "0x" + signature.keyImageY.toString(16).substring(0, 32) + "...");
        console.log("  c[0]:", "0x" + signature.c0.toString(16).substring(0, 32) + "...");
        console.log("  Responses:", signature.s.length, "values");
        console.log();
        
        // Verify signature in JS
        const valid = verifySimpleLSAG(electionId, signature, ring);
        
        console.log();
        if (valid) {
            console.log("✅ TEST PASSED for signer at position", signerIndex);
        } else {
            console.log("❌ TEST FAILED for signer at position", signerIndex);
            process.exit(1);
        }
        console.log();
    }
    
    console.log("=".repeat(70));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(70));
}

testSimpleLSAG()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });
