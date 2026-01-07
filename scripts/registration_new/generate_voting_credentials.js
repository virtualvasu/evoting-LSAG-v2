const fs = require('fs');
const path = require('path');
const CryptoUtils = require('../utils/crypto-utils');
const RealLSAG = require('../utils/real-lsag');

/**
 * Step 3: Generate Voting Credentials
 * 
 * Simple process:
 * 1. Take the updated voter ring as input
 * 2. Generate NEW key pair (P_uv', s_v') for voting
 * 3. Sign the voter ring using NEW private key
 * 4. Return signature and new public key
 */

async function generateVotingCredentials(voterRingPath) {
    try {
        console.log('\n🔐 Step 3: Generate Voting Credentials\n');
        console.log('='.repeat(70));

        // Load the voter ring
        let resolvedPath = voterRingPath;
        if (!path.isAbsolute(voterRingPath)) {
            resolvedPath = path.resolve(process.cwd(), voterRingPath);
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Voter ring file not found: ${resolvedPath}`);
        }

        console.log(`\n📄 Loading voter ring from: ${resolvedPath}`);
        const data = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        
        // Extract voter ring
        let voterRing;
        if (Array.isArray(data)) {
            voterRing = data;
        } else if (data.voterRing) {
            voterRing = data.voterRing;
        } else {
            throw new Error('Invalid format: voterRing not found in file');
        }

        if (!voterRing || voterRing.length === 0) {
            throw new Error('Voter ring is empty');
        }

        console.log(`\n✓ Voter ring loaded`);
        console.log(`  Ring size: ${voterRing.length}`);
        console.log('📋 Ring members:');
        voterRing.forEach((pubKey, idx) => {
            console.log(`  [${idx}] ${pubKey.substring(0, 20)}...`);
        });

        // Step 1: Generate NEW key pair for voting (P_uv', s_v')
        console.log('\n🔑 Generating new voting key pair...');
        const votingKeyPair = CryptoUtils.generateKeyPair();
        
        // Convert to hex for display and storage
        const votingPrivateKey = Buffer.from(votingKeyPair.privateKey).toString('hex');
        const votingPublicKey = Buffer.from(votingKeyPair.publicKey).toString('hex');
        
        console.log('✓ Voting key pair generated');
        console.log(`  Public Key (P_uv'): ${votingPublicKey.substring(0, 40)}...`);
        console.log(`  Private Key (s_v'): [HIDDEN - stored securely]`);

        // Step 2: Sign the voter ring with the NEW private key
        console.log('\n📝 Signing voter ring with new private key...');
        
        // Create message from the voter ring
        const ringMessage = voterRing.join('');
        const messageHash = Buffer.from(ringMessage, 'utf8');
        
        // Sign using the NEW voting private key
        const signature = CryptoUtils.signMessageHash(
            messageHash,
            votingKeyPair.privateKey
        );

        console.log('✅ Signature generated successfully!');
        console.log(`  Signature: ${signature.toString('hex').substring(0, 40)}...`);

        // Step 3: Package the voting credentials
        const votingCredentials = {
            // NEW voting key pair (P_uv', s_v')
            votingPrivateKey: '0x' + votingPrivateKey,  // s_v' - KEEP PRIVATE!
            votingPublicKey: '0x' + votingPublicKey,     // P_uv' - can be public
            
            // Signature of the voter ring
            signature: '0x' + signature.toString('hex'),
            
            // Voter ring at time of credential generation
            voterRing: voterRing,
            voterRingSize: voterRing.length,
            
            // Metadata
            generatedAt: new Date().toISOString(),
            step: 'Step 3: Voting Credentials Generated'
        };

        // Step 4: Save the voting credentials securely
        const outputDir = path.join(__dirname, '../voting_credentials');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = Date.now();
        const outputPath = path.join(outputDir, `VOTING_CREDS_${timestamp}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(votingCredentials, null, 2));

        console.log('\n💾 Voting credentials saved to:', outputPath);
        console.log('\n⚠️  IMPORTANT SECURITY NOTICE:');
        console.log('='.repeat(70));
        console.log('  This file contains your PRIVATE voting key (s_v\')');
        console.log('  Keep this file SECURE and PRIVATE');
        console.log('  Anyone with this key can cast votes on your behalf');
        console.log('  Do NOT share this file with anyone');
        console.log('='.repeat(70));

        console.log('\n📋 Summary:');
        console.log('='.repeat(70));
        console.log(`  Ring Size: ${voterRing.length}`);
        console.log(`  Voting Public Key: ${votingPublicKey.substring(0, 40)}...`);
        console.log(`  Signature: ${signature.toString('hex').substring(0, 40)}...`);
        console.log('='.repeat(70));

        console.log('\n✅ Step 3 completed!');
        console.log('\n🚀 Next step:');
        console.log('  Use these credentials for anonymous voting');

        return {
            success: true,
            votingPublicKey: '0x' + votingPublicKey,
            signature: '0x' + signature.toString('hex'),
            voterRing: voterRing,
            outputPath
        };

    } catch (error) {
        console.error('\n❌ Error generating voting credentials:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n❌ Error: Voter ring file path required');
        console.log('\nUsage: node generate_voting_credentials.js <voter_ring_file>');
        console.log('\nExamples:');
        console.log('  1. Using VOTER_KEYS file (after running update_voter_ring.js):');
        console.log('     node generate_voting_credentials.js ../pre_registration/VOTER_KEYS_12342330.json');
        console.log('');
        console.log('  2. Using a custom JSON file with voterRing array:');
        console.log('     node generate_voting_credentials.js ./voter_ring.json');
        console.log('');
        console.log('Note: The voter ring should have been saved by update_voter_ring.js (Step 2)');
        process.exit(1);
    }

    const voterRingPath = args[0];
    
    generateVotingCredentials(voterRingPath)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\nFatal error:', error);
            process.exit(1);
        });
}

module.exports = generateVotingCredentials;
