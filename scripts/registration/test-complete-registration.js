const VoterRegistration = require('./voter-registration');
const GovernmentCertificateGenerator = require('./government-certificate-generator');
const CryptoUtils = require('../utils/crypto-utils');
const fs = require('fs');
const path = require('path');

/**
 * Complete End-to-End Voter Registration Test
 * This test properly simulates the full flow:
 * 1. Voter generates keys
 * 2. Government creates certificate for those keys  
 * 3. Voter registers with matching keys
 */

async function testCompleteRegistration() {
    console.log('🔄 Complete End-to-End Voter Registration Test\n');

    try {
        // Load configuration
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

        // Load government config
        const govConfigPath = path.join(__dirname, '../config/government-config.json');
        const govConfig = JSON.parse(fs.readFileSync(govConfigPath, 'utf8'));

        console.log('📋 Test Setup:');
        console.log('Contract Address:', deployment.contractAddress);
        console.log('Government Address:', govConfig.address);

        // Step 1: Voter generates their own keys (realistic scenario)
        console.log('\n👤 Step 1: Voter generates keys');
        const voterKeyPair = CryptoUtils.generateKeyPair();
        const voterPrivateKey = CryptoUtils.bufferToHex(voterKeyPair.privateKey);
        const voterPublicKey = voterKeyPair.publicKey;

        console.log('Voter Private Key:', voterPrivateKey);
        console.log('Voter Public Key:', CryptoUtils.bufferToHex(voterPublicKey));

        // Step 2: Government creates certificate for voter's public key
        console.log('\n🏛️  Step 2: Government creates certificate for voter');
        const generator = new GovernmentCertificateGenerator();
        
        // Add voter to eligible list
        const testVoterId = 'TEST_VOTER_' + Date.now();
        generator.addEligibleVoter(testVoterId, {
            name: 'Test Voter Alice',
            email: 'test@example.com'
        });

        // Generate certificate for voter's public key
        const certificateResult = generator.generateCertificate(testVoterId, voterPublicKey);
        
        console.log('✅ Certificate generated');
        console.log('Certificate Hash:', certificateResult.certificateHash);

        // Step 3: Voter registration with matching keys
        console.log('\n🗳️  Step 3: Voter registration process');
        const registration = new VoterRegistration(deployment.contractAddress);

        // Load voter's keys (they generated these in step 1)
        registration.loadVoterKeys(voterPrivateKey);
        
        // Receive certificate from government
        registration.receiveCertificate(certificateResult.certificate);

        // Complete registration using government wallet (which has funds)
        console.log('\n🚀 Starting blockchain registration...');
        const result = await registration.completeRegistration(
            govConfig.privateKey, 
            certificateResult.certificate
        );

        if (result.status === 'SUCCESS') {
            console.log('\n🎉 COMPLETE REGISTRATION SUCCESS! 🎉');
            console.log('=====================================');
            console.log('Voter ID:', testVoterId);
            console.log('Certificate Transaction:', result.transactions.certificate);
            console.log('LSAG Registration Transaction:', result.transactions.lsagRegistration);
            console.log('Ring Position:', result.voterInfo.ringPosition);
            
            // Save successful registration
            const registrationRecord = {
                voterId: testVoterId,
                voterName: 'Test Voter Alice',
                voterKeys: {
                    privateKey: voterPrivateKey,
                    publicKey: CryptoUtils.bufferToHex(voterPublicKey)
                },
                certificate: certificateResult.certificate,
                registrationResult: result,
                completedAt: new Date().toISOString()
            };

            const recordPath = path.join(__dirname, '../config/complete-registration-success.json');
            fs.writeFileSync(recordPath, JSON.stringify(registrationRecord, null, 2));
            console.log(`💾 Complete registration record saved`);
            
            // Update voter database with success
            generator.markCertificateAsUsed(certificateResult.certificateHash);
            generator.saveDatabase();

            console.log('\n✅ Voter is now fully registered and can vote!');
            console.log('\n📊 Final Status:');
            console.log('- Certificate: ✅ Stored on blockchain');
            console.log('- LSAG Registration: ✅ Completed');
            console.log('- Ring Membership: ✅ Confirmed');
            console.log('- Ready for Voting: ✅ Yes');

        } else {
            console.log('\n❌ REGISTRATION FAILED');
            console.log('Error:', result.error);
            console.log('Status:', result.registrationStatus);
        }

        return result;

    } catch (error) {
        console.error('❌ Complete test failed:', error);
        return {
            status: 'ERROR',
            error: error.message
        };
    }
}

// Run test if called directly
if (require.main === module) {
    testCompleteRegistration()
        .then((result) => {
            if (result.status === 'SUCCESS') {
                console.log('\n🎊 Complete End-to-End Test Successful!');
                console.log('\n📋 Next Steps:');
                console.log('1. Test additional voter registrations');
                console.log('2. Implement voting phase');
                console.log('3. Test complete e-voting workflow');
            } else {
                console.log('\n💡 Test completed with issues. Check logs above.');
            }
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testCompleteRegistration };