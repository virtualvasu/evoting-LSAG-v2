# 🗳️ E-Voting System - Complete Voting Guide

This guide explains how to perform the complete voting process step by step.

---

## 📋 Prerequisites

Before voting, ensure:
- ✅ Voters are registered (Alice, Bob, Carol)
- ✅ Contract deployed at: `0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E`
- ✅ Hardhat node is running on `localhost:8545`

---

## 🎯 Voting Process Overview

The voting system has **2 main phases**:

### **Phase 1: Cast Votes** 
Voters submit their encrypted votes with commitments

### **Phase 2: Tally Votes**
Votes are revealed and counted to determine the winner

---

## 📝 PHASE 1: Cast Votes

Each registered voter casts their vote for a candidate.

### Step 1: Cast Alice's Vote

```bash
node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A
```

This will:
- Load Alice's credentials
- Create vote commitment: `H(Candidate_A || randomness)`
- Sign the commitment with Alice's private key
- Submit to blockchain via `voting()` function
- Save vote details for tallying

### Step 2: Cast Bob's Vote

```bash
node scripts/voting/1-cast-vote.js VOTER_002 Candidate_B
```

### Step 3: Cast Carol's Vote

```bash
node scripts/voting/1-cast-vote.js VOTER_003 Candidate_A
```

### Available Candidates

You can vote for any candidate name (e.g., "Candidate_A", "Candidate_B", "Alice_For_President", etc.)

---

## 📊 PHASE 2: Tally Votes

After all votes are cast, tally them to see the results.

### Run Tally Script

```bash
node scripts/voting/2-tally-votes.js
```

This will:
- Load all cast votes from `cast-votes.json`
- Reveal each vote by submitting `(candidate, randomness)` to the `tally()` function
- Contract verifies: `H(candidate || randomness) == stored_vote_hash`
- Count votes per candidate
- Display final results with winner

---

## 📂 Generated Files

The voting process creates these files in `scripts/config/`:

- **`cast-votes.json`** - Records of all cast votes with encryption details
- **`tally-results.json`** - Final tally results with vote counts and winner

---

## 🔍 Verify Votes On-Chain

You can verify votes directly using Hardhat console:

```bash
npx hardhat console --network localhost
```

```javascript
const contract = await ethers.getContractAt("EVoting", "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E");

// Check if a voter has voted
const voterKey = "0x..."; // voter's public key
await contract.hasVoted(voterKey);

// Check if a vote has been tallied
await contract.isTallied(encryptedVote);

// Get total registrations
await contract.getTotalRegistrations();
```

---

## 🎓 How It Works

### Vote Commitment Scheme

1. **Voting Phase:**
   - Voter chooses candidate and generates random value `r`
   - Computes commitment: `h_v = H(candidate || r)`
   - Signs `h_v` with private key → `sigma_v'`
   - Submits `(sigma_v', h_v, k_v)` where `k_v` is encrypted vote data

2. **Tallying Phase:**
   - Voter (or authority) reveals `(candidate, r)`
   - Contract verifies: `H(candidate || r) == h_v` (stored hash)
   - If match → vote is valid and counted

This ensures:
- **Privacy**: During voting, only hash is stored (candidate is hidden)
- **Integrity**: Hash commitment prevents vote changes
- **Verifiability**: Anyone can verify the tally matches commitments

---

## 🚨 Common Issues

### "Voter not registered"
- Make sure registration was completed successfully
- Check that voter's public key is stored in `complete-registration-success.json`

### "Vote already cast"
- Each voter can only vote once
- Check `cast-votes.json` to see who has already voted

### "No vote found for this voter key"
- Vote must be cast before tallying
- Verify the vote was successfully submitted in Phase 1

### "Vote integrity check failed"
- The revealed `(candidate, r)` doesn't match the commitment hash
- This indicates tampered data - should not happen in normal operation

---

## 📊 Example Complete Flow

```bash
# 1. Cast votes (3 voters)
node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A
node scripts/voting/1-cast-vote.js VOTER_002 Candidate_B  
node scripts/voting/1-cast-vote.js VOTER_003 Candidate_A

# 2. Tally votes
node scripts/voting/2-tally-votes.js

# Output will show:
# Candidate_A: 2 votes (66.7%)
# Candidate_B: 1 vote (33.3%)
# Winner: Candidate_A
```

---

## 🎯 Next Steps

After completing voting:
1. Review `tally-results.json` for detailed results
2. Verify on-chain using Hardhat console
3. Archive the election data
4. Start a new election by redeploying the contract

---

## 📞 Need Help?

If you encounter issues:
1. Check Hardhat node is running
2. Verify contract address in `deployment.json`
3. Ensure all voters are registered
4. Check console output for detailed error messages
