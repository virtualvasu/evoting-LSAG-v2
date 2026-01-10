const { keccak_256 } = require('@noble/hashes/sha3');
const { bytesToHex } = require('@noble/hashes/utils');
const { ethers } = require('ethers');

const message = "election_001";
const messageBytes = Buffer.from(message, 'utf8');

// JavaScript keccak256
const jsHash = keccak_256(messageBytes);
console.log('JS keccak_256:', '0x' + bytesToHex(jsHash));

// Ethers keccak256
const ethersHash = ethers.keccak256(messageBytes);
console.log('Ethers keccak256:', ethersHash);

console.log('Match:', '0x' + bytesToHex(jsHash) === ethersHash);
