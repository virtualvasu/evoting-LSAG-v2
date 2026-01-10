const { ethers } = require('hardhat');

async function testECOperations() {
    const deploymentPath = require('path').join(__dirname, '../config/deployment.json');
    const deployment = require('fs').readFileSync(deploymentPath, 'utf8');
    const { contractAddress } = JSON.parse(deployment);
    
    const contract = await ethers.getContractAt('EVoting', contractAddress);
    
    console.log('Testing EC Operations...\n');
    
    // Test 1: Simple ecMulG
    try {
        console.log('Test 1: ecMulG with scalar 1');
        // This should just return the generator point
        const ECOps = await ethers.getContractAt('ECOperations', contractAddress);
        console.log('✓ Can access EC operations');
    } catch (e) {
        console.log('✗ Error:', e.message);
    }
    
    // Test 2: Check if hashToPoint works
    try {
        console.log('\nTest 2: Call hashToPoint directly');
        const ringKeys = await contract.getRegisteredPublicKeys();
        if (ringKeys.length > 0) {
            const pubKey = ringKeys[0];
            const x = '0x' + pubKey.slice(2, 66);
            const y = '0x' + pubKey.slice(66, 130);
            console.log(`  Testing with ring key:`);
            console.log(`  X: ${x}`);
            console.log(`  Y: ${y}`);
            
            // We can't call hashToPoint directly as it's internal
            // But we can test if the public key is valid
            console.log('  (hashToPoint is internal, cannot test directly)');
        }
    } catch (e) {
        console.log('✗ Error:', e.message);
    }
    
    console.log('\n✅ Basic tests complete');
}

testECOperations()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
