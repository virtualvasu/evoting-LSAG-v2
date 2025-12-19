#!/usr/bin/env node

const ethers = require('ethers');

async function checkNetwork() {
    try {
        console.log('🔍 Checking Network Connection\n');

        const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        
        console.log('Attempting to connect to http://127.0.0.1:8545...');
        const network = await provider.getNetwork();
        
        console.log('✅ Connected to network:');
        console.log('  Name:', network.name);
        console.log('  Chain ID:', network.chainId);
        
        // Get the current block
        const block = await provider.getBlockNumber();
        console.log('  Current block:', block);
        
        // Get account balance
        const balance = await provider.getBalance('0x5FbDB2315678afecb367f032d93F642f64180aa3');
        console.log('  Contract account balance:', ethers.formatEther(balance), 'ETH');

    } catch (error) {
        console.error('❌ Network check failed:', error.message);
        console.log('\n⚠️  The Hardhat node is not running!');
        console.log('Start it in another terminal with: npx hardhat node');
        process.exit(1);
    }
}

checkNetwork();
