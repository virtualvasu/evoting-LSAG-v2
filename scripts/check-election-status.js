const hre = require("hardhat");

async function main() {
  const config = require('./config/deployment.json');
  console.log("Contract Address:", config.evotingAddress);
  console.log("Network:", config.network);
  console.log("");
  
  const EVoting = await hre.ethers.getContractFactory("EVoting");
  const contract = EVoting.attach(config.evotingAddress);
  
  try {
    console.log("=== Current Election Status ===");
    const status = await contract.getElectionStatus();
    console.log("Election ID:", status[0]);
    console.log("Is Active:", status[1]);
    console.log("Is Completed:", status[2]);
    console.log("Candidates:", status[3]);
    console.log("Registered Voters (current election):", status[4].toString());
    console.log("Current Phase:", status[5].toString(), "(" + status[6] + ")");
    console.log("");
  } catch (error) {
    console.log("Error reading election status:", error.message);
    console.log("");
  }
  
  console.log("=== Voter Ring (Persistent) ===");
  try {
    const ringSize = await contract.getRingSize();
    console.log("Total Voters in Persistent Ring:", ringSize.toString());
    
    if (ringSize > 0) {
      console.log("\nThese voters can register for the current election.");
    }
  } catch (error) {
    console.log("Error reading ring size:", error.message);
  }
  
  console.log("");
  console.log("=== Registration Table ===");
  try {
    const regTableSize = await contract.getRegistrationTableSize();
    console.log("Voters Registered for Current Election:", regTableSize.toString());
  } catch (error) {
    console.log("Error reading registration table:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
