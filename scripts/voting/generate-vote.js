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

// List of candidates
const CANDIDATES = ['A', 'B', 'C', 'D', 'E'];

async function generateVote(newPrivateKey, candidateChoice, kv) {
    try {
        console.log('\n🗳️  Generate Vote\n');
        console.log('='.repeat(70));

        // Validate inputs
        if (!newPrivateKey || !candidateChoice || kv === undefined) {
            throw new Error('Missing required parameters: newPrivateKey, candidateChoice, kv');
        }

        if (!CANDIDATES.includes(candidateChoice.toUpperCase())) {
            throw new Error(`Invalid candidate choice. Valid candidates: ${CANDIDATES.join(', ')}`);
        }

        console.log(`\n✓ Input parameters validated`);
        console.log(`  Candidate choice: ${candidateChoice.toUpperCase()}`);
        console.log(`  Registration index (k_v): ${kv}`);
        console.log(`  New private key: ${newPrivateKey.substring(0, 20)}...`);

        // Step 1: Candidate choice
        const c = candidateChoice.toUpperCase();
        console.log(`\n✓ Candidate selected: ${c}`);

        // Step 2: Generate random number r (32 bytes)
        const r = crypto.randomBytes(32);
        const rHex = '0x' + r.toString('hex');
        console.log(`\n✓ Generated random number r`);
        console.log(`  r: ${rHex.substring(0, 20)}...`);

        // Step 3: Calculate h_v = hash(c || r)
        const messageToHash = Buffer.concat([Buffer.from(c, 'utf8'), r]);
        const h_v = crypto.createHash('sha256').update(messageToHash).digest();
        const h_vHex = '0x' + h_v.toString('hex');
        console.log(`\n✓ Generated hash h_v = SHA256(c || r)`);
        console.log(`  h_v: ${h_vHex}`);

        // Step 4: Sign h_v with new private key using PKS (Ethereum signing)
        const privateKeyHex = newPrivateKey.startsWith('0x') ? newPrivateKey : '0x' + newPrivateKey;
        
        // Use CryptoUtils for consistent PKS signing
        const signatureBuffer = CryptoUtils.signMessageHash(h_v, privateKeyHex);
        
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
        .then((voteData) => {
            // Save vote data to file
            const fileName = `vote_${Date.now()}.json`;
            const filePath = path.join(__dirname, '../config', fileName);
            fs.writeFileSync(filePath, JSON.stringify(voteData, null, 2));
            console.log(`\n📁 Vote saved to: ${filePath}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\nFatal error:', error.message);
            process.exit(1);
        });
}

module.exports = generateVote;
