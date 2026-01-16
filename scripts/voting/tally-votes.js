require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

/**
 * Tally votes by calling BB.tally on contract
 * 
 * Takes vote file and extracts:
 * - k_v (registration index)
 * - c (candidate choice)
 * - r (random number)
 * 
 * Then calls contract.BBtally(k, c, r) and displays results
 */

async function tallyVotes(voteFilePath) {
    try {
        console.log('\n📊 Tallying Votes\n');
        console.log('='.repeat(70));

        // Load vote file
        if (!fs.existsSync(voteFilePath)) {
            throw new Error(`Vote file not found: ${voteFilePath}`);
        }

        const voteData = JSON.parse(fs.readFileSync(voteFilePath, 'utf8'));
        console.log(`\n📂 Loaded vote file`);
        console.log(`  Voter: k_v = ${voteData.kv}`);
        console.log(`  Candidate: ${voteData.candidateChoice}`);
        console.log(`  Random: ${voteData.r.substring(0, 20)}...`);

        // Load deployment config
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

        // Connect to contract
        const provider = new ethers.JsonRpcProvider('http://localhost:8545');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contract = new ethers.Contract(
            deployment.contractAddress,
            require(path.join(__dirname, '../../artifacts/contracts/Evoting.sol/EVoting.json')).abi,
            wallet
        );

        console.log(`\n📡 Connected to contract: ${deployment.contractAddress}`);

        // Call BBtally function
        console.log(`\n📊 Tallying vote...`);
        
        // Convert candidate character to bytes1
        const candidateByte = ethers.toBeHex(voteData.candidateChoice.charCodeAt(0), 1);
        
        // Verify hash locally first for debugging
        const rBytes = ethers.getBytes(voteData.r);
        const messageToHash = ethers.concat([candidateByte, rBytes]);
        const localHash = ethers.keccak256(messageToHash);
        console.log(`  Local hash (c||r): ${localHash}`);
        console.log(`  Stored vote hash: ${voteData.h_v}`);
        
        if (localHash !== voteData.h_v) {
            console.error('  ⚠️  Hash mismatch! Vote may have been cast with different parameters.');
        }
        
        const tx = await contract.BBtally(
            voteData.kv,
            candidateByte,
            rBytes
        );

        console.log(`  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        console.log(`  ✅ Vote tallied successfully!`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

        // Get all results
        console.log(`\n📈 Getting election results...`);
        const results = await contract.getAllResults();

        console.log(`\n${'='.repeat(70)}`);
        console.log('Election Results:');
        console.log('='.repeat(70));
        
        const candidates = ['A', 'B', 'C', 'D', 'E'];
        let totalVotes = 0;
        
        candidates.forEach((candidate, index) => {
            const count = results[index].toString();
            totalVotes += parseInt(count);
            console.log(`  Candidate ${candidate}: ${count} votes`);
        });

        console.log(`${'='.repeat(70)}`);
        console.log(`  Total votes counted: ${totalVotes}`);
        console.log('='.repeat(70) + '\n');

        return results;

    } catch (error) {
        console.error('\n❌ Error tallying votes:', error.message);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    let voteFilePath = args[0] || process.env.VOTE_FILE;

    if (!voteFilePath) {
        console.log('\n❌ Missing vote file path!\n');
        console.log('Usage (command line):');
        console.log('  node tally-votes.js <vote_file_path>\n');
        console.log('Usage (environment variable):');
        console.log('  VOTE_FILE=path/to/vote.json node tally-votes.js\n');
        console.log('Example:');
        console.log('  node tally-votes.js scripts/config/vote_1768316790719.json\n');
        process.exit(1);
    }

    tallyVotes(voteFilePath)
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('\nFatal error:', error.message);
            process.exit(1);
        });
}

module.exports = tallyVotes;
