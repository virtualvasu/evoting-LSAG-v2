const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Checking registration table...\n");
    
    const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
    const evoting = await ethers.getContractAt("EVoting", config.evotingAddress);
    
    const tableSize = await evoting.getRegistrationTableSize();
    console.log("📊 Registration Table Size:", tableSize.toString());
    
    if (tableSize > 0) {
        console.log("\n📋 Registered Entries:\n");
        for (let i = 0; i < tableSize; i++) {
            const entry = await evoting.getRegistrationEntry(i);
            console.log(`[${i}] Key Image: 0x${entry[0].toString(16).substring(0, 16)}...`);
            console.log(`    Public Key: ${entry[4].substring(0, 20)}...`);
        }
    } else {
        console.log("\n✅ Registration table is empty - ready for new registrations!");
    }
    
    console.log("\nRing Size:", (await evoting.getRingSize()).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
