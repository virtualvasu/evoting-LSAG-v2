const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const txHash = "0xa5b9353b292f13033406eac58eebf640e4dfdd549c76902f7c70128a8abd745c";
    
    console.log("Checking transaction receipt...\n");
    
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("Transaction Receipt:");
    console.log("  Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas Used:", receipt.gasUsed.toString());
    console.log("  Logs:", receipt.logs.length);
    
    if (receipt.status === 0) {
        console.log("\n❌ Transaction reverted!");
        
        // Try to get revert reason
        const tx = await provider.getTransaction(txHash);
        try {
            await provider.call(tx, tx.blockNumber);
        } catch (error) {
            console.log("\nRevert reason:", error.message);
        }
    } else {
        console.log("\n✅ Transaction succeeded!");
        
        // Parse logs
        const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
        const evoting = await ethers.getContractAt("EVoting", config.evotingAddress);
        
        console.log("\nParsing events...");
        for (const log of receipt.logs) {
            try {
                const parsed = evoting.interface.parseLog(log);
                if (parsed) {
                    console.log(`  Event: ${parsed.name}`);
                    console.log(`  Args:`, parsed.args);
                }
            } catch (e) {
                // Skip unparseable logs
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
