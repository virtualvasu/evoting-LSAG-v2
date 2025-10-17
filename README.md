# LSAG-Based E-Voting Smart Contract

This repository contains a simplified Solidity smart contract implementing an LSAG (Linkable Spontaneous Anonymous Group) based electronic voting system with essential on-chain functionality.

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

### Deployment with Hardhat Ignition

**1. Deploy to local network:**
```bash
npx hardhat ignition deploy ignition/modules/EVoting.ts --network hardhat
```

**2. Deploy to IITBH network:**
```bash
npx hardhat ignition deploy ignition/modules/EVoting.ts --network iitbh
```

**3. Deploy with verification:**
```bash
npx hardhat ignition deploy ignition/modules/EVoting.ts --network iitbh --verify
```

### Example Usage

```solidity
// 1. Deploy contract
EVoting eVoting = new EVoting();

// 2. Register voter (off-chain LSAG generation + on-chain storage)
bytes memory lsagSignature = generateLSAGSignature(voterKeys, ring);
bytes memory publicKey = extractPublicKey(lsagSignature);
eVoting.storePub(lsagSignature, publicKey);

// 3. Verify registration
bool isVerified = eVoting.verify(lsagSignature, publicKey);

// 4. Cast vote (off-chain encryption + on-chain submission)
bytes32 voteHash = keccak256(abi.encodePacked(candidateChoice, nonce));
bytes memory encryptedVote = encryptVote(candidateChoice, publicKey);
eVoting.voting(lsagSignature, voteHash, encryptedVote);

// 5. Tally vote (off-chain decryption + on-chain recording)
bytes memory decryptedCandidate = decryptVote(encryptedVote, privateKey);
bytes memory randomness = generateRandomness();
eVoting.tally(decryptedCandidate, randomness, voterSignature);
```

## Off-Chain Implementation Requirements

### Required Cryptographic Libraries
For production deployment, implement these off-chain components:

#### LSAG Implementation
```javascript
// Example structure for off-chain LSAG operations
class LSAGOperations {
    generateRingSignature(message, privateKey, publicKeyRing);
    verifyRingSignature(signature, message, publicKeyRing);
    extractKeyImage(signature);
    checkLinkability(signature1, signature2);
}
```

#### Vote Processing
```javascript
// Example structure for vote processing
class VoteProcessor {
    encryptVote(candidate, publicKey);
    decryptVote(encryptedVote, privateKey);
    generateCommitment(vote, randomness);
    verifyCommitment(vote, randomness, commitment);
}
```

#### Certificate Verification
```javascript
// Example structure for certificate operations
class CertificateVerifier {
    verifyGovernmentSignature(certificate, governmentPublicKey);
    extractVoterPublicKey(certificate);
    validateCertificate(certificate);
}
```

## Network Configuration

### Hardhat Config
```typescript
const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    iitbh: {
      url: 'http://10.10.0.60:8550',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
```

### Environment Setup
Create `.env` file:
```bash
PRIVATE_KEY=your_private_key_here
```

## Gas Optimization Features

- **Packed structs** for efficient storage
- **Event-based logging** for non-critical data
- **Minimal on-chain computation** (cryptography off-chain)
- **Efficient mapping structures** for quick lookups

## Security Considerations

### Smart Contract Security
- Reentrancy protection on all state-changing functions
- Input validation and sanitization
- Access control through existence checks
- Event emission for transparency

### Protocol Security
- **Anonymity**: LSAG signatures provide voter anonymity within rings
- **Unforgeability**: Only certified voters can participate
- **Linkability**: Double-voting detection through key images
- **Verifiability**: All operations recorded on immutable blockchain

### Recommended Security Audits
1. **Smart contract audit**: Review Solidity code for vulnerabilities
2. **Cryptographic audit**: Verify off-chain LSAG implementations
3. **Protocol audit**: Analyze complete voting protocol security
4. **Integration testing**: Test on-chain/off-chain interaction security

## Future Enhancements

### Potential Upgrades
- **Proxy pattern**: Enable contract upgrades while preserving state
- **Multi-signature authority**: Require multiple authorities for sensitive operations
- **Threshold decryption**: Distribute decryption keys among multiple parties
- **Zero-knowledge proofs**: Add ZK-SNARKs for enhanced privacy

### Scalability Improvements
- **Layer 2 deployment**: Deploy on Polygon/Arbitrum for lower gas costs
- **Batch operations**: Submit multiple votes in single transaction
- **State channels**: Handle high-frequency operations off-chain
- **IPFS integration**: Store large data off-chain with hash references

## Deployed Contract Address

**Network**: IITBH Testnet  
**Contract Address**: `[0xC8bB6C2A4f56DdE6fDCA134ad1642950876E0D07]`  
**Block Explorer**: `http://10.10.0.60:8550`

---

