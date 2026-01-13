const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Simple setup for existing deployed contract (no hardhat dependency)
 */

async function setupExistingContract() {
    console.log('🔧 Setting up configuration for existing contract...\n');

    // Your deployed contract address
    const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    try {
        // Create config directory if it doesn't exist
        const configDir = path.join(__dirname, '../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Create deployment info for existing contract
        const deploymentInfo = {
            contractAddress: contractAddress,
            setupTime: new Date().toISOString(),
            network: 'iitbh', // Update if using different network
            chainId: '491002', // Update if using different network
            note: 'Configuration for existing deployed contract'
        };

        // Save deployment info
        const deploymentPath = path.join(configDir, 'deployment.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log('📄 Deployment info saved to:', deploymentPath);

        // Generate government key pair for certificate generation
        const CryptoUtils = require('../utils/crypto-utils');
        const govKeyPair = CryptoUtils.generateKeyPair();
        
        // Create wallet from the key pair (convert to hex string)
        const privateKeyHex = ethers.hexlify(govKeyPair.privateKey);
        const wallet = new ethers.Wallet(privateKeyHex);

        const governmentConfig = {
            address: wallet.address,
            publicKey: ethers.hexlify(govKeyPair.publicKey),
            // Note: In production, store private key securely!
            privateKey: privateKeyHex,
            createdAt: new Date().toISOString(),
            note: 'Government authority keys for certificate generation'
        };

        // Save government configuration
        const govConfigPath = path.join(configDir, 'government-config.json');
        fs.writeFileSync(govConfigPath, JSON.stringify(governmentConfig, null, 2));
        console.log('🏛️  Government configuration saved to:', govConfigPath);

        console.log('\n✅ Setup completed successfully!');
        console.log('\n📋 Configuration Summary:');
        console.log('Contract Address:', contractAddress);
        console.log('Government Address:', wallet.address);
        console.log('\n🚀 Next Steps:');
        console.log('1. Run: node scripts/registration/government-certificate-generator.js');
        console.log('2. Run: node scripts/registration/voter-registration.js');

        return {
            contractAddress,
            deploymentInfo,
            governmentConfig
        };

    } catch (error) {
        console.error('❌ Setup failed:', error);
        throw error;
    }
}

// Run setup
setupExistingContract()
    .then(() => {
        console.log('\n🎉 Ready to start voter registration!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Setup failed:', error);
        process.exit(1);
    });

module.exports = { setupExistingContract };