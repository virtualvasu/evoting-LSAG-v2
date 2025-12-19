#!/usr/bin/env node

const ethers = require('ethers');
const BlockchainInterface = require('./utils/blockchain-interface');
const fs = require('fs');
const path = require('path');

async function checkContractState() {
    try {
        console.log('🔍 Checking EVoting Contract State\n');

        // Load deployment config
        const deploymentConfig = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
        const contractAddress = deploymentConfig.contractAddress;
        
        console.log('Deployment config loaded:');
        console.log('  Contract address:', contractAddress);
        console.log('  Network:', deploymentConfig.network);
        console.log('  RPC URL:', deploymentConfig.networkUrl);

        const blockchain = new BlockchainInterface(contractAddress, 'http://127.0.0.1:8545');
        blockchain.connectReadOnly();

        console.log('\nContract status:');
        console.log('  Contract:', blockchain.contract ? 'Loaded' : 'NULL');
        if (blockchain.contract) {
            console.log('  Address:', blockchain.contract.address);
        }

        // Check contract code
        console.log('\n✓ Attempting to query contract...');
        
        try {
            const ringSize = await blockchain.contract.getRingSize();
            console.log('✓ getRingSize() returned:', ringSize.toString());
        } catch (error) {
            console.log('❌ getRingSize() failed:', error.message);
            
            // Try to get the voterRing directly
            try {
                const ring = await blockchain.contract.getVoterRing();
                console.log('✓ getVoterRing() worked:', ring.length, 'members');
            } catch (e) {
                console.log('❌ getVoterRing() also failed:', e.message);
            }
        }

        // Check if storePub function exists
        console.log('\n✓ Contract functions available:');
        const fragment = blockchain.contract.interface.fragments.find(f => f.name === 'storePub');
        console.log('  - storePub:', fragment ? 'YES' : 'NO');
        const fragment2 = blockchain.contract.interface.fragments.find(f => f.name === 'getRingSize');
        console.log('  - getRingSize:', fragment2 ? 'YES' : 'NO');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkContractState();
