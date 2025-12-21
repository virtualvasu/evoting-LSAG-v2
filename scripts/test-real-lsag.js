const RealLSAG = require('./utils/real-lsag');
const CryptoUtils = require('./utils/crypto-utils');
const { ethers } = require('ethers');

/**
 * Test Real LSAG Implementation
 * Tests the cryptographic operations before blockchain integration
 */

async function testRealLSAG() {
    console.log('🧪 Testing Real LSAG Implementation\n');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Generate test key pairs
        console.log('\n📝 Step 1: Generating test key pairs...');
        const voter1 = CryptoUtils.generateKeyPair();
        const voter2 = CryptoUtils.generateKeyPair();
        const voter3 = CryptoUtils.generateKeyPair();
        
        console.log('✅ Generated 3 voter key pairs');
        
        // Step 2: Create ring of public keys (as hex strings)
        console.log('\n📝 Step 2: Creating ring of public keys...');
        const ring = [
            '04' + CryptoUtils.bufferToHex(voter1.publicKey).slice(2),
            '04' + CryptoUtils.bufferToHex(voter2.publicKey).slice(2),
            '04' + CryptoUtils.bufferToHex(voter3.publicKey).slice(2)
        ];
        console.log(`✅ Ring size: ${ring.length} members`);
        
        // Step 3: Generate key image
        console.log('\n📝 Step 3: Generating key image for voter 1...');
        const keyImage = RealLSAG.generateKeyImage(voter1.privateKey, voter1.publicKey);
        console.log(`✅ Key image generated: ${keyImage.length} bytes`);
        console.log(`   Key image (hex): ${CryptoUtils.bufferToHex(keyImage)}`);
        
        // Step 4: Generate LSAG signature
        console.log('\n📝 Step 4: Generating LSAG signature...');
        const message = Buffer.from('VOTER_REGISTRATION', 'utf8');
        const signerIndex = 0; // voter1 is the signer
        
        const signature = RealLSAG.generateSignature(
            message,
            voter1.privateKey,
            voter1.publicKey,
            ring,
            signerIndex
        );
        
        console.log('✅ LSAG signature generated successfully!');
        console.log(`   Challenge array length: ${signature.c.length}`);
        console.log(`   Response array length: ${signature.s.length}`);
        console.log(`   Key image: ${CryptoUtils.bufferToHex(signature.keyImage)}`);
        console.log(`   First challenge: ${signature.c[0].slice(0, 20)}...`);
        console.log(`   First response: ${signature.s[0].slice(0, 20)}...`);
        
        // Step 5: Verify LSAG signature
        console.log('\n📝 Step 5: Verifying LSAG signature...');
        const isValid = RealLSAG.verifySignature(signature, ring, message);
        
        if (isValid) {
            console.log('✅ Signature verification PASSED! ✨');
        } else {
            console.log('❌ Signature verification FAILED!');
        }
        
        // Step 6: Test key image consistency
        console.log('\n📝 Step 6: Testing key image consistency...');
        const keyImage2 = RealLSAG.generateKeyImage(voter1.privateKey, voter1.publicKey);
        const keyImagesMatch = Buffer.compare(keyImage, keyImage2) === 0;
        
        if (keyImagesMatch) {
            console.log('✅ Key images are consistent (same private key → same key image)');
        } else {
            console.log('❌ Key images do not match!');
        }
        
        // Step 7: Test with different signer
        console.log('\n📝 Step 7: Testing with different signer (voter 2)...');
        const signature2 = RealLSAG.generateSignature(
            message,
            voter2.privateKey,
            voter2.publicKey,
            ring,
            1 // voter2 is at index 1
        );
        
        const isValid2 = RealLSAG.verifySignature(signature2, ring, message);
        console.log(`   Voter 2 signature valid: ${isValid2 ? '✅' : '❌'}`);
        
        // Step 8: Check key image difference
        const keyImage2FromVoter2 = Buffer.from(signature2.keyImage);
        const keyImagesDifferent = Buffer.compare(keyImage, keyImage2FromVoter2) !== 0;
        
        if (keyImagesDifferent) {
            console.log('✅ Different voters produce different key images (unlinkability works)');
        } else {
            console.log('❌ Key images should be different for different voters!');
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Real LSAG Test Summary:');
        console.log('='.repeat(60));
        console.log(`✅ Key generation: PASS`);
        console.log(`✅ Ring formation: PASS`);
        console.log(`✅ Key image generation: PASS`);
        console.log(`✅ Signature generation: PASS`);
        console.log(`${isValid ? '✅' : '❌'} Signature verification: ${isValid ? 'PASS' : 'FAIL'}`);
        console.log(`${keyImagesMatch ? '✅' : '❌'} Key image consistency: ${keyImagesMatch ? 'PASS' : 'FAIL'}`);
        console.log(`${keyImagesDifferent ? '✅' : '❌'} Key image uniqueness: ${keyImagesDifferent ? 'PASS' : 'FAIL'}`);
        console.log('='.repeat(60));
        
        if (isValid && keyImagesMatch && keyImagesDifferent) {
            console.log('\n🎊 ALL TESTS PASSED! Real LSAG is working correctly! 🎊\n');
            return true;
        } else {
            console.log('\n⚠️  SOME TESTS FAILED - Check implementation\n');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testRealLSAG()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = testRealLSAG;
