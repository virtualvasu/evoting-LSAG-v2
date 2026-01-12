const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

/**
 * Submit LSAG signature for BB.verify registration
 * 
 * This script:
 * 1. Loads the voter's LSAG signature from file
 * 2. Calls BBverify function on the contract
 * 3. Returns the registration index kv
 * 
 * @param {string} lsagFilePath - Path to LSAG signature JSON file
 */
async function submitLSAGRegistration(lsagFilePath) {
    try {
        console.log('\n📝 Submit LSAG Registration (BB.verify)\n');
        console.log('='.repeat(70));

        // Load LSAG signature file
        console.log(`\n📂 Loading LSAG signature from: ${lsagFilePath}`);
        if (!fs.existsSync(lsagFilePath)) {
            throw new Error(`LSAG file not found: ${lsagFilePath}`);
        }

        const lsagData = JSON.parse(fs.readFileSync(lsagFilePath, 'utf8'));
        console.log(`  ✓ Loaded signature for voter: ${lsagData.voterName} (${lsagData.sid})`);

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
        console.log(`  Signer: ${signer.address}`);

        // Parse LSAG signature from file
        // The new format already has keyImageX and keyImageY
        const keyImageX = lsagData.lsagSignature.keyImageX;
        const keyImageY = lsagData.lsagSignature.keyImageY;
        const c = lsagData.lsagSignature.c;
        const s = lsagData.lsagSignature.s;
        
        console.log(`\n🔑 Key Image:`);
        console.log(`  X: ${keyImageX}`);
        console.log(`  Y: ${keyImageY}`);

        // Parse election ID to uint256
        const electionId = lsagData.electionIdHash || ethers.keccak256(ethers.toUtf8Bytes(lsagData.electionId));
        
        console.log(`\n📋 LSAG Signature Parameters:`);
        console.log(`  Election ID: ${lsagData.electionId}`);
        console.log(`  Election ID (hash): ${electionId}`);
        console.log(`  Challenge c: ${c}`);
        console.log(`  Responses s: ${s.length} values`);

        // Prepare LSAG signature struct
        const lsagSignature = {
            keyImageX: keyImageX,
            keyImageY: keyImageY,
            c: c,
            s: s
        };

        // Prepare voter's new public key
        const newPublicKey = lsagData.newPublicKey.startsWith('0x') 
            ? lsagData.newPublicKey 
            : '0x' + lsagData.newPublicKey;

        console.log(`\n🆕 New Public Key: ${newPublicKey.substring(0, 20)}...`);

        // Call BBverify function
        console.log(`\n🔐 Calling BBverify function...`);
        console.log(`  This will:`);
        console.log(`  1. Verify LSAG signature`);
        console.log(`  2. Check for double registration`);
        console.log(`  3. Add to registration table`);

        // Try to estimate gas first
        console.log(`\n⛽ Estimating gas...`);
        try {
            const estimatedGas = await contract.BBverify.estimateGas(electionId, lsagSignature, newPublicKey);
            console.log(`  Estimated gas: ${estimatedGas.toString()}`);
        } catch (error) {
            console.log(`  ⚠️  Gas estimation failed: ${error.message}`);
            console.log(`  This usually means the transaction would revert.`);
            console.log(`  Attempting to call with high gas limit anyway...`);
        }

        const tx = await contract.BBverify(electionId, lsagSignature, newPublicKey, {
            gasLimit: 30000000 // Max gas limit for private chain
        });

        console.log(`\n⏳ Transaction submitted: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);

        const receipt = await tx.wait();

        console.log(`\n✅ Transaction confirmed!`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

        // Parse events to get kv
        let kv = null;
        for (const log of receipt.logs) {
            try {
                const parsedLog = contract.interface.parseLog(log);
                if (parsedLog && parsedLog.name === 'RegistrationSuccess') {
                    kv = parsedLog.args.kv.toString();
                    console.log(`\n🎉 Registration Successful!`);
                    console.log(`  Registration Index (kv): ${kv}`);
                    console.log(`  Voter Public Key: ${parsedLog.args.publicKey.substring(0, 20)}...`);
                }
            } catch (e) {
                // Skip logs we can't parse
            }
        }

        if (kv === null) {
            // Try to get registration table size
            const tableSize = await contract.getRegistrationTableSize();
            kv = (tableSize - 1n).toString();
            console.log(`\n📊 Registration Index (kv): ${kv}`);
        }

        // Save registration result
        const result = {
            voterName: lsagData.voterName,
            sid: lsagData.sid,
            electionId: lsagData.electionId,
            registrationIndex: kv,
            newPublicKey: newPublicKey,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            timestamp: new Date().toISOString()
        };

        const outputDir = path.join(__dirname, '../config');
        const outputPath = path.join(outputDir, `registration_result_${lsagData.sid}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        console.log(`\n💾 Registration result saved to: ${outputPath}`);

        console.log('\n' + '='.repeat(70));
        console.log(`✅ BB.verify Registration Complete!`);
        console.log(`   Voter: ${lsagData.voterName} (${lsagData.sid})`);
        console.log(`   Registration Index (kv): ${kv}`);
        console.log(`   New Public Key: ${newPublicKey.substring(0, 20)}...`);
        console.log('='.repeat(70) + '\n');

        return {
            kv: kv,
            transactionHash: receipt.hash,
            ...result
        };

    } catch (error) {
        console.error('\n❌ Error submitting LSAG registration:', error.message);
        if (error.reason) {
            console.error(`  Reason: ${error.reason}`);
        }
        if (error.data) {
            console.error(`  Error data: ${error.data}`);
        }
        throw error;
    }
}

/**
 * Decompress a compressed secp256k1 public key
 * @param {Buffer} compressedKey - Compressed public key (33 bytes)
 * @returns {Object} {x, y} coordinates as BigInt
 */
function decompressPublicKey(compressedKey) {
    const secp256k1 = require('@noble/secp256k1');
    
    // Use noble-secp256k1 to decompress
    const uncompressed = secp256k1.Point.fromHex(compressedKey).toRawBytes(false);
    
    // Extract x and y (skip first byte which is 0x04)
    const x = BigInt('0x' + Buffer.from(uncompressed.slice(1, 33)).toString('hex'));
    const y = BigInt('0x' + Buffer.from(uncompressed.slice(33, 65)).toString('hex'));
    
    return { x, y };
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    let lsagFilePath;
    
    if (args.length >= 1) {
        // Command line argument: <lsag_file_path>
        lsagFilePath = args[0];
    } else if (process.env.LSAG_FILE) {
        // Environment variable
        lsagFilePath = process.env.LSAG_FILE;
    } else {
        console.log('\n❌ Missing required parameter!\n');
        console.log('Usage (command line):');
        console.log('  npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost <lsag_file_path>\n');
        console.log('Usage (environment variables):');
        console.log('  LSAG_FILE=../pre_registration/LSAG_12342330.json \\');
        console.log('  npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost\n');
        console.log('Example:');
        console.log('  npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost \\');
        console.log('    scripts/pre_registration/LSAG_12342330.json\n');
        process.exit(1);
    }

    // Resolve relative path
    if (!path.isAbsolute(lsagFilePath)) {
        lsagFilePath = path.join(process.cwd(), lsagFilePath);
    }

    submitLSAGRegistration(lsagFilePath)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\nFatal error:', error);
            process.exit(1);
        });
}

module.exports = submitLSAGRegistration;
