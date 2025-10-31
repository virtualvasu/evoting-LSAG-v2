// Simple script to generate CERTv = {σ̃v, P_ugov, P_uv}
// Uses ethers.js (Ethereum's standard crypto lib)

import { ethers } from "ethers";

// ----------- Step 1: Setup Keys -----------

// Generate government keypair (in real system, this stays fixed)
const govWallet = ethers.Wallet.createRandom();

// Generate a voter keypair
const voterWallet = ethers.Wallet.createRandom();

// ----------- Step 2: Government signs voter's public key -----------

// Get the voter's raw uncompressed public key (64 bytes)
const voterPubKey = voterWallet._signingKey().publicKey.slice(4); // remove '0x04' prefix

// Hash the voter's public key
const messageHash = ethers.keccak256("0x" + voterPubKey);

// Sign that hash with the government private key
const signature = await govWallet.signMessage(ethers.getBytes(messageHash));

// ----------- Step 3: Build CERTv object -----------

const CERTv = {
  sigma_tilde_v: signature,                          // PKS signature (σ̃v)
  P_ugov: govWallet._signingKey().publicKey.slice(4), // government public key (64 bytes)
  P_uv: voterPubKey                                  // voter public key (64 bytes)
};

console.log("===== CERTv (to pass into storePub) =====");
console.log("σ̃v (sigma_tilde_v):", CERTv.sigma_tilde_v);
console.log("P_ugov:", CERTv.P_ugov);
console.log("P_uv:", CERTv.P_uv);

// Optional: derived Ethereum addresses
console.log("\nGovernment Address:", govWallet.address);
console.log("Voter Address:", voterWallet.address);
