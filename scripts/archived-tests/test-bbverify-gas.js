const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Testing BBverify with gas estimation...\n");
    
    const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
    const evoting = await ethers.getContractAt("EVoting", config.evotingAddress);
    
    // Use the latest LSAG file (voter at position 1)
    const lsagData = JSON.parse(fs.readFileSync('./scripts/pre_registration/LSAG_12340450.json', 'utf8'));
    
    const lsagSignature = {
        keyImageX: lsagData.lsagSignature.keyImageX,
        keyImageY: lsagData.lsagSignature.keyImageY,
        c: lsagData.lsagSignature.c,
        s: lsagData.lsagSignature.s
    };
    
    const electionId = lsagData.electionIdHash;
    const newPublicKey = lsagData.newPublicKey;
    
    console.log("Trying to estimate gas...");
    try {
        const gasEstimate = await evoting.BBverify.estimateGas(electionId, lsagSignature, newPublicKey);
        console.log("✅ Gas estimate:", gasEstimate.toString());
        
        console.log("\nNow sending transaction with estimated gas...");
        const tx = await evoting.BBverify(electionId, lsagSignature, newPublicKey, {
            gasLimit: gasEstimate * 2n // Double the estimate to be safe
        });
        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        
    } catch (error) {
        console.log("❌ Error:", error.message);
        
        console.log("\nTrying static call for revert reason...");
        try {
            await evoting.BBverify.staticCall(electionId, lsagSignature, newPublicKey);
            console.log("Static call succeeded - this shouldn't happen!");
        } catch (staticError) {
            console.log("Static call error:", staticError.message);
            if (staticError.reason) {
                console.log("Reason:", staticError.reason);
            }
            if (staticError.code) {
                console.log("Code:", staticError.code);
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
