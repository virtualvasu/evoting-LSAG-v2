const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function checkRing() {
    const deploymentPath = path.join(__dirname, '../config/deployment.json');
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const contract = await ethers.getContractAt('EVoting', deployment.contractAddress);
    
    const ringSize = await contract.getRingSize();
    console.log(`Current voter ring size: ${ringSize}`);
    
    if (ringSize > 0) {
        const keys = await contract.getRegisteredPublicKeys();
        console.log(`\nRegistered public keys:`);
        keys.forEach((key, idx) => {
            console.log(`  [${idx}] ${key.substring(0, 20)}...`);
        });
    } else {
        console.log(`\n⚠️  Voter ring is EMPTY. You need to register voters first using storePub().`);
    }
}

checkRing()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
