# LSAG-Based E-Voting Smart Contracts

This repository contains three Solidity smart contracts implementing a complete LSAG (Linkable Spontaneous Anonymous Group) based electronic voting system following a secure multi-phase protocol.

## Contract Overview

### 1. RegistrationContract.sol (Steps 0-1)
**Purpose**: Handle certificate storage and election setup

**Key Features**:
- Store government-verified voter certificates
- Setup election parameters (ID, candidates, random challenge)
- Verify certificate authenticity using PKS signatures
- Access control for election authority

**Main Functions**:
- `storePub()`: Store voter certificates with government verification
- `storePollParams()`: Setup election parameters (authority only)
- `isCertified()`: Check if a public key is certified

### 2. VoterRegistrationContract.sol (Step 2)
**Purpose**: Handle anonymous voter registration with LSAG signatures

**Key Features**:
- Anonymous voter registration using LSAG signatures
- Linkability prevention (no double registration)
- Key image tracking for LSAG linkability
- Integration with RegistrationContract for certificate verification

**Main Functions**:
- `verify()`: Register voter with LSAG signature verification
- `isRegistered()`: Check voter registration status
- `getVoterCount()`: Get total registered voters

### 3. VotingAndTallyingContract.sol (Steps 3-4)
**Purpose**: Handle vote casting and tallying phases

**Key Features**:
- Secure vote casting with hash-based verification
- Vote tallying with signature verification
- Phase management (voting → tallying → finalized)
- Result aggregation and reporting

**Main Functions**:
- `voting()`: Cast votes during voting phase
- `tally()`: Tally votes during tallying phase
- `startVotingPhase()`, `startTallyingPhase()`, `finalizeResults()`: Phase management
- `getTallyResults()`: Get final vote counts

## Protocol Flow

### Phase 0-1: Setup and Registration
1. Deploy `RegistrationContract` with election authority address
2. Election authority calls `storePollParams()` to setup election
3. Eligible voters submit certificates via `storePub()`

### Phase 2: Voter Registration
1. Deploy `VoterRegistrationContract` with reference to `RegistrationContract`
2. Certified voters call `verify()` with LSAG signatures to register anonymously
3. System prevents double registration through key image tracking

### Phase 3: Voting
1. Deploy `VotingAndTallyingContract` with references to previous contracts
2. Election authority calls `startVotingPhase()`
3. Registered voters call `voting()` to cast votes with hash commitments

### Phase 4: Tallying and Results
1. Election authority calls `startTallyingPhase()`
2. Voters reveal actual votes via `tally()` function
3. Election authority calls `finalizeResults()` to complete the process

## Security Features

### Reentrancy Protection
All contracts include custom reentrancy guards to prevent reentrancy attacks:
```solidity
modifier nonReentrant() {
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
    _status = _ENTERED;
    _;
    _status = _NOT_ENTERED;
}
```

### Access Control
- Election authority controls: phase transitions, election setup
- Voter-only functions: certificate submission, registration, voting
- Public view functions: result queries, registration checks

### Input Validation
- All functions validate input parameters
- Empty signatures/keys rejected
- Invalid voter indices handled
- Duplicate operations prevented

## Deployment Guide

### Prerequisites
- Solidity ^0.8.28
- Hardhat development environment
- Node.js and npm

### Deployment Steps

1. **Deploy RegistrationContract**:
```solidity
RegistrationContract registrationContract = new RegistrationContract(electionAuthorityAddress);
```

2. **Deploy VoterRegistrationContract**:
```solidity
VoterRegistrationContract voterRegistrationContract = new VoterRegistrationContract(address(registrationContract));
```

3. **Deploy VotingAndTallyingContract**:
```solidity
VotingAndTallyingContract votingContract = new VotingAndTallyingContract(
    address(voterRegistrationContract),
    address(registrationContract)
);
```

### Example Usage

```solidity
// 1. Setup election
bytes32 electionId = keccak256("ELECTION_2025");
bytes32[] memory candidates = [
    keccak256("CANDIDATE_ALICE"),
    keccak256("CANDIDATE_BOB")
];
bytes32 randomChallenge = keccak256("CHALLENGE_2025");

registrationContract.storePollParams(electionId, candidates, randomChallenge);

// 2. Store voter certificate
RegistrationContract.Certificate memory cert = RegistrationContract.Certificate({
    governmentSignature: governmentSig,
    governmentPublicKey: governmentPubKey,
    voterPublicKey: voterPubKey
});
registrationContract.storePub(cert);

// 3. Register voter
uint256 voterIndex = voterRegistrationContract.verify(lsagSignature, votingPublicKey);

// 4. Start voting and cast vote
votingContract.startVotingPhase();
votingContract.voting(signatureOnHash, voteHash, voterIndex);

// 5. Start tallying and tally vote
votingContract.startTallyingPhase();
votingContract.tally(actualVoteSignature, voterIndex);

// 6. Finalize results
votingContract.finalizeResults();
(bytes32[] memory finalCandidates, uint256[] memory voteCounts) = votingContract.getTallyResults();
```

## Testing

The `LSAGVotingSystemTest.sol` contract provides comprehensive testing functionality:

```solidity
// Deploy test contract with existing contract addresses
LSAGVotingSystemTest testContract = new LSAGVotingSystemTest(
    address(registrationContract),
    address(voterRegistrationContract),
    address(votingContract)
);

// Run complete test suite
testContract.runCompleteTest();
```

## Important Notes

### Cryptographic Implementations
The current implementation uses placeholder cryptographic functions for:
- PKS signature verification
- LSAG signature verification and linkability checking
- Key image extraction

**For production use**, replace these with actual cryptographic library implementations:
- Use elliptic curve cryptography libraries for PKS operations
- Implement proper LSAG verification against rings of certified public keys
- Use proper key image extraction from LSAG signatures

### Gas Optimization
- Functions use packed structs where possible
- Events are used for data that doesn't require on-chain storage
- Efficient storage patterns implemented

### Error Handling
- Comprehensive error messages for debugging
- Graceful handling of edge cases
- Event emission for failed operations

## Events

### RegistrationContract
- `CertificateStored(bytes indexed voterPublicKey)`
- `ElectionSetup(bytes32 indexed electionId, uint256 candidateCount)`

### VoterRegistrationContract
- `VoterRegistered(uint256 indexed voterIndex, bytes votingPublicKey)`
- `RegistrationRejected(bytes lsagSignature, string reason)`

### VotingAndTallyingContract
- `VoteCast(uint256 indexed voterIndex, bytes32 voteHash)`
- `VoteTallied(uint256 indexed voterIndex, bytes32 indexed candidate)`
- `PhaseChanged(string phase, bool active)`
- `ResultsFinalized(bytes32[] candidates, uint256[] voteCounts)`

# Deployed Addresses (Sepolia)

- RegistrationContractModule#RegistrationContract - 0x06c9851653714e4a2664B2949C64c91E6a28D215

- VoterRegistrationContractModule#VoterRegistrationContract - 0x199e781F7799D74b160DA6736eFEb9D3dBB15ABc

- VotingAndTallyingContractModule#VotingAndTallyingContract - 0x5Cf752f6931c70fB7CdAf4354B718facf9d2F778

