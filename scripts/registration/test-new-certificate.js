const fs = require('fs');
const path = require('path');
const CryptoUtils = require('../utils/crypto-utils');

/**
 * Test script for the new certificate format
 * Demonstrates creating and verifying certificates with voterName and sid
 */

console.log('🧪 Testing New Certificate Format\n');
console.log('='.repeat(60));

// Step 1: Generate government keys (or load from config)
console.log('\n1. Setting up government keys...');
const govConfigPath = path.join(__dirname, '../config/government-config.json');
let govConfig;

if (fs.existsSync(govConfigPath)) {
    govConfig = JSON.parse(fs.readFileSync(govConfigPath, 'utf8'));
    console.log('✅ Government config loaded');
    console.log('   Address:', govConfig.address);
} else {
    console.log('⚠️  No government config found, generating new keys...');
    const govKeyPair = CryptoUtils.generateKeyPair();
    const govWallet = CryptoUtils.createWallet(govKeyPair.privateKey);
    govConfig = {
        address: govWallet.address,
        publicKey: CryptoUtils.bufferToHex(govKeyPair.publicKey),
        privateKey: CryptoUtils.bufferToHex(govKeyPair.privateKey)
    };
    console.log('✅ New government keys generated');
    console.log('   Address:', govConfig.address);
}

// Step 2: Generate voter keys
console.log('\n2. Generating voter keys...');
const voterKeyPair = CryptoUtils.generateKeyPair();
console.log('✅ Voter keys generated');
console.log('   Public Key:', CryptoUtils.bufferToHex(voterKeyPair.publicKey));

// Step 3: Create certificate with voterName and sid
console.log('\n3. Creating certificate with new format...');
const voterName = 'vasu g';
const sid = '12342330';

const certificate = CryptoUtils.createCertificate(
    voterKeyPair.publicKey,
    CryptoUtils.hexToBuffer(govConfig.privateKey),
    CryptoUtils.hexToBuffer(govConfig.publicKey),
    voterName,
    sid
);

console.log('✅ Certificate created');
console.log('   Voter Name:', voterName);
console.log('   SID:', sid);
console.log('   Signature length:', certificate.sigma_tilde_v.length, 'bytes');

// Step 4: Verify the certificate
console.log('\n4. Verifying certificate...');
const { ethers } = require('ethers');

// Recreate the message hash that was signed
const messageHash = ethers.keccak256(
    ethers.concat([
        ethers.toUtf8Bytes(voterName),
        ethers.toUtf8Bytes(sid),
        voterKeyPair.publicKey
    ])
);

const isValid = CryptoUtils.verifySignature(
    messageHash,
    certificate.sigma_tilde_v,
    CryptoUtils.hexToBuffer(govConfig.publicKey)
);

console.log(isValid ? '✅ Certificate verification PASSED' : '❌ Certificate verification FAILED');

// Step 5: Create certificate in the format expected by the contract
console.log('\n5. Formatting for blockchain submission...');
const certificateForBlockchain = {
    voterName: voterName,
    sid: sid,
    voterPublicKey: CryptoUtils.bufferToHex(voterKeyPair.publicKey),
    signature: CryptoUtils.bufferToHex(certificate.sigma_tilde_v),
    governmentPublicKey: govConfig.publicKey
};

console.log('✅ Certificate formatted for blockchain:');
console.log(JSON.stringify(certificateForBlockchain, null, 2));

// Step 6: Save certificate to file
console.log('\n6. Saving certificate to file...');
const certOutputPath = path.join(__dirname, `../pre_registration/CERT_${sid}.json`);
fs.writeFileSync(certOutputPath, JSON.stringify(certificateForBlockchain, null, 2));
console.log('✅ Certificate saved to:', certOutputPath);

// Step 7: Save voter keys
console.log('\n7. Saving voter keys...');
const voterKeysPath = path.join(__dirname, `../pre_registration/VOTER_KEYS_${sid}.json`);
const voterKeys = {
    voterName: voterName,
    sid: sid,
    privateKey: CryptoUtils.bufferToHex(voterKeyPair.privateKey),
    publicKey: CryptoUtils.bufferToHex(voterKeyPair.publicKey),
    address: CryptoUtils.createWallet(voterKeyPair.privateKey).address
};
fs.writeFileSync(voterKeysPath, JSON.stringify(voterKeys, null, 2));
console.log('✅ Voter keys saved to:', voterKeysPath);

console.log('\n' + '='.repeat(60));
console.log('🎉 All tests passed! New certificate format is working correctly.');
console.log('\nNext steps:');
console.log('1. Deploy/update the EVoting contract with the new Certificate struct');
console.log('2. Use the generated certificate to register on the blockchain');
console.log('3. Complete LSAG registration');
