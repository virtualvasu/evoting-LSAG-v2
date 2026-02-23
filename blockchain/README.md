# Blockchain Module

> Smart contract infrastructure and deployment tools for the LSAG-based E-Voting System

## Overview

The blockchain module contains all smart contracts, deployment scripts, and blockchain-related utilities for the e-voting system. It uses Hardhat framework for development, testing, and deployment.

## Structure

```
blockchain/
├── contracts/           # Solidity smart contracts
│   ├── Evoting.sol     # Main voting contract
│   ├── Secp256k1.sol   # Elliptic curve operations
│   ├── ECOperations.sol # Extended EC math
│   └── MessageHashUtils.sol # Message hashing utilities
│
├── scripts/            # Deployment and utility scripts
│   ├── deploy/         # Contract deployment
│   ├── admin/          # Administrative tools
│   ├── utils/          # Blockchain utilities
│   ├── monitoring/     # Status checking tools
│   └── testing/        # Demo and test scripts
│
├── ignition/           # Hardhat Ignition modules
├── config/             # Configuration files
├── artifacts/          # Compiled contracts (gitignored)
├── cache/              # Build cache (gitignored)
└── test/               # Smart contract tests
```

## Quick Start

### Installation
```bash
npm install
```

### Compile Contracts
```bash
npx hardhat compile
```

### Deploy Contracts

**1. Deploy Secp256k1 Library (Required First):**
```bash
npx hardhat run scripts/deploy/deploy-secp256k1.js --network iitbh
```

**2. Deploy Main EVoting Contract:**
```bash
npx hardhat ignition deploy ignition/modules/Evoting.ts --network iitbh
```

### Verify Deployment
```bash
node scripts/monitoring/check-election-status.js
```

## Smart Contracts

### Evoting.sol
Main voting contract with LSAG signature verification and vote recording.

**Key Functions:**
- `addVoterToRing()` - Add voter certificates to ring
- `registerVoter()` - Anonymous registration with LSAG signature
- `castVote()` - Submit encrypted votes
- `tallyVote()` - Reveal and tally votes
- `getResults()` - Retrieve election results

### Secp256k1.sol  
Elliptic curve cryptographic operations optimized for secp256k1 curve.

### ECOperations.sol
Extended elliptic curve mathematical operations for LSAG signature verification.

### MessageHashUtils.sol
Ethereum-compatible message hashing utilities for signature verification.

## Scripts Reference

### Deployment Scripts (`scripts/deploy/`)
- **deploy-secp256k1.js** - Deploy Secp256k1 library
- **deploy-evoting.js** - Deploy main EVoting contract  
- **redeploy-all.sh** - Redeploy all contracts

### Admin Scripts (`scripts/admin/`)
- **simple-setup.js** - Initialize election configuration
- **update-config.js** - Update contract configurations

### Monitoring Scripts (`scripts/monitoring/`)
- **check-election-status.js** - Check current election phase
- **check-registration-table.js** - View registered voters
- **check-ring.js** - Inspect voter ring structure
- **check-transaction.js** - Verify transaction status

### Testing Scripts (`scripts/testing/`)
- **complete-demo.js** - End-to-end election simulation
- **archived-tests/** - Legacy test scripts

## Configuration

### Network Settings
Edit `hardhat.config.js` for network configuration:
```javascript
networks: {
  iitbh: {
    url: 'http://10.10.0.61:8550',
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

### Environment Variables
Create `.env` file:
```bash
PRIVATE_KEY=0x...              # Deployment wallet private key
IITBH_RPC_URL=http://10.10.0.61:8550
LOCALHOST_RPC_URL=http://localhost:8545
```

## Development

### Run Tests
```bash
npx hardhat test
```

### Start Local Node
```bash
npx hardhat node
```

### Deploy to Local Network
```bash
npx hardhat run scripts/deploy/deploy-secp256k1.js --network localhost
npx hardhat ignition deploy ignition/modules/Evoting.ts --network localhost
```

### Gas Optimization
Contracts are optimized with:
- Solidity 0.8.28
- 200 optimization runs
- Via IR compilation

## Contract Addresses

### IITBH Network
- **EVoting**: `0xED8CAB8a931A4C0489ad3E3FB5BdEA84f74fD23E`
- **Secp256k1**: (deployed dependency)

Check `config/deployment.json` for latest addresses.

## API Reference

### EVoting Contract Interface

```solidity
// Voter ring management
function addVoterToRing(bytes32 voterPublicKeyX, bytes32 voterPublicKeyY) external;

// Anonymous registration
function registerVoter(
    string calldata voterName,
    string calldata sid, 
    uint256 electionId,
    bytes32 newPublicKeyX,
    bytes32 newPublicKeyY,
    LSAGSignature calldata signature
) external;

// Vote casting
function castVote(bytes32 hashedVote) external;

// Vote tallying  
function tallyVote(uint8 candidate, bytes32 revealValue) external;

// Results
function getResults() external view returns (uint256[5] memory);
```

## Security

### Private Key Management
- Never commit private keys to version control
- Use environment variables for sensitive data
- Secure deployment wallet with multi-sig if possible

### Contract Security
- All contracts use OpenZeppelin libraries
- Elliptic curve operations audited for correctness
- LSAG signature verification prevents double voting

### Network Security
- Deploy on controlled private blockchain
- Verify contract bytecode matches source
- Monitor for unusual transaction patterns

## Troubleshooting

### Common Issues

**"insufficient funds for intrinsic transaction cost"**
- Check wallet balance on IITBH network
- Verify RPC connection is working

**"library not found"**  
- Deploy Secp256k1 library first
- Copy library address to Evoting deployment

**"revert" without reason**
- Check transaction parameters
- Verify contract state allows operation
- Review require() conditions in contract

### Debug Tools
```bash
# Check network connection
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://10.10.0.61:8550

# Verify contract deployment
node scripts/monitoring/check-election-status.js

# Check transaction details  
node scripts/monitoring/check-transaction.js <tx-hash>
```

## Contributing

### Adding New Contracts
1. Create Solidity file in `contracts/`
2. Add deployment script in `scripts/deploy/`
3. Update `ignition/modules/` if using Ignition
4. Add tests in `test/`
5. Update this README

### Modifying Existing Contracts
1. Update Solidity code
2. Recompile: `npx hardhat compile`
3. Update tests if needed
4. Redeploy to test network
5. Update contract addresses in config

### Script Development  
- Place utility scripts in `scripts/utils/`
- Add monitoring scripts to `scripts/monitoring/`
- Follow existing naming conventions
- Document script parameters and usage

---

**For technical questions or issues, refer to the main project documentation or create an issue.**