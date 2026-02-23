const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function updateContractConfig() {
    console.log('Updating contract configuration...\n');
    
    // Load deployment info
    const deploymentPath = path.join(__dirname, 'config/deployment.json');
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    // Load contract artifacts to get ABI
    const artifactsPath = path.join(__dirname, '../artifacts/contracts/Evoting.sol/EVoting.json');
    const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
    
    // Update voter portal config
    const voterPortalConfigPath = path.join(__dirname, '../voter-portal/contract-config.json');
    const newConfig = {
        contractAddress: deployment.contractAddress,
        rpcUrl: "http://10.10.0.61:8550",
        network: "iitbh",
        chainId: "491002",
        abi: artifacts.abi
    };
    
    fs.writeFileSync(voterPortalConfigPath, JSON.stringify(newConfig, null, 2));
    console.log('✅ Voter portal contract config updated');
    
    // Update government frontend if needed
    const govContractConfigPath = path.join(__dirname, '../government-frontend/contract-config.json');
    if (fs.existsSync(govContractConfigPath)) {
        fs.writeFileSync(govContractConfigPath, JSON.stringify(newConfig, null, 2));
        console.log('✅ Government frontend contract config updated');
    }
    
    console.log('\n📋 Updated Configuration:');
    console.log('Contract Address:', deployment.contractAddress);
    console.log('Network:', 'iitbh');
    console.log('RPC URL:', 'http://10.10.0.61:8550');
    console.log('Chain ID:', '491002');
    
    console.log('\n🚀 All configurations updated successfully!');
}

updateContractConfig()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error updating config:', error);
        process.exit(1);
    });