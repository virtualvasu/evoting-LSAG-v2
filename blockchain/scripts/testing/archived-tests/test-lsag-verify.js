const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Testing LSAG verification directly...\n");
    
    const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
    const evoting = await ethers.getContractAt("EVoting", config.evotingAddress);
    
    // Load the LSAG signature
    const lsagData = JSON.parse(fs.readFileSync('./scripts/pre_registration/LSAG_12342330.json', 'utf8'));
    
    const keyImageX = lsagData.lsagSignature.keyImageX;
    const keyImageY = lsagData.lsagSignature.keyImageY;
    const c = lsagData.lsagSignature.c;
    const s = lsagData.lsagSignature.s;
    const electionId = lsagData.electionIdHash;
    
    console.log("LSAG Parameters:");
    console.log("  Election ID:", electionId);
    console.log("  Key Image X:", keyImageX);
    console.log("  Key Image Y:", keyImageY);
    console.log("  Challenge c:", c);
    console.log("  Responses:", s.length);
    console.log();
    
    const lsagSignature = {
        keyImageX,
        keyImageY,
        c,
        s
    };
    
    console.log("Calling LSAGver...");
    try {
        const result = await evoting.LSAGver(electionId, lsagSignature);
        console.log("✅ LSAGver result:", result);
        
        if (result) {
            console.log("\n✅ Signature is valid!");
            console.log("\nNow trying BBverify...");
            
            const newPublicKey = lsagData.newPublicKey;
            
            try {
                const tx = await evoting.BBverify(electionId, lsagSignature, newPublicKey, {
                    gasLimit: 5000000
                });
                console.log("Transaction hash:", tx.hash);
                const receipt = await tx.wait();
                console.log("✅ BBverify succeeded!");
                console.log("Gas used:", receipt.gasUsed.toString());
                
                // Check events
                for (const log of receipt.logs) {
                    try {
                        const parsed = evoting.interface.parseLog(log);
                        if (parsed && parsed.name === 'RegistrationSuccess') {
                            console.log("\n🎉 Registration Success!");
                            console.log("  Registration Index (kv):", parsed.args.kv.toString());
                        }
                    } catch (e) {}
                }
            } catch (txError) {
                console.log("❌ BBverify transaction failed:", txError.message);
                
                // Try to get the revert reason
                if (txError.data) {
                    console.log("Error data:", txError.data);
                }
                
                // Try calling statically to get revert message
                try {
                    await evoting.BBverify.staticCall(electionId, lsagSignature, newPublicKey);
                } catch (staticError) {
                    console.log("Revert reason:", staticError.message);
                    if (staticError.reason) {
                        console.log("Decoded reason:", staticError.reason);
                    }
                }
            }
            
        } else {
            console.log("\n❌ Signature verification failed!");
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
        
        if (error.data) {
            console.log("\nError data:", error.data);
        }
        
        // Try to get revert reason
        if (error.reason) {
            console.log("Revert reason:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
