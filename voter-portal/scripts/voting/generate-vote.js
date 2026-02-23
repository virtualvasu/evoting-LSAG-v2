require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const CryptoUtils = require('../utils/crypto-utils');

/**
 * Generate vote for voter
 * 
 * Steps:
 * 1. Get candidate choice (c)
 * 2. Generate random number r
 * 3. Calculate h_v = hash(c || r)
 * 4. Calculate sigma_v_prime = PKS.sign(h_v, new_private_key)
 * 5. Return sigma_v_prime, h_v, k_v
 */

// List of candidates (can be updated based on current election)
const CANDIDATES = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];

async function generateVote(newPrivateKey, candidateChoice, kv) {
    try {
        console.log('\n🗳️  Generate Vote\n');
        console.log('='.repeat(70));

        // Validate inputs
        if (!newPrivateKey || !candidateChoice || kv === undefined) {
            throw new Error('Missing required parameters: newPrivateKey, candidateChoice, kv');
        }

        if (!CANDIDATES.map(c => c.toLowerCase()).includes(candidateChoice.toLowerCase())) {
            throw new Error(`Invalid candidate choice. Valid candidates: ${CANDIDATES.join(', ')}`);
        }

        console.log(`\n✓ Input parameters validated`);
        console.log(`  Candidate choice: ${candidateChoice}`);
        console.log(`  Registration index (k_v): ${kv}`);
        console.log(`  New private key: ${newPrivateKey.substring(0, 20)}...`);

        // Step 1: Candidate choice (normalize to proper case)
        const c = CANDIDATES.find(candidate => 
            candidate.toLowerCase() === candidateChoice.toLowerCase()
        ) || candidateChoice;
        console.log(`\n✓ Candidate selected: ${c}`);

        // Step 2: Generate random number r (32 bytes)
        const r = crypto.randomBytes(32);
        const rHex = '0x' + r.toString('hex');
        console.log(`\n✓ Generated random number r`);
        console.log(`  r: ${rHex.substring(0, 20)}...`);

        // Step 3: Calculate h_v = keccak256(c || r)
        // Use full candidate string (must match contract's abi.encodePacked)
        const cBytes = ethers.toUtf8Bytes(c);
        const rBytes = ethers.getBytes(rHex);
        const messageToHash = ethers.concat([cBytes, rBytes]);
        const h_vHex = ethers.keccak256(messageToHash);
        console.log(`\n✓ Generated hash h_v = keccak256(c || r)`);
        console.log(`  h_v: ${h_vHex}`);

        // Step 4: Sign h_v with new private key using PKS (Ethereum signing)
        const privateKeyHex = newPrivateKey.startsWith('0x') ? newPrivateKey : '0x' + newPrivateKey;
        
        // Convert hash string to bytes for signing
        const h_vBytes = ethers.getBytes(h_vHex);
        const signatureBuffer = CryptoUtils.signMessageHash(h_vBytes, privateKeyHex);
        
        const sigma_v_prime = {
            r: '0x' + signatureBuffer.slice(0, 32).toString('hex'),
            s: '0x' + signatureBuffer.slice(32, 64).toString('hex'),
            v: signatureBuffer[64]
        };

        console.log(`\n✓ Generated PKS signature sigma_v_prime`);
        console.log(`  r: ${sigma_v_prime.r.substring(0, 20)}...`);
        console.log(`  s: ${sigma_v_prime.s.substring(0, 20)}...`);

        // Step 5: Prepare output
        const voteData = {
            kv: kv,
            candidateChoice: c,
            r: rHex,
            h_v: h_vHex,
            sigma_v_prime: sigma_v_prime,
            timestamp: new Date().toISOString()
        };

        console.log(`\n${'='.repeat(70)}`);
        console.log('✅ Vote generated successfully!\n');
        console.log('Vote Data:');
        console.log(JSON.stringify(voteData, null, 2));

        return voteData;

    } catch (error) {
        console.error('\n❌ Error generating vote:', error.message);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    // Support environment variables
    let newPrivateKey = process.env.NEW_PRIVATE_KEY;
    let candidateChoice = process.env.CANDIDATE_CHOICE;
    let kv = process.env.KV;

    // Or command line arguments
    if (args.length >= 3) {
        newPrivateKey = args[0];
        candidateChoice = args[1];
        kv = parseInt(args[2]);
    }

    if (!newPrivateKey || !candidateChoice || kv === undefined) {
        console.log('\n❌ Missing required parameters!\n');
        console.log('Available candidates: ' + CANDIDATES.join(', '));
        console.log('\nUsage (environment variables):');
        console.log('  NEW_PRIVATE_KEY=0x... CANDIDATE_CHOICE=A KV=0 node generate-vote.js\n');
        console.log('Usage (command line):');
        console.log('  node generate-vote.js <new_private_key> <candidate_choice> <kv>\n');
        console.log('Example:');
        console.log('  NEW_PRIVATE_KEY=0x219b0a0ca69114e5e070494561742870aa70a3a15e5ac6b97b8f2b86e5113b61 \\');
        console.log('  CANDIDATE_CHOICE=A \\');
        console.log('  KV=0 \\');
        console.log('  node generate-vote.js\n');
        process.exit(1);
    }

    generateVote(newPrivateKey, candidateChoice, parseInt(kv))
        .then(async (voteData) => {
            // Save vote data to file
            const fileName = `vote_${Date.now()}.json`;
            const filePath = path.join(__dirname, '../config', fileName);
            fs.writeFileSync(filePath, JSON.stringify(voteData, null, 2));
            console.log(`\n📁 Vote saved to: ${filePath}`);

            // Cast vote on-chain
            console.log(`\n${'='.repeat(70)}`);
            console.log('📡 Casting vote on-chain...');
            
            try {
                // Load deployment config
                const deploymentPath = path.join(__dirname, '../config/deployment.json');
                const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
                
                // Connect to contract
                const provider = new ethers.JsonRpcProvider('http://10.10.0.61:8550');
                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                const contract = new ethers.Contract(
                    deployment.contractAddress,
                    require(path.join(__dirname, '../../artifacts/contracts/Evoting.sol/EVoting.json')).abi,
                    wallet
                );

                // Call BBvoting function
                const tx = await contract.BBvoting(
                    voteData.kv,
                    voteData.h_v,
                    voteData.sigma_v_prime.r,
                    voteData.sigma_v_prime.s,
                    voteData.sigma_v_prime.v
                );

                console.log(`  Transaction hash: ${tx.hash}`);
                console.log(`  Waiting for confirmation...`);
                
                const receipt = await tx.wait();
                console.log(`  ✅ Vote cast successfully!`);
                console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
                console.log(`${'='.repeat(70)}\n`);
                
                process.exit(0);
            } catch (error) {
                console.error('\n❌ Error casting vote on-chain:', error.message);
                console.log('\nVote was generated and saved, but on-chain transaction failed.');
                console.log(`File: ${filePath}`);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\nFatal error:', error.message);
            process.exit(1);
        });
}

module.exports = generateVote;
