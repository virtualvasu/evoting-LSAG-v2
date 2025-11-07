# LSAG-Based E-Voting Smart Contract

This repository contains a simplified Solidity smart contract implementing an LSAG (Linkable Spontaneous Anonymous Group) based electronic voting system with essential on-chain functionality.

**Deployed Contract Address**: `0x8CA55089C4f956f268d7B4142A49112c94baE39e` *(Fixed LSAG v1)*

**Previous Address**: `0x4ECFddFb3487b3Cc2C7d85cB6C5075Bf78dF919e` *(Initial deployment)*

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
- The contract is already deployed at: `0x8CA55089C4f956f268d7B4142A49112c94baE39e`

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
   Contract Address: 0x8CA55089C4f956f268d7B4142A49112c94baE39e
   Government Address: 0x[generated-government-address]
   ```

## ✅ LSAG Contract Fix & Successful Registration

### **November 7, 2025 - MAJOR UPDATE: LSAG Registration Working!**

**🎉 Breakthrough Achievement**: Fixed LSAG signature verification in smart contract and achieved **complete end-to-end voter registration**!

#### **What Was Fixed:**
1. **Contract LSAG Verification Algorithm** - Corrected signature parsing and verification logic
2. **Signature Format Compatibility** - Aligned JavaScript and Solidity LSAG implementations  
3. **Message Handling** - Fixed proper message format between client and contract
4. **Linking Tag Generation** - Synchronized linking tag calculation methods
5. **Ring Management** - Enhanced ring membership validation and indexing

#### **Test Results:**
- ✅ **Phase 1 (Certificate Submission)**: Working perfectly - stores certificates on blockchain
- ✅ **Phase 2 (LSAG Registration)**: **NOW WORKING** - LSAG signatures verified and accepted!
- ✅ **Complete Registration**: Full voter registration workflow functional
- ✅ **Transaction Success**: Both certificate and LSAG transactions confirmed on blockchain
- ✅ **Gas Efficiency**: ~163k gas for certificates, ~317k gas for LSAG verification

#### **Recent Successful Test:**
```
🎉 COMPLETE REGISTRATION SUCCESS! 🎉
Voter ID: TEST_VOTER_1762515396481
Certificate Transaction: 0xf0bd6857b47ac2407691290f28e647234a08e83961fe473afd4975b8f258ac4a
LSAG Registration Transaction: 0x964f191c2c59351cee58bc8c14e0856d83eb8970418bd3d53f9d4135da8a169e
Ring Position: 2
✅ Voter is now fully registered and can vote!
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

4. **Complete End-to-End Voter Registration** *(Now Working!)*
   ```bash
   node scripts/registration/test-complete-registration.js
   ```
   
   **What happens during complete voter registration:**
   - ✅ **Step 1**: Voter generates their own cryptographic keys
   - ✅ **Step 2**: Government creates certificate for voter's public key
   - ✅ **Step 3**: Complete registration process with funded government wallet
   - ✅ **Phase 1**: Certificate submission (`storePub`) - **WORKING**
   - ✅ **Phase 2**: LSAG signature generation and verification - **NOW WORKING**
   - ✅ **Result**: Voter fully registered in ring and ready for voting
   
   **Expected Output:**
   ```
   🎉 COMPLETE REGISTRATION SUCCESS! 🎉
   =====================================
   Voter ID: TEST_VOTER_1762515396481
   Certificate Transaction: 0xf0bd6857b47ac2407691290f28e647234a08e83961fe473afd4975b8f258ac4a
   LSAG Registration Transaction: 0x964f191c2c59351cee58bc8c14e0856d83eb8970418bd3d53f9d4135da8a169e
   Ring Position: 2
   
   � Final Status:
   - Certificate: ✅ Stored on blockchain
   - LSAG Registration: ✅ Completed  
   - Ring Membership: ✅ Confirmed
   - Ready for Voting: ✅ Yes
   ```
   
   **Features:**
   - Uses funded government wallet (no manual funding required)
   - Realistic voter key generation workflow
   - Complete LSAG signature verification 
   - Full blockchain integration with transaction confirmation

## 🚀 Current Status & Next Steps

### **✅ COMPLETED PHASES:**
- **✅ Government Setup**: Certificate authority system working
- **✅ Certificate Generation**: PKS signatures for voter authorization  
- **✅ Phase 1 Registration**: Certificate storage on blockchain (`storePub`)
- **✅ Phase 2 Registration**: LSAG signature verification (`verify`) - **FIXED & WORKING**
- **✅ Ring Management**: Voter ring formation and membership tracking
- **✅ Smart Contract**: Fixed LSAG verification algorithm deployed

### **🔄 NEXT IMPLEMENTATION:**
- **Voting Phase**: Anonymous vote casting using LSAG signatures
- **Vote Encryption**: Encrypt votes for privacy before blockchain storage
- **Tallying Phase**: Decrypt and aggregate votes for final results
- **Multi-Voter Testing**: Scale testing with multiple registered voters
- **Complete E-Voting Workflow**: End-to-end voting system demonstration

### **📊 Technical Achievements:**
- **LSAG Signature Verification**: Fixed contract algorithm to properly validate signatures
- **Ring Signature Generation**: JavaScript implementation compatible with Solidity contract
- **Blockchain Integration**: Successful on-chain storage and verification
- **Gas Optimization**: Efficient smart contract operations (~163k-317k gas)
- **Unlinkability**: Proper linking tag generation for voter privacy

### Project Structure

```
scripts/
├── admin/
│   └── simple-setup.js              # Initial system configuration
├── registration/
│   ├── government-certificate-generator.js  # Core government certificate logic
│   ├── test-certificate-generation.js       # Generates certificates for 3 test voters
│   ├── test-complete-registration.js        # ✅ WORKING end-to-end registration
│   ├── test-multiple-registrations.js       # Multiple voter registration testing
│   └── voter-registration.js        # Core voter registration workflow  
├── utils/
│   ├── crypto-utils.js             # Core cryptographic functions
│   ├── blockchain-interface.js     # Contract interaction utilities
│   └── simple-lsag.js              # ✅ FIXED LSAG implementation
├── voting/                         # (Ready to implement)
├── tallying/                       # (Ready to implement)  
└── config/                         # Auto-generated configuration files
    ├── deployment.json             # Fixed contract config (0x8CA55089...)
    ├── government-config.json      # Government authority keys
    ├── voter-database.json         # Voter and certificate database
    └── complete-registration-success.json  # Successful registration records
```

## 🎯 Ready for Voting Phase Implementation

With the LSAG registration system **fully functional**, the e-voting system is now ready for the voting phase implementation. The foundation is solid with working certificate generation, LSAG signature verification, and blockchain integration.

