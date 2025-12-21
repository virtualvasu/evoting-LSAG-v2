#!/usr/bin/env node

const ethers = require('ethers');
const CryptoUtils = require('./utils/crypto-utils');
const fs = require('fs');

async function testCertificate() {
    try {
        console.log('🧪 Testing Certificate Format\n');

        // Load government config
        const govConfig = JSON.parse(fs.readFileSync('./scripts/config/government-config.json', 'utf8'));
        
        // Generate a voter key pair
        const voterKeys = CryptoUtils.generateKeyPair();
        const voterPublicKey = voterKeys.publicKey;
        
        console.log('Voter Public Key type:', typeof voterPublicKey);
        console.log('Voter Public Key length:', voterPublicKey.length);

        // Create certificate
        const govPrivateKeyBuffer = CryptoUtils.hexToBuffer(govConfig.privateKey);
        const govPublicKeyBuffer = CryptoUtils.hexToBuffer(govConfig.publicKey);
        
        const certificate = CryptoUtils.createCertificate(
            voterPublicKey,
            govPrivateKeyBuffer,
            govPublicKeyBuffer
        );

        console.log('\nCertificate types:');
        console.log('sigma_tilde_v type:', typeof certificate.sigma_tilde_v, 'constructor:', certificate.sigma_tilde_v?.constructor?.name);
        console.log('sigma_tilde_v length:', certificate.sigma_tilde_v?.length);
        console.log('P_ugov type:', typeof certificate.P_ugov, 'constructor:', certificate.P_ugov?.constructor?.name);
        console.log('P_ugov length:', certificate.P_ugov?.length);
        console.log('P_uv type:', typeof certificate.P_uv, 'constructor:', certificate.P_uv?.constructor?.name);
        console.log('P_uv length:', certificate.P_uv?.length);

        // Convert to hex
        const sigHex = ethers.hexlify(certificate.sigma_tilde_v);
        const govHex = ethers.hexlify(certificate.P_ugov);
        const voterHex = ethers.hexlify(certificate.P_uv);

        console.log('\nConverted to hex:');
        console.log('sigma_tilde_v:', sigHex.substring(0, 20));
        console.log('P_ugov:', govHex.substring(0, 20));
        console.log('P_uv:', voterHex.substring(0, 20));

        // Verify bytes
        const sigBytes = ethers.getBytes(sigHex);
        const govBytes = ethers.getBytes(govHex);
        const voterBytes = ethers.getBytes(voterHex);

        console.log('\nByte lengths after conversion:');
        console.log('sigma_tilde_v:', sigBytes.length, '(expected 65)');
        console.log('P_ugov:', govBytes.length, '(expected 64)');
        console.log('P_uv:', voterBytes.length, '(expected 64)');

        if (sigBytes.length === 65 && govBytes.length === 64 && voterBytes.length === 64) {
            console.log('\n✅ All formats correct!');
        } else {
            console.log('\n❌ Format mismatch!');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testCertificate();
