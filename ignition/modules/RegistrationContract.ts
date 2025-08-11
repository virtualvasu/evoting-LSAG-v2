// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RegistrationContractModule = buildModule("RegistrationContractModule", (m) => {
  // Parameter for election authority address
  // You can override this when deploying by passing parameters
  const electionAuthority = m.getParameter("electionAuthority", "0x3d7178De2A7d863629d429635db30A687A0A2f65");

  // Deploy the RegistrationContract
  const registrationContract = m.contract("RegistrationContract", [electionAuthority]);

  return { registrationContract };
});

export default RegistrationContractModule;
