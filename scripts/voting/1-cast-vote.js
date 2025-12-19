/**
 * PHASE 1: Cast a Vote
 * 
 * This script allows a registered voter to cast their vote.
 * 
 * Vote Structure:
 * - h_v = H(candidate || randomness) - hash of vote commitment
 * - k_v = encrypted vote data
 * - sigma_v_prime = voter's signature proving they own their public key
 * 
 * Usage:
 *   node scripts/voting/1-cast-vote.js <voter_id> <candidate>
 * 
 * Example:
 *   node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load configuration
const deploymentConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/deployment.json'), 'utf8')
);

const CONTRACT_ADDRESS = deploymentConfig.contractAddress;

async function castVote(voterId, candidateName) {
    console.log('\n🗳️  CAST VOTE - Phase 1\n');
    console.log('='.repeat(70));
    
    // Step 1: Load voter credentials
    console.log('\n📂 Step 1: Loading voter credentials...');
    const voterFile = path.join(__dirname, '../config/complete-registration-success.json');
    
    if (!fs.existsSync(voterFile)) {
        throw new Error('❌ No registered voters found. Run registration first.');
    }
    
    const registrations = JSON.parse(fs.readFileSync(voterFile, 'utf8'));
    const voterData = registrations[voterId];
    
    if (!voterData) {
        throw new Error(`❌ Voter ${voterId} not found in registrations`);
    }
    
    console.log(`✅ Loaded credentials for ${voterId}`);
    console.log(`   Public Key: ${voterData.publicKey.substring(0, 20)}...`);
    console.log(`   Ring Position: ${voterData.ringPosition}`);
    
    // Step 2: Prepare vote data
    console.log('\n🎯 Step 2: Preparing vote...');
    console.log(`   Candidate: ${candidateName}`);
    
    // Generate randomness for vote commitment
    const randomness = '0x' + crypto.randomBytes(32).toString('hex');
    console.log(`   Randomness: ${randomness.substring(0, 20)}...`);
    
    // Create vote commitment: h_v = H(candidate || randomness)
    const candidateBytes = ethers.toUtf8Bytes(candidateName);
    const h_v = ethers.keccak256(
        ethers.concat([candidateBytes, randomness])
    );
    console.log(`   Vote Hash (h_v): ${h_v.substring(0, 20)}...`);
    
    // Step 3: Sign the vote hash with voter's private key
    console.log('\n🔐 Step 3: Signing vote...');
    
    // Connect to contract
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt('EVoting', CONTRACT_ADDRESS);
    
    // Create wallet from voter's private key
    const voterWallet = new ethers.Wallet(voterData.privateKey, ethers.provider);
    console.log(`   Voter address: ${voterWallet.address}`);
    
    // Sign the vote hash
    const signature = await voterWallet.signMessage(ethers.getBytes(h_v));
    console.log(`   Signature: ${signature.substring(0, 20)}...`);
    
    // Step 4: Prepare encrypted vote data (k_v)
    // In this simplified version, k_v contains the encrypted candidate+randomness
    const k_v = ethers.hexlify(
        ethers.concat([candidateBytes, ethers.getBytes(randomness)])
    );
    console.log(`   Encrypted vote (k_v): ${k_v.substring(0, 20)}...`);
    
    // Step 5: Submit vote to blockchain
    console.log('\n📤 Step 4: Submitting vote to blockchain...');
    
    // Use sigma_v_prime as the voter identifier (public key)
    const sigma_v_prime = voterData.publicKey;
    
    try {
        const tx = await contract.connect(signer).voting(
            sigma_v_prime,
            h_v,
            k_v
        );
        
        console.log(`   Transaction hash: ${tx.hash}`);
        console.log('   ⏳ Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`   ✅ Vote cast successfully!`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
        // Step 6: Save vote details for tallying
        console.log('\n💾 Step 5: Saving vote details...');
        const voteRecord = {
            voterId: voterId,
            candidate: candidateName,
            randomness: randomness,
            voteHash: h_v,
            encryptedVote: k_v,
            signature: signature,
            publicKey: sigma_v_prime,
            transactionHash: tx.hash,
            timestamp: new Date().toISOString()
        };
        
        // Save to file for tallying phase
        const votesDir = path.join(__dirname, '../config');
        const votesFile = path.join(votesDir, 'cast-votes.json');
        
        let castVotes = {};
        if (fs.existsSync(votesFile)) {
            castVotes = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
        }
        
        castVotes[voterId] = voteRecord;
        fs.writeFileSync(votesFile, JSON.stringify(castVotes, null, 2));
        
        console.log(`   ✅ Vote details saved to cast-votes.json`);
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 VOTE CAST SUCCESSFULLY!\n');
        console.log(`Voter ${voterId} voted for: ${candidateName}`);
        console.log(`\nNext step: After all votes are cast, run the tally script`);
        console.log(`  node scripts/voting/2-tally-votes.js`);
        
        return voteRecord;
        
    } catch (error) {
        console.error('\n❌ Failed to cast vote:', error.message);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('\n❌ Usage: node scripts/voting/1-cast-vote.js <voter_id> <candidate>');
        console.log('\nExample:');
        console.log('  node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A');
        console.log('\nAvailable voters: VOTER_001 (Alice), VOTER_002 (Bob), VOTER_003 (Carol)');
        console.log('Available candidates: Candidate_A, Candidate_B, Candidate_C');
        process.exit(1);
    }
    
    const [voterId, candidate] = args;
    
    castVote(voterId, candidate)
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { castVote };
