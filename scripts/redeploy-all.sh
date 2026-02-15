#!/bin/bash

echo "=================================="
echo "Redeploying EVoting Contracts"
echo "=================================="

# Navigate to project root
cd "$(dirname "$0")/.."

echo ""
echo "Step 1: Deploying Secp256k1 library..."
npx hardhat run scripts/deploy-secp256k1.js --network iitbh

if [ $? -ne 0 ]; then
    echo "❌ Secp256k1 deployment failed"
    exit 1
fi

echo ""
echo "Step 2: Deploying EVoting contract..."
npx hardhat run scripts/deploy-evoting.js --network iitbh

if [ $? -ne 0 ]; then
    echo "❌ EVoting deployment failed"
    exit 1
fi

echo ""
echo "Step 3: Updating voter portal config..."
node -e "
const fs = require('fs');
const deployment = JSON.parse(fs.readFileSync('scripts/config/deployment.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('artifacts/contracts/Evoting.sol/EVoting.json', 'utf8'));
const config = {
  contractAddress: deployment.evotingAddress,
  rpcUrl: 'http://10.10.0.61:8550',
  network: deployment.network || 'iitbh',
  chainId: deployment.chainId || '31337',
  abi: artifact.abi
};
fs.writeFileSync('voter-portal/contract-config.json', JSON.stringify(config, null, 2));
console.log('✅ Voter portal config updated!');
console.log('   Contract:', config.contractAddress);
console.log('   Network:', config.network);
console.log('   Chain ID:', config.chainId);
"

echo ""
echo "=================================="
echo "✅ All contracts redeployed!"
echo "=================================="
echo ""
echo "Addresses saved to:"
echo "  - scripts/config/deployment.json"
echo "  - voter-portal/contract-config.json"
echo ""
