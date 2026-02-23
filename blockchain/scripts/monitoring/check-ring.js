const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Checking voter ring state...\n");
    
    const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
    const evoting = await ethers.getContractAt("EVoting", config.evotingAddress);
    
    const ringSize = await evoting.getRingSize();
    console.log("📊 Voter Ring Size:", ringSize.toString());
    
    if (ringSize > 0) {
        console.log("\n📋 Registered Public Keys:\n");
        const pubKeys = await evoting.getRegisteredPublicKeys();
        
        for (let i = 0; i < pubKeys.length; i++) {
            console.log(`  [${i}] ${pubKeys[i].substring(0, 20)}...${pubKeys[i].substring(pubKeys[i].length - 10)}`);
            console.log(`      Length: ${pubKeys[i].length} chars (${(pubKeys[i].length - 2) / 2} bytes)`);
        }
        
        console.log("\n✅ Ring is ready for LSAG signatures!");
        console.log("\nNext step: Generate LSAG signature");
        console.log("  Use: scripts/utils/lsag-generator-template.js as reference");
    } else {
        console.log("\n⚠️  Ring is empty. Register voters first:");
        console.log("  npx hardhat run scripts/registration/register-existing-voters.js --network localhost");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
