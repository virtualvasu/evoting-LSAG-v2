# LSAG-Based E-Voting Smart Contract

This repository contains a simplified Solidity smart contract implementing an LSAG (Linkable Spontaneous Anonymous Group) based electronic voting system with essential on-chain functionality.

**Deployed Contract Address**: `0x4ECFddFb3487b3Cc2C7d85cB6C5075Bf78dF919e`

![E-Voting Protocol Flow](public/evoting.png)

## Contract Overview

### EVoting.sol
**Purpose**: Core bulletin board functionality for LSAG-based e-voting protocol

**Key Features**:
- Public key storage and verification
- Encrypted vote submission
- Vote tallying with decryption results
- Event-driven transparency
- Gas-optimized storage patterns

**Main Functions**:
- `storePub(signature, publicKey)`: Store voter's public key on bulletin board
- `verify(signature, publicKey)`: Verify stored public key matches provided one
- `voting(signature, hashValue, encryptedVote)`: Submit encrypted vote with hash
- `tally(candidate, randomness, voterKey)`: Record decrypted vote for final tallying

## Architecture Design

### On-Chain Components (Smart Contract)
The `EVoting` contract serves as a **bulletin board** storing:
- Voter public keys with signatures
- Encrypted votes with hash commitments
- Decrypted vote results for tallying
- Verification status and voting records

### Off-Chain Components
All cryptographic operations are handled off-chain for efficiency and flexibility:

#### LSAG Operations
- **Ring signature generation**: Create LSAG signatures using voter rings
- **Signature verification**: Verify LSAG signatures against public key rings
- **Linkability checking**: Detect double-voting through key image comparison
- **Key image extraction**: Extract linkable key images from signatures

#### Cryptographic Functions
- **PKS signature verification**: Verify government certificate signatures
- **Vote encryption/decryption**: Encrypt votes for privacy, decrypt for tallying
- **Hash generation**: Create vote commitments and verification hashes
- **Randomness generation**: Generate cryptographic randomness for protocols

#### Protocol Logic
- **Ring formation**: Create anonymity sets from registered voters
- **Vote validation**: Verify vote format and cryptographic proofs
- **Tallying algorithms**: Aggregate and count decrypted votes
- **Result verification**: Verify final tally against individual votes

## Getting Started

### Prerequisites
- Node.js and npm installed
- The contract is already deployed at: `0x4ECFddFb3487b3Cc2C7d85cB6C5075Bf78dF919e`

### Installation and Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initial System Setup** (One-time setup for existing deployed contract)
   ```bash
   node scripts/admin/simple-setup.js
   ```

   **What happens when you run this:**
   - ✅ Creates configuration directory (`/scripts/config/`)
   - ✅ Generates `deployment.json` with contract address and network info
   - ✅ Creates government authority keys for certificate generation
   - ✅ Saves `government-config.json` with government credentials
   - ✅ Links all scripts to your deployed contract

   **Output:**
   ```
   🔧 Setting up configuration for existing contract...
   📄 Deployment info saved to: .../scripts/config/deployment.json
   🏛️  Government configuration saved to: .../scripts/config/government-config.json
   
   ✅ Setup completed successfully!
   📋 Configuration Summary:
   Contract Address: 0x4ECFddFb3487b3Cc2C7d85cB6C5075Bf78dF919e
   Government Address: 0x[generated-government-address]
   ```

### Registration Phase

After running the setup script, you can proceed with voter registration:

3. **Government Certificate Generation**
   ```bash
   node scripts/registration/test-certificate-generation.js
   ```
   
   **What happens when you run this script:**
   - ✅ Automatically adds 3 test voters (Alice Johnson, Bob Smith, Carol Williams)
   - ✅ Generates ECDSA key pairs for each voter
   - ✅ Government signs each voter's public key with PKS signatures
   - ✅ Creates certificates in format: `{σ̃_v, P_ugov, P_uv}`
   - ✅ Saves voter database to `/scripts/config/voter-database.json`
   - ✅ Displays all certificates in JSON format ready for voter registration
   
   **Expected Output:**
   ```
   🧪 Testing Government Certificate Generator...
   📋 Adding test voters...
   ✅ Added 3 eligible voters out of 3
   
   🔐 Generating keys and certificates...
   ✅ Certificate generated for Alice Johnson
   ✅ Certificate generated for Bob Smith  
   ✅ Certificate generated for Carol Williams
   
   📜 Generated Certificates:
   1. Alice Johnson (VOTER_001)
   Certificate JSON: {
     "sigma_tilde_v": "0x7311fd...",  // Government signature
     "P_ugov": "0x5ca208...",         // Government public key  
     "P_uv": "0x689127..."           // Voter public key
   }
   
   🎉 Test completed successfully!
   📋 Next Steps: Use certificates for voter registration
   ```

4. **Voter Registration**
   ```bash
   node scripts/registration/test-voter-registration.js
   ```
   
   **What happens during voter registration:**
   - ✅ Loads voter certificates from previous step
   - ✅ Tests with Alice Johnson's certificate  
   - ✅ Generates test wallet for blockchain transactions
   - ✅ Submits certificate to blockchain (`storePub`)
   - ✅ Generates LSAG signature for anonymity 
   - ✅ Completes registration via `verify` function
   
   **Expected Output:**
   ```
   🗳️ Testing Voter Registration Process...
   👤 Testing registration for: Alice Johnson (VOTER_001)
   🔑 Generated test wallet: 0x62bb3E2cEe698229fb693112E100d325a554b7c0
   📜 Certificate received and validated!
   📋 Phase 1: Certificate Submission (storePub)
   📋 Phase 2: LSAG Signature Generation  
   📋 Phase 3: LSAG Registration (verify)
   🎉 VOTER REGISTRATION SUCCESSFUL!
   ✅ Voter is now registered and can participate in voting!
   ```
   
   **Note**: Requires test ETH in generated wallet for gas fees

### Project Structure

```
scripts/
├── admin/
│   └── simple-setup.js              # Initial system configuration
├── registration/
│   ├── government-certificate-generator.js  # Core government certificate logic
│   ├── test-certificate-generation.js       # Generates certificates for 3 test voters
│   ├── test-voter-registration.js           # Tests voter registration with Alice's certificate
│   └── voter-registration.js        # Core voter registration workflow  
├── utils/
│   ├── crypto-utils.js             # Core cryptographic functions
│   └── blockchain-interface.js     # Contract interaction utilities
├── voting/                         # (Coming soon)
├── tallying/                       # (Coming soon)
└── config/                         # Auto-generated configuration files
    ├── deployment.json             # Contract and network config
    ├── government-config.json      # Government authority keys
    └── voter-database.json         # Voter and certificate database
```

