// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RegistrationContractModule from "./RegistrationContract";

const VoterRegistrationContractModule = buildModule("VoterRegistrationContractModule", (m) => {
  // Import the RegistrationContract from the previous module
  const { registrationContract } = m.useModule(RegistrationContractModule);

  // Deploy the VoterRegistrationContract with RegistrationContract address
  const voterRegistrationContract = m.contract("VoterRegistrationContract", [registrationContract]);

  return { voterRegistrationContract, registrationContract };
});

export default VoterRegistrationContractModule;
