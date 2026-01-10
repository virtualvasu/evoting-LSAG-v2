const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function testLSAGVerification() {
    const lsagPath = path.join(__dirname, '../pre_registration/LSAG_12342330.json');
    const lsagData = JSON.parse(fs.readFileSync(lsagPath, 'utf8'));
    
    const deploymentPath = path.join(__dirname, '../config/deployment.json');
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const contract = await ethers.getContractAt('EVoting', deployment.contractAddress);
    
    console.log('\n🧪 Testing LSAG Verification Components\n');
    console.log('='.repeat(70));
    
    // Parse key image
    const keyImageHex = lsagData.lsagSignature.keyImage;
    const secp256k1 = require('@noble/secp256k1');
    const keyImageBuffer = Buffer.from(keyImageHex.slice(2), 'hex');
    const point = secp256k1.Point.fromHex(keyImageBuffer);
    const uncompressed = point.toRawBytes(false);
    
    const keyImageX = '0x' + Buffer.from(uncompressed.slice(1, 33)).toString('hex');
    const keyImageY = '0x' + Buffer.from(uncompressed.slice(33, 65)).toString('hex');
    
    console.log('\n✓ Key Image:');
    console.log(`  X: ${keyImageX}`);
    console.log(`  Y: ${keyImageY}`);
    
    // Get ring
    const ringSize = await contract.getRingSize();
    console.log(`\n✓ Ring Size: ${ringSize}`);
    
    if (ringSize == 0) {
        console.log('\n❌ Ring is empty! Register voters first.');
        return;
    }
    
    const ring = await contract.getRegisteredPublicKeys();
    console.log(`✓ Retrieved ${ring.length} public keys from ring`);
    
    // Parse election ID
    const electionIdBuffer = Buffer.from(lsagData.electionId, 'utf8');
    const electionId = ethers.keccak256(electionIdBuffer);
    console.log(`\n✓ Election ID: ${electionId}`);
    
    // Parse signature components
    let c = lsagData.lsagSignature.c[0];
    if (c.startsWith('0x0x')) {
        c = '0x' + c.slice(4);
    }
    
    const s = lsagData.lsagSignature.s.map(val => {
        if (val.startsWith('0x0x')) {
            return '0x' + val.slice(4);
        }
        return val;
    });
    
    console.log(`\n✓ Challenge c: ${c}`);
    console.log(`✓ Responses s: ${s.length} values`);
    console.log(`  s[0]: ${s[0]}`);
    
    // Build LSAG signature struct
    const lsagSignature = {
        keyImageX: keyImageX,
        keyImageY: keyImageY,
        c: c,
        s: s
    };
    
    try {
        console.log('\n🔍 Calling LSAGver...');
        const result = await contract.LSAGver(electionId, lsagSignature);
        console.log(`✅ LSAGver returned: ${result}`);
        
        if (result) {
            console.log('\n🎉 LSAG signature is VALID!');
        } else {
            console.log('\n❌ LSAG signature is INVALID (verification failed)');
        }
    } catch (error) {
        console.log(`\n❌ LSAGver failed with error:`);
        console.log(`  ${error.message}`);
        
        if (error.message.includes('precompile 7')) {
            console.log('\n💡 Precompile 7 (ECMUL) failure suggests invalid point coordinates');
            console.log('   This usually means one of:');
            console.log('   1. Key image is not on curve');
            console.log('   2. Ring member public key is not on curve');
            console.log('   3. H(P) generated an invalid point');
        }
        
        if (error.reason) {
            console.log(`\n  Revert reason: ${error.reason}`);
        }
    }
}

testLSAGVerification()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
