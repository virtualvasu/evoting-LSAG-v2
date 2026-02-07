# Contract Configuration Guide

## How to Update Contract Configuration

The voter portal uses `contract-config.json` for all blockchain interactions.

### Step 1: Get Contract Address

From your deployment output or `scripts/config/deployment.json`:
```json
{
  "contractAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
}
```

### Step 2: Get Contract ABI

Copy the ABI from `artifacts/contracts/Evoting.sol/EVoting.json`:

```bash
# From the project root
cat artifacts/contracts/Evoting.sol/EVoting.json | jq .abi > voter-portal/temp-abi.json
```

Or manually copy the `abi` array from the artifact file.

### Step 3: Update contract-config.json

Edit `voter-portal/contract-config.json`:

```json
{
  "contractAddress": "0xYourContractAddress",
  "rpcUrl": "http://10.10.0.61:8550",
  "network": "localhost",
  "abi": [
    // Paste the entire ABI array here
    {
      "inputs": [...],
      "stateMutability": "...",
      "type": "..."
    },
    ...
  ]
}
```

### Step 4: Restart the Dev Server

```bash
cd voter-portal
npm run dev
```

## Quick Update Script

Run this from the project root to auto-update the config:

```bash
node -e "
const fs = require('fs');
const deployment = JSON.parse(fs.readFileSync('scripts/config/deployment.json', 'utf8'));
const artifact = JSON.parse(fs.readFileSync('artifacts/contracts/Evoting.sol/EVoting.json', 'utf8'));
const config = {
  contractAddress: deployment.contractAddress || deployment.evotingAddress,
  rpcUrl: 'http://10.10.0.61:8550',
  network: deployment.network || 'localhost',
  abi: artifact.abi
};
fs.writeFileSync('voter-portal/contract-config.json', JSON.stringify(config, null, 2));
console.log('✅ Contract config updated!');
"
```
