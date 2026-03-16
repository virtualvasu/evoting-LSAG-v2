const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying Secp256k1 library...");
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
    
    const Secp256k1 = await ethers.getContractFactory("Secp256k1");
    const secp256k1 = await Secp256k1.deploy();
    await secp256k1.waitForDeployment();
    
    const address = await secp256k1.getAddress();
    console.log("Secp256k1 deployed to:", address);
    
    // Save to config
    const fs = require('fs');
    const configPath = './config/config/deployment.json';
    let config = {};
    
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.log("Creating new deployment config...");
    }
    
    config.secp256k1Address = address;
    config.secp256k1DeployedAt = new Date().toISOString();
    config.network = network.name === "unknown" ? "iitbh" : network.name;
    config.chainId = network.chainId.toString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Secp256k1 address saved to deployment.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
