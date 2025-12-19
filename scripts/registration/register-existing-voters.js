/**
 * Register existing Alice, Bob, Carol on new contract
 * Uses government account to pay for gas
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const VOTERS_FILE = path.join(__dirname, '../config/complete-registration-success.json');
const DEPLOYMENT_FILE = path.join(__dirname, '../config/deployment.json');
const GOV_CONFIG_FILE = path.join(__dirname, '../config/government-config.json');

async function registerExistingVoters() {
    console.log('\n📝 REGISTERING EXISTING VOTERS\n');
    console.log('='.repeat(70));
    
    // Load files
    const voters = JSON.parse(fs.readFileSync(VOTERS_FILE, 'utf8'));
    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const govConfig = JSON.parse(fs.readFileSync(GOV_CONFIG_FILE, 'utf8'));
    
    // Connect to contract with government signer
    const [govSigner] = await ethers.getSigners();
    const contract = await ethers.getContractAt('EVoting', deployment.contractAddress, govSigner);
    
    console.log(`\n📋 Contract: ${deployment.contractAddress}`);
    console.log(`👤 Government: ${govSigner.address}\n`);
    
    // Register each voter
    for (const [voterId, voterData] of Object.entries(voters)) {
        console.log(`\nRegistering ${voterId} (${voterData.name})...`);
        console.log(`  Public Key: ${voterData.publicKey.substring(0, 20)}...`);
        
        try {
            // Create certificate
            // Sign the voter's public key with government's private key
            const messageHash = ethers.keccak256(voterData.publicKey);
            const signature = await govSigner.signMessage(ethers.getBytes(messageHash));
            
            const certificate = {
                sigma_tilde_v: signature,
                P_ugov: govConfig.publicKey,
                P_uv: voterData.publicKey
            };
            
            // Submit certificate
            const tx = await contract.storePub(certificate);
            
            console.log(`  Transaction: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  ✅ Registered! Gas used: ${receipt.gasUsed.toString()}`);
            
        } catch (error) {
            console.error(`  ❌ Failed: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ REGISTRATION COMPLETE!\n');
    console.log('Next step: Cast votes');
    console.log('  node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A\n');
}

registerExistingVoters()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    });
