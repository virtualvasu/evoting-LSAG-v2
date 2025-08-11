// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import VoterRegistrationContractModule from "./VoterRegistrationContract";

const VotingAndTallyingContractModule = buildModule("VotingAndTallyingContractModule", (m) => {
  // Import both previous contracts from the VoterRegistrationContract module
  const { voterRegistrationContract, registrationContract } = m.useModule(VoterRegistrationContractModule);

  // Deploy the VotingAndTallyingContract with both contract addresses
  const votingAndTallyingContract = m.contract("VotingAndTallyingContract", [
    voterRegistrationContract,
    registrationContract
  ]);

  return { 
    votingAndTallyingContract,
    voterRegistrationContract,
    registrationContract 
  };
});

export default VotingAndTallyingContractModule;
