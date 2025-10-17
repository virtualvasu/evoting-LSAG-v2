import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EVotingModule = buildModule("EVotingModule", (m) => {
  // Deploy the EVoting contract
  const eVoting = m.contract("EVoting");

  return { eVoting };
});

export default EVotingModule;