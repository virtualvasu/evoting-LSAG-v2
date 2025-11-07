const VoterRegistration = require('./voter-registration');
const fs = require('fs');
const path = require('path');

/**
 * Test Voter Registration with Generated Certificates
 * Tests the complete voter registration process using certificates from government
 */

async function testVoterRegistration() {
    console.log('🗳️  Testing Voter Registration Process...\n');

    try {
        // Load deployment configuration
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        
        // Load voter database to get certificates
        const databasePath = path.join(__dirname, '../config/voter-database.json');
        const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

        console.log('📋 Available voters for registration:');
        Object.values(database.voters).forEach((voter, index) => {
            console.log(`${index + 1}. ${voter.name} (${voter.id})`);
        });

        // Let's test with Alice (VOTER_001)
        const testVoterId = 'VOTER_001';
        const voterData = database.voters[testVoterId];
        const certificateHash = voterData.certificateHash;
        const certificate = database.certificates[certificateHash].certificate;

        console.log(`\n👤 Testing registration for: ${voterData.name} (${testVoterId})`);
        console.log('Contract Address:', deployment.contractAddress);

        // Initialize voter registration
        const registration = new VoterRegistration(deployment.contractAddress);

        // Step 1: Use government wallet for transactions (since it has funds)
        const CryptoUtils = require('../utils/crypto-utils');
        
        // Load government private key from config (has funds)
        const govConfigPath = path.join(__dirname, '../config/government-config.json');
        const govConfig = JSON.parse(fs.readFileSync(govConfigPath, 'utf8'));
        const voterTransactionKey = govConfig.privateKey;
        
        console.log('\n🔑 Using funded government wallet for transactions:');
        console.log('Address:', govConfig.address);
        console.log('Private Key:', voterTransactionKey);

        // Step 2: Generate voter keys first (in real scenario, voter does this before getting certificate)
        console.log('\n🔑 Generating voter keys...');
        const voterKeys = registration.generateVoterKeys();
        
        console.log('Generated Public Key:', voterKeys.publicKey);
        
        // For testing: we'll override the generated key with the certified key
        // In real scenario, the certificate P_uv would match the voter's generated public key
        registration.voterKeyPair.publicKey = CryptoUtils.hexToBuffer(certificate.P_uv);
        
        console.log('\n📜 Voter Certificate:');
        console.log('Government Public Key:', certificate.P_ugov);
        console.log('Voter Public Key:', certificate.P_uv);
        console.log('Government Signature:', certificate.sigma_tilde_v.substring(0, 20) + '...');

        // Step 3: Receive certificate
        console.log('\n📥 Receiving certificate...');
        registration.receiveCertificate(certificate);

        // Step 4: Complete registration process
        console.log('\n🚀 Starting voter registration on blockchain...');

        console.log('\n📋 Registration Process:');
        console.log('Phase 1: Submit Certificate to Blockchain (storePub)');
        console.log('Phase 2: Generate LSAG Signature');  
        console.log('Phase 3: Submit LSAG Registration (verify)');

        // Complete the registration
        const result = await registration.completeRegistration(voterTransactionKey, certificate);

        if (result.status === 'SUCCESS') {
            console.log('\n🎉 VOTER REGISTRATION SUCCESSFUL! 🎉');
            console.log('=====================================');
            console.log('Voter:', voterData.name);
            console.log('Voter ID:', testVoterId);
            console.log('Certificate Transaction:', result.transactions.certificate);
            console.log('LSAG Registration Transaction:', result.transactions.lsagRegistration);
            console.log('Ring Position:', result.voterInfo.ringPosition);
            console.log('Registration Index:', result.voterInfo.registrationIndex);
            
            console.log('\n✅ Voter is now registered and can participate in voting!');
            
            // Save successful registration
            const registrationRecord = {
                voterId: testVoterId,
                voterName: voterData.name,
                registrationResult: result,
                fundedWallet: {
                    address: govConfig.address,
                    privateKey: voterTransactionKey
                },
                completedAt: new Date().toISOString()
            };

            const recordPath = path.join(__dirname, '../config/test-registration-result.json');
            fs.writeFileSync(recordPath, JSON.stringify(registrationRecord, null, 2));
            console.log(`💾 Registration record saved to: test-registration-result.json`);

        } else {
            console.log('\n❌ VOTER REGISTRATION FAILED');
            console.log('Error:', result.error);
            console.log('Status:', result.registrationStatus);
        }

        return result;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            status: 'ERROR',
            error: error.message
        };
    }
}

// Run test if called directly
if (require.main === module) {
    testVoterRegistration()
        .then((result) => {
            if (result.status === 'SUCCESS') {
                console.log('\n🎊 Test completed successfully!');
                console.log('\n📋 Next Steps:');
                console.log('1. Repeat registration for other voters (Bob, Carol)');
                console.log('2. Begin voting phase implementation');
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

module.exports = { testVoterRegistration };