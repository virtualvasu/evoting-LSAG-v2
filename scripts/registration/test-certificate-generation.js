const GovernmentCertificateGenerator = require('./government-certificate-generator');
const CryptoUtils = require('../utils/crypto-utils');

/**
 * Simple test script for government certificate generation
 * Non-interactive version for testing
 */

async function testGovernmentCertificates() {
    console.log('🧪 Testing Government Certificate Generator...\n');

    try {
        // Initialize generator
        const generator = new GovernmentCertificateGenerator();
        generator.loadDatabase(); // Load existing data if any

        // Add some test voters
        console.log('📋 Adding test voters...');
        const testVoters = [
            { id: 'VOTER_001', name: 'Alice Johnson', email: 'alice@example.com' },
            { id: 'VOTER_002', name: 'Bob Smith', email: 'bob@example.com' },
            { id: 'VOTER_003', name: 'Carol Williams', email: 'carol@example.com' }
        ];

        generator.addEligibleVoters(testVoters);

        // Show statistics
        console.log('\n📊 Current Statistics:');
        console.log(generator.getStatistics());

        // Generate keys and certificates for each voter
        console.log('\n🔐 Generating keys and certificates...');
        const voterCertificates = [];

        for (const voter of testVoters) {
            // Generate key pair for the voter (in real system, voter generates their own keys)
            const keyPair = CryptoUtils.generateKeyPair();
            
            console.log(`\n👤 Processing ${voter.name} (${voter.id})`);
            console.log('Public Key:', CryptoUtils.bufferToHex(keyPair.publicKey));

            // Generate certificate
            const certificateResult = generator.generateCertificate(voter.id, keyPair.publicKey);
            
            voterCertificates.push({
                voterId: voter.id,
                voterName: voter.name,
                privateKey: CryptoUtils.bufferToHex(keyPair.privateKey),
                publicKey: CryptoUtils.bufferToHex(keyPair.publicKey),
                certificate: certificateResult.certificate,
                certificateHash: certificateResult.certificateHash
            });

            console.log('✅ Certificate generated for', voter.name);
        }

        // Save database
        generator.saveDatabase();
        console.log('\n💾 Database saved');

        // Display final statistics
        console.log('\n📊 Final Statistics:');
        console.log(generator.getStatistics());

        // Show all certificates
        console.log('\n📜 Generated Certificates:');
        console.log('=====================================');
        
        voterCertificates.forEach((data, index) => {
            console.log(`\n${index + 1}. ${data.voterName} (${data.voterId})`);
            console.log('Certificate Hash:', data.certificateHash);
            console.log('Certificate JSON:');
            console.log(JSON.stringify(data.certificate, null, 2));
            console.log('---');
        });

        console.log('\n🎉 Test completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Copy certificate JSON to voters for registration');
        console.log('2. Voters can use voter-registration.js with these certificates');
        console.log('3. Certificates are saved in voter-database.json');

        return voterCertificates;

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run test if called directly
if (require.main === module) {
    testGovernmentCertificates()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testGovernmentCertificates };