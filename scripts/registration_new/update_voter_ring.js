const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

/**
 * Simple script to add voter to ring using their certificate
 * Takes certificate JSON file and submits to contract
 */

async function updateVoterRing(certPath) {
    try {
        console.log('\n📋 Update Voter Ring\n');
        console.log('='.repeat(70));

        // Load deployment config
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('Deployment config not found. Please deploy the contract first.');
        }
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const contractAddress = deployment.contractAddress;

        // Load certificate
        let resolvedCertPath = certPath;
        if (!path.isAbsolute(certPath)) {
            resolvedCertPath = path.resolve(process.cwd(), certPath);
        }

        if (!fs.existsSync(resolvedCertPath)) {
            throw new Error(`Certificate file not found: ${resolvedCertPath}`);
        }

        console.log(`\n📄 Loading certificate from: ${resolvedCertPath}`);
        const certificate = JSON.parse(fs.readFileSync(resolvedCertPath, 'utf8'));

        // Validate certificate format
        if (!certificate.voterName || !certificate.sid || !certificate.voterPublicKey || 
            !certificate.signature || !certificate.governmentPublicKey) {
            throw new Error('Invalid certificate format. Required fields: voterName, sid, voterPublicKey, signature, governmentPublicKey');
        }

        console.log(`\n✓ Certificate loaded`);
        console.log(`  Voter: ${certificate.voterName}`);
        console.log(`  SID: ${certificate.sid}`);
        console.log(`  Public Key: ${certificate.voterPublicKey.substring(0, 20)}...`);

        // Connect to contract
        const [signer] = await ethers.getSigners();
        const contract = await ethers.getContractAt('EVoting', contractAddress, signer);
        
        console.log(`\n📡 Connected to contract: ${contractAddress}`);
        console.log(`👤 Using signer: ${signer.address}`);

        // Get current ring size
        const ringSize = await contract.getRingSize();
        console.log(`\n📊 Current ring size: ${ringSize.toString()}`);

        // Prepare certificate for contract (convert to contract format)
        const certForContract = {
            sigma_tilde_v: certificate.signature,
            P_ugov: certificate.governmentPublicKey,
            P_uv: certificate.voterPublicKey,
            voterName: certificate.voterName,
            sid: certificate.sid
        };

        // Submit certificate to contract (storePub)
        console.log(`\n📤 Submitting certificate to contract...`);
        const tx = await contract.storePub(certForContract);
        console.log(`  Transaction hash: ${tx.hash}`);
        
        console.log(`  Waiting for confirmation...`);
        const receipt = await tx.wait();
        console.log(`  ✅ Transaction confirmed!`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

        // Get updated ring
        const newRingSize = await contract.getRingSize();
        console.log(`\n📊 Updated ring size: ${newRingSize.toString()}`);

        // Get the complete voter ring
        const voterRing = await contract.getVoterRing();
        
        console.log(`\n🔐 Updated Voter Ring:`);
        console.log('='.repeat(70));
        voterRing.forEach((pubKeyHash, index) => {
            console.log(`  [${index}] ${pubKeyHash}`);
        });

        console.log('\n' + '='.repeat(70));
        console.log(`✅ Voter added to ring successfully!`);
        console.log(`   Voter: ${certificate.voterName} (${certificate.sid})`);
        console.log(`   Position in ring: ${(newRingSize - 1n).toString()}`);
        console.log('='.repeat(70) + '\n');

        return {
            success: true,
            voterName: certificate.voterName,
            sid: certificate.sid,
            ringPosition: (newRingSize - 1n).toString(),
            ringSize: newRingSize.toString(),
            voterRing: voterRing,
            transactionHash: tx.hash
        };

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\nUsage: node update_voter_ring.js <certificate_path>');
        console.log('\nExample:');
        console.log('  node update_voter_ring.js ../pre_registration/CERT_12342330.json');
        console.log('  node update_voter_ring.js /absolute/path/to/CERT_12342330.json\n');
        process.exit(1);
    }

    const certPath = args[0];
    
    updateVoterRing(certPath)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\nFatal error:', error);
            process.exit(1);
        });
}

module.exports = updateVoterRing;
