# LSAG-Based E-Voting System

**Contract Address**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

---

## Election Flow

### Phase 0: Deploy Contract
```bash
npx hardhat ignition deploy ignition/modules/Evoting.ts --network localhost
```
- Deploys EVoting.sol to blockchain
- Returns contract address

↓

### Phase 1: System Setup
```bash
node scripts/admin/simple-setup.js
```
- Creates config directory
- Generates government authority keys (ECDSA)
- Saves `deployment.json` and `government-config.json`

↓

### Phase 2: Voter Registration
```bash
node scripts/registration/register-existing-voters.js
```
- Loads voters: Alice, Bob, Carol
- Government signs each voter's public key
- Submits certificates via `storePub()` (~32k gas/voter)
- **Result**: 3 voters registered ✅

↓

### Phase 3: Vote Casting
```bash
node scripts/voting/1-cast-vote.js VOTER_001 Candidate_A
node scripts/voting/1-cast-vote.js VOTER_002 Candidate_B
node scripts/voting/1-cast-vote.js VOTER_003 Candidate_A
```
- Creates commitment: `h_v = H(candidate || randomness)`
- Signs with voter's private key
- Submits via `voting()` (~28k gas/vote)
- Saves to `cast-votes.json`
- **Result**: 3 votes cast ✅

↓

### Phase 4: Vote Tallying
```bash
node scripts/voting/2-tally-votes.js
```
- Reveals `(candidate, randomness)` for each vote
- Contract verifies: `H(candidate || randomness) == h_v`
- Submits via `tally()` (~27k gas/vote)
- Counts votes and determines winner
- **Result**: Candidate_A wins with 2 votes (66.7%) 🏆
