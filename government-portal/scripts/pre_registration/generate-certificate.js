const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Load voter keys
const voterKeys = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'VOTER_KEYS_12345678.json'), 
    'utf8'
));

// Load government configuration
const govConfig = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../config/government-config.json'),
    'utf8'
));

console.log('🏛️  Generating Certificate for:', voterKeys.name);
console.log('Student ID:', voterKeys.studentId);
console.log('Public Key:', voterKeys.publicKey);

// Create wallet from government private key
const wallet = new ethers.Wallet(govConfig.privateKey);

// Hash all three fields using Solidity-compatible packed encoding
const messageHash = ethers.solidityPackedKeccak256(
    ['string', 'string', 'bytes'],
    [voterKeys.name, voterKeys.studentId, voterKeys.publicKey]
);

// Sign the hash
const messageBytes = ethers.getBytes(messageHash);
const ethSignedHash = ethers.hashMessage(messageBytes);
const signature = wallet.signingKey.sign(ethSignedHash);
const signatureSerialized = signature.serialized;

console.log('\n✅ Signature Generated:', signatureSerialized);

// Verify the signature
const recoveredAddress = ethers.recoverAddress(ethSignedHash, signatureSerialized);
const isValid = recoveredAddress.toLowerCase() === govConfig.address.toLowerCase();

console.log('🔍 Signature Verification:', isValid ? 'PASSED ✅' : 'FAILED ❌');

// Create certificate
const certificate = {
    voterName: voterKeys.name,
    sid: voterKeys.studentId,
    voterPublicKey: voterKeys.publicKey,
    signature: signatureSerialized,
    governmentPublicKey: govConfig.publicKey
};

// Save certificate
const certFilename = `CERT_${voterKeys.studentId}.json`;
fs.writeFileSync(
    path.join(__dirname, certFilename),
    JSON.stringify(certificate, null, 2)
);

console.log(`\n✅ Certificate saved to: ${certFilename}`);
console.log('\n📋 Certificate Details:');
console.log(JSON.stringify(certificate, null, 2));
