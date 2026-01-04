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

### Phase 1.5: Pre-Registration (Optional)
```bash
node scripts/pre_registration/pre-register-voter.js
```
**Voter provides**:
- Name
- Public Key (64 bytes)
- Student ID

**Output**:
- Government signature (65 bytes) signed with government's private key
- Saved to `pre-registration-{studentId}.json`

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

### Phase 3: Vote Casting (Anonymous)
```bash
node scripts/voting/1-cast-vote.js VOTER_001 Candidate_X
node scripts/voting/1-cast-vote.js VOTER_002 Candidate_Y
node scripts/voting/1-cast-vote.js VOTER_003 Candidate_X
```
- Off-chain: Creates commitment `h_v = H(candidate || randomness)`
- Off-chain: Signs with voter's private key: `σ'_v = PKS.sign(h_v, Pr_v)`
- On-chain: Submits `(σ'_v, h_v, k_v)` via `voting()` (~28k gas/vote)
- Off-chain: Saves anonymous reveals to `vote-reveals.json` (no voter ID!)
- **Result**: 3 anonymous votes cast ✅

↓

### Phase 4: Vote Tallying (Anonymous)
```bash
node scripts/voting/2-tally-votes.js
```
- Loads anonymous reveals from `vote-reveals.json`
- **Shuffles votes** to break temporal correlation
- For each vote: reveals `(candidate, randomness)` to contract
- Contract verifies: `H(candidate || randomness) == h_v`
- Submits via `tally(c, r, k_v)` (~28k gas/vote)
- Displays only "Processing vote X/Y" (no candidate revealed during tally)
- Counts votes and determines winner
- **Result**: Candidate_X wins with 2 votes (66.7%) 🏆
- **Privacy**: No voter ID linkage, shuffled processing - truly anonymous!
