const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const CryptoUtils = require('../utils/crypto-utils');
const RealLSAG = require('../utils/real-lsag');

/**
 * Generate LSAG signature for voter
 * 
 * Steps:
 * 1. Fetch the voter ring from contract
 * 2. Generate new PKS key pair for voter
 * 3. Generate LSAG signature: LSAG.sign(election_id, voter_ring, voter's_private_key_original)
 * 4. Return LSAG signature and new public key
 * 
 * @param {string} originalPrivateKey - Voter's original private key (hex with 0x prefix)
 * @param {string} registeredPublicKey - Voter's public key that was registered in the ring (hex with 0x prefix)
 * @param {string} voterName - Voter's name
 * @param {string} sid - Student/Voter ID
 * @param {string} electionId - Election ID to sign
 */
async function generateLSAGSignature(originalPrivateKey, registeredPublicKey, voterName, sid, electionId = 'election_001') {
    try {
        console.log('\n🔐 Generate LSAG Signature\n');
        console.log('='.repeat(70));

        // Validate inputs
        if (!originalPrivateKey || !registeredPublicKey || !voterName || !sid) {
            throw new Error('Missing required parameters: originalPrivateKey, registeredPublicKey, voterName, sid');
        }

        console.log(`\n✓ Input parameters validated`);
        console.log(`  Voter: ${voterName}`);
        console.log(`  SID: ${sid}`);
        console.log(`  Private Key: ${originalPrivateKey.substring(0, 20)}...`);
        console.log(`  Registered Public Key: ${registeredPublicKey.substring(0, 20)}...`);

        // Load deployment config
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('Deployment config not found. Please deploy the contract first.');
        }
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const contractAddress = deployment.contractAddress;

        // Connect to contract
        const [signer] = await ethers.getSigners();
        const contract = await ethers.getContractAt('EVoting', contractAddress, signer);
        
        console.log(`\n📡 Connected to contract: ${contractAddress}`);

        // Step 1: Fetch voter ring
        console.log(`\n📊 Fetching voter ring...`);
        const voterRing = await contract.getRegisteredPublicKeys();
        console.log(`  Ring size: ${voterRing.length}`);

        if (voterRing.length === 0) {
            throw new Error('Voter ring is empty. Please register voters first.');
        }

        // Find voter's position in the ring using the registered public key
        const voterPublicKey = registeredPublicKey.startsWith('0x') 
            ? registeredPublicKey.slice(2).toLowerCase()
            : registeredPublicKey.toLowerCase();
        
        let signerIndex = -1;
        for (let i = 0; i < voterRing.length; i++) {
            const ringPubKey = voterRing[i].startsWith('0x')
                ? voterRing[i].slice(2).toLowerCase()
                : voterRing[i].toLowerCase();
            if (ringPubKey === voterPublicKey) {
                signerIndex = i;
                break;
            }
        }

        if (signerIndex === -1) {
            console.error(`  Voter public key: ${registeredPublicKey}`);
            console.error(`  Ring contains:`);
            voterRing.forEach((pk, idx) => console.error(`    [${idx}] ${pk}`));
            throw new Error('Voter public key not found in ring. Please register voter first.');
        }

        console.log(`  ✓ Found voter at position ${signerIndex} in ring`);

        // Step 2: Generate new PKS key pair
        console.log(`\n🔑 Generating new PKS key pair...`);
        const newKeyPair = CryptoUtils.generateKeyPair();
        const newPublicKeyHex = '0x' + newKeyPair.publicKey.toString('hex');
        const newPrivateKeyHex = '0x' + newKeyPair.privateKey.toString('hex');

        console.log(`  ✓ New key pair generated`);
        console.log(`  Public Key: ${newPublicKeyHex.substring(0, 20)}...`);

        // Step 3: Generate LSAG signature
        console.log(`\n🔐 Generating LSAG signature using original private key...`);
        
        // Convert message (election_id) to buffer
        const messageBuffer = Buffer.from(electionId, 'utf8');
        
        // Convert voter's original private key from hex to buffer
        const originalPrivateKeyHex = originalPrivateKey.startsWith('0x')
            ? originalPrivateKey.slice(2)
            : originalPrivateKey;
        const originalPrivateKeyBuffer = Buffer.from(originalPrivateKeyHex, 'hex');

        // Convert voter's registered public key from hex to buffer
        const registeredPublicKeyHex = registeredPublicKey.startsWith('0x')
            ? registeredPublicKey.slice(2)
            : registeredPublicKey;
        const registeredPublicKeyBuffer = Buffer.from(registeredPublicKeyHex, 'hex');

        console.log(`  ✓ Using ORIGINAL private key for LSAG signature`);
        console.log(`  ✓ Signing election ID: ${electionId}`);

        // Generate LSAG signature
        const lsagSignature = RealLSAG.generateSignature(
            messageBuffer,
            originalPrivateKeyBuffer,
            registeredPublicKeyBuffer,
            voterRing,
            signerIndex
        );

        console.log(`  ✓ LSAG signature generated`);
        console.log(`  Key Image: ${lsagSignature.keyImage.substring(0, 20)}...`);

        // Step 4: Prepare result
        const result = {
            voterName: voterName,
            sid: sid,
            electionId: electionId,
            newPublicKey: newPublicKeyHex,
            newPrivateKey: newPrivateKeyHex,
            lsagSignature: {
                c: lsagSignature.c.map(val => '0x' + val.toString(16).padStart(64, '0')),
                s: lsagSignature.s.map(val => '0x' + val.toString(16).padStart(64, '0')),
                keyImage: lsagSignature.keyImage.startsWith('0x')
                    ? lsagSignature.keyImage
                    : '0x' + (typeof lsagSignature.keyImage === 'string' ? lsagSignature.keyImage : Buffer.from(lsagSignature.keyImage).toString('hex')),
                message: '0x' + (typeof lsagSignature.message === 'string' ? lsagSignature.message.startsWith('0x') ? lsagSignature.message.slice(2) : lsagSignature.message : lsagSignature.message.toString('hex')),
                ringX: lsagSignature.ringX,
                ringY: lsagSignature.ringY
            }
        };

        // Save to file
        const outputDir = path.join(__dirname, '../pre_registration');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputFilename = `LSAG_${sid}.json`;
        const outputPath = path.join(outputDir, outputFilename);

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        console.log(`\n📤 Signature saved to: ${outputPath}`);

        console.log('\n' + '='.repeat(70));
        console.log(`✅ LSAG Signature generated successfully!`);
        console.log(`   Voter: ${voterName} (${sid})`);
        console.log(`   Election ID: ${electionId}`);
        console.log(`   New Public Key: ${newPublicKeyHex.substring(0, 20)}...`);
        console.log(`   Signature Key Image: ${lsagSignature.keyImage.substring(0, 20)}...`);
        console.log('='.repeat(70) + '\n');

        return result;

    } catch (error) {
        console.error('\n❌ Error generating LSAG signature:', error.message);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // Support both command line arguments and environment variables
    let originalPrivateKey, registeredPublicKey, voterName, sid, electionId;
    
    if (args.length >= 4) {
        // Command line arguments: <private_key> <public_key> <voter_name> <sid> [election_id]
        originalPrivateKey = args[0];
        registeredPublicKey = args[1];
        voterName = args[2];
        sid = args[3];
        electionId = args[4] || 'election_001';
    } else {
        // Try environment variables
        originalPrivateKey = process.env.ORIGINAL_PRIVATE_KEY;
        registeredPublicKey = process.env.REGISTERED_PUBLIC_KEY;
        voterName = process.env.VOTER_NAME;
        sid = process.env.VOTER_SID;
        electionId = process.env.ELECTION_ID || 'election_001';
        
        if (!originalPrivateKey || !registeredPublicKey || !voterName || !sid) {
            console.log('\n❌ Missing required parameters!\n');
            console.log('Usage (command line):');
            console.log('  node generate-lsag-signature.js <original_private_key> <registered_public_key> <voter_name> <sid> [election_id]\n');
            console.log('Usage (environment variables):');
            console.log('  ORIGINAL_PRIVATE_KEY=0x... REGISTERED_PUBLIC_KEY=0x... VOTER_NAME="John" VOTER_SID="123" \\');
            console.log('  npx hardhat run scripts/registration_new/generate-lsag-signature.js --network localhost\n');
            console.log('Example (command line):');
            console.log('  node generate-lsag-signature.js \\');
            console.log('    0x219b0a0ca69114e5e070494561742870aa70a3a15e5ac6b97b8f2b86e5113b61 \\');
            console.log('    0x70b51ec2aeb6b4933d4a0a88199f5c26f9bb2541dfbf6685f80d303a8afb9c9ad690c9d274a61dd9b3b93ff29a14433e10af1fc5f88d3b0cf5170368205085fb \\');
            console.log('    "vasu g" \\');
            console.log('    12342330 \\');
            console.log('    election_001\n');
            console.log('Example (environment variables):');
            console.log('  ORIGINAL_PRIVATE_KEY=0x219b0a0ca69114e5e070494561742870aa70a3a15e5ac6b97b8f2b86e5113b61 \\');
            console.log('  REGISTERED_PUBLIC_KEY=0x70b51ec2aeb6b4933d4a0a88199f5c26f9bb2541dfbf6685f80d303a8afb9c9ad690c9d274a61dd9b3b93ff29a14433e10af1fc5f88d3b0cf5170368205085fb \\');
            console.log('  VOTER_NAME="vasu g" VOTER_SID="12342330" \\');
            console.log('  npx hardhat run scripts/registration_new/generate-lsag-signature.js --network localhost\n');
            process.exit(1);
        }
    }

    generateLSAGSignature(originalPrivateKey, registeredPublicKey, voterName, sid, electionId)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\nFatal error:', error);
            process.exit(1);
        });
}

module.exports = generateLSAGSignature;
