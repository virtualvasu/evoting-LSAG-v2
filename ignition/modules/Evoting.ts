import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EVotingModule = buildModule("EVotingModule", (m) => {
  // Get Secp256k1 address from parameter
  const secp256k1Address = m.getParameter("secp256k1Address");
  
  // Deploy the EVoting contract with Secp256k1 address
  const eVoting = m.contract("EVoting", [secp256k1Address]);

  return { eVoting };
});

export default EVotingModule;