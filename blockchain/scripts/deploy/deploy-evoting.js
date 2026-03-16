const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=".repeat(60));
    console.log("Starting complete EVoting deployment...");
    console.log("=".repeat(60));
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Read Secp256k1 address from config
    const configPath = './config/config/deployment.json';
    let config = {};
    
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log("\n✓ Loaded deployment config");
    } catch (error) {
        console.error("❌ Error reading deployment config. Please deploy Secp256k1 first.");
        process.exit(1);
    }
    
    if (!config.secp256k1Address) {
        console.error("❌ Secp256k1 address not found. Please deploy Secp256k1 first using:");
        console.error("   npx hardhat run scripts/deploy-secp256k1.js --network <network>");
        process.exit(1);
    }
    
    console.log("✓ Secp256k1 address:", config.secp256k1Address);
    
    // Deploy EVoting contract
    console.log("\n" + "-".repeat(60));
    console.log("Deploying EVoting contract...");
    console.log("-".repeat(60));
    
    const EVoting = await ethers.getContractFactory("EVoting");
    const evoting = await EVoting.deploy(config.secp256k1Address);
    await evoting.waitForDeployment();
    
    const evotingAddress = await evoting.getAddress();
    console.log("✓ EVoting deployed to:", evotingAddress);
    
    // Update config
    config.contractAddress = evotingAddress;
    config.evotingAddress = evotingAddress;
    config.evotingDeployedAt = new Date().toISOString();
    config.setupTime = new Date().toISOString();
    config.network = network.name === "unknown" ? "iitbh" : network.name;
    config.chainId = network.chainId.toString();
    config.note = "EVoting with Simple LSAG implementation - forward-chaining verification";
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("✓ EVoting address saved to deployment.json");
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("Deployment Summary:");
    console.log("=".repeat(60));
    console.log("Secp256k1 Library:", config.secp256k1Address);
    console.log("EVoting Contract:", evotingAddress);
    console.log("Network:", config.network);
    console.log("Chain ID:", config.chainId);
    console.log("=".repeat(60));
    console.log("\n✅ Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
