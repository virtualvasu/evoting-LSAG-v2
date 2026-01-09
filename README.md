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

### Phase 1.5: Pre-Registration
```bash
node scripts/pre_registration/pre-register-voter.js
```
**Voter provides**:
- Name
- Public Key (64 bytes)
- Student ID

**Output**: Government-signed certificate `CERT_<sid>.json` with format:
```json
{
  "voterName": "string",
  "sid": "string",
  "voterPublicKey": "0x...",
  "signature": "0x...",
  "governmentPublicKey": "0x..."
}
```
- Signature: 65 bytes (130 hex chars) signed with government's private key
- Voter takes this certificate to Bulletin Board (BB) for registration


##Update voter ring

CERT_PATH=scripts/pre_registration/CERT_12342330.json npx hardhat run scripts/registration_new/update_voter_ring.js --network localhost

##update LSAG signature

 ORIGINAL_PRIVATE_KEY=0x219b0a0ca69114e5e070494561742870aa70a3a15e5ac6b97b8f2b86e5113b61 REGISTERED_PUBLIC_KEY=0x70b51ec2aeb6b4933d4a0a88199f5c26f9bb2541dfbf6685f80d303a8afb9c9ad690c9d274a61dd9b3b93ff29a14433e10af1fc5f88d3b0cf5170368205085fb VOTER_NAME="vasu g" VOTER_SID="12342330" npx hardhat run scripts/registration_new/generate-lsag-signature.js --network localhost

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
