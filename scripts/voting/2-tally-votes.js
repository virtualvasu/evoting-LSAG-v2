/**
 * PHASE 2: Tally Votes
 * 
 * This script tallies all cast votes by revealing the candidate and randomness.
 * The contract verifies that H(candidate || randomness) matches the stored vote hash.
 * 
 * Usage:
 *   node scripts/voting/2-tally-votes.js
 * 
 * This will tally ALL votes that have been cast.
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Load configuration
const deploymentConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/deployment.json'), 'utf8')
);

const CONTRACT_ADDRESS = deploymentConfig.contractAddress;

async function tallyVotes() {
    console.log('\n📊 TALLY VOTES - Phase 2\n');
    console.log('='.repeat(70));
    
    // Step 1: Load anonymous vote reveals
    console.log('\n📂 Step 1: Loading anonymous vote reveals...');
    const votesFile = path.join(__dirname, '../config/vote-reveals.json');
    
    if (!fs.existsSync(votesFile)) {
        throw new Error('❌ No vote reveals found. Cast votes first using 1-cast-vote.js');
    }
    
    const voteReveals = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
    
    // Shuffle votes to break temporal correlation
    const shuffledVotes = [...voteReveals].sort(() => Math.random() - 0.5);
    
    console.log(`✅ Found ${shuffledVotes.length} anonymous vote(s)`);
    console.log(`   (Votes shuffled to preserve anonymity)`);
    
    // Step 2: Connect to contract
    console.log('\n🔗 Step 2: Connecting to contract...');
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt('EVoting', CONTRACT_ADDRESS);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Signer: ${signer.address}`);
    
    // Step 3: Tally each vote
    console.log('\n📊 Step 3: Tallying votes anonymously...\n');
    
    const tallyResults = [];
    const candidateCounts = {};
    
    for (let i = 0; i < shuffledVotes.length; i++) {
        const voteData = shuffledVotes[i];
        
        console.log(`\n   Processing vote ${i + 1}/${shuffledVotes.length}...`);
        
        try {
            // Prepare tally data
            const candidateBytes = ethers.toUtf8Bytes(voteData.candidate);
            const c = ethers.hexlify(candidateBytes);
            const r = voteData.randomness;
            // Use publicKey as k_v to identify which vote on blockchain
            const k_v = voteData.publicKey;
            
            // Submit tally transaction
            const tx = await contract.connect(signer).tally(c, r, k_v);
            console.log(`   Transaction: ${tx.hash}`);
            console.log(`   ⏳ Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            console.log(`   ✅ Tallied successfully!`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
            
            tallyResults.push({
                status: 'SUCCESS',
                candidate: voteData.candidate,
                transactionHash: tx.hash,
                gasUsed: receipt.gasUsed.toString()
            });
            
            // Count votes per candidate
            candidateCounts[voteData.candidate] = (candidateCounts[voteData.candidate] || 0) + 1;
            
        } catch (error) {
            console.error(`   ❌ Failed to tally: ${error.message}`);
            tallyResults.push({
                status: 'FAILED',
                error: error.message
            });
        }
    }
    
    // Step 4: Display final results
    console.log('\n' + '='.repeat(70));
    console.log('\n🏆 FINAL VOTING RESULTS\n');
    console.log('='.repeat(70));
    
    // Sort candidates by vote count
    const sortedCandidates = Object.entries(candidateCounts)
        .sort((a, b) => b[1] - a[1]);
    
    const totalVotes = sortedCandidates.reduce((sum, [_, count]) => sum + count, 0);
    
    console.log(`\nTotal Votes Cast: ${totalVotes}\n`);
    
    sortedCandidates.forEach(([candidate, count], index) => {
        const percentage = ((count / totalVotes) * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count * 20 / totalVotes));
        const position = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        
        console.log(`${position} ${candidate}`);
        console.log(`   Votes: ${count} (${percentage}%)`);
        console.log(`   ${bar}\n`);
    });
    
    if (sortedCandidates.length > 0) {
        const [winner, winnerVotes] = sortedCandidates[0];
        console.log('='.repeat(70));
        console.log(`\n🎊 WINNER: ${winner} with ${winnerVotes} vote(s)! 🎊\n`);
    }
    
    // Step 5: Save tally results
    console.log('💾 Saving tally results...');
    const tallyFile = path.join(__dirname, '../config/tally-results.json');
    const finalResults = {
        totalVotes,
        candidateCounts,
        winner: sortedCandidates[0] ? sortedCandidates[0][0] : null,
        detailedResults: tallyResults,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(tallyFile, JSON.stringify(finalResults, null, 2));
    console.log(`✅ Results saved to tally-results.json\n`);
    
    return finalResults;
}

// Main execution
if (require.main === module) {
    tallyVotes()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { tallyVotes };
