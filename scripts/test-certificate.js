#!/usr/bin/env node

const ethers = require('ethers');
const CryptoUtils = require('./utils/crypto-utils');
const BlockchainInterface = require('./utils/blockchain-interface');
const fs = require('fs');

async function testCertificate() {
    try {
        console.log('🧪 Testing Certificate Generation and Verification\n');

        // Load government config
        const govConfig = JSON.parse(fs.readFileSync('./scripts/config/government-config.json', 'utf8'));
        
        // Generate a voter key pair
        const { privateKey: voterPrivateKey, publicKey: voterPublicKeyBuffer } = CryptoUtils.generateKeyPair();
        const voterPublicKey = voterPublicKeyBuffer; // This is 64 bytes
        
        console.log('✓ Generated voter key pair');
        console.log('  Voter Public Key length:', voterPublicKey.length, 'bytes');

        // Create certificate
        const govPrivateKeyBuffer = CryptoUtils.hexToBuffer(govConfig.privateKey);
        const govPublicKeyBuffer = CryptoUtils.hexToBuffer(govConfig.publicKey);
        
        console.log('✓ Government keys loaded');
        console.log('  Gov Public Key length:', govPublicKeyBuffer.length, 'bytes');

        const certificate = CryptoUtils.createCertificate(
            voterPublicKey,
            govPrivateKeyBuffer,
            govPublicKeyBuffer
        );

        console.log('✓ Certificate created');
        
        // Convert to hex strings for display and contract use
        const sigHex = Buffer.isBuffer(certificate.sigma_tilde_v) ? 
            '0x' + certificate.sigma_tilde_v.toString('hex') : certificate.sigma_tilde_v;
        const govHex = Buffer.isBuffer(certificate.P_ugov) ? 
            '0x' + certificate.P_ugov.toString('hex') : certificate.P_ugov;
        const voterHex = Buffer.isBuffer(certificate.P_uv) ? 
            '0x' + certificate.P_uv.toString('hex') : certificate.P_uv;
            
        const sigLen = Buffer.isBuffer(certificate.sigma_tilde_v) ? 
            certificate.sigma_tilde_v.length : (sigHex.length - 2) / 2;
        console.log('  sigma_tilde_v length:', sigLen, 'bytes');
        console.log('  sigma_tilde_v:', sigHex.substring(0, 20), '...');
        console.log('  P_ugov:', govHex.substring(0, 20), '...');
        console.log('  P_uv:', voterHex.substring(0, 20), '...');

        // Now let's verify this matches what the contract expects
        console.log('\n🔍 Checking certificate format for contract:\n');

        // Convert to bytes for verification
        const sigBytes = ethers.getBytes(sigHex);
        const govBytes = ethers.getBytes(govHex);
        const voterBytes = ethers.getBytes(voterHex);

        console.log('sigma_tilde_v bytes length:', sigBytes.length);
        console.log('P_ugov bytes length:', govBytes.length);
        console.log('P_uv bytes length:', voterBytes.length);

        if (sigBytes.length !== 65 || govBytes.length !== 64 || voterBytes.length !== 64) {
            throw new Error('❌ Certificate format mismatch!');
        }

        console.log('✅ Certificate format is correct for contract!');

        // Now verify the signature offline
        console.log('\n🔐 Verifying certificate signature offline:\n');

        const messageHash = ethers.keccak256(voterBytes);
        const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));
        
        console.log('Message hash:', messageHash.substring(0, 20), '...');
        console.log('ETH signed hash:', ethSignedHash.substring(0, 20), '...');

        // Recover signer address from signature
        const sig = ethers.Signature.from(sigBytes);
        const recovered = sig.recover(ethSignedHash);
        console.log('Recovered address:', recovered);

        // Derive government address the same way the contract does
        const govAddrContractWay = ethers.getAddress(
            '0x' + ethers.keccak256(govBytes).slice(-40)
        );
        console.log('Gov address (contract way):', govAddrContractWay);

        if (recovered.toLowerCase() === govAddrContractWay.toLowerCase()) {
            console.log('✅ Signature verification matches!');
        } else {
            console.log('❌ Signature verification FAILED!');
            console.log('  Expected:', govAddrContractWay);
            console.log('  Got:', recovered);
        }

        // Now test on-chain if we can connect
        console.log('\n📡 Attempting blockchain test:\n');

        try {
            const blockchain = new BlockchainInterface();
            await blockchain.initialize();

            // Try to call getRingSize to see current state
            const ringSize = await blockchain.getRingSize();
            console.log('Current ring size:', ringSize);

            // Try to submit the certificate
            console.log('\n📤 Submitting certificate to blockchain...');
            
            // Connect with a test wallet
            const wallet = new ethers.Wallet(
                '0xac0974bec39a17e36ba4a6b4d238ff944bacb476cbe1347c88f5fb6a3a4f4fea' // Hardhat test account 0
            );
            blockchain.connectWallet(wallet.privateKey);

            const certificateForContract = {
                sigma_tilde_v: sigHex,
                P_ugov: govHex,
                P_uv: voterHex
            };

            const receipt = await blockchain.storePub(certificateForContract);
            console.log('✅ Certificate submitted!');
            console.log('Transaction hash:', receipt.hash);
            console.log('Gas used:', receipt.gasUsed.toString());

            // Check ring size after
            const newRingSize = await blockchain.getRingSize();
            console.log('\n✓ Ring size after submission:', newRingSize);

            if (newRingSize > 0) {
                console.log('✅ Certificate was successfully stored and voter added to ring!');
            } else {
                console.log('❌ Ring is still empty - certificate verification failed on-chain!');
            }

        } catch (error) {
            if (error.message.includes('ECONNREFUSED')) {
                console.log('⚠️  Cannot connect to blockchain (node not running) - but certificate format is valid');
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

testCertificate();
