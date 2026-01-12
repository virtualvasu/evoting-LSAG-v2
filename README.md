# LSAG-Based E-Voting System

**Contract Address**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

---

## Election Flow

### Phase 0: Deploy Smart Contracts

**Step 0a: Deploy Secp256k1 Library** (REQUIRED FIRST)
```bash
npx hardhat run scripts/deploy-secp256k1.js --network localhost
```
**Output**: Secp256k1 contract address (needed by EVoting)

**Step 0b: Deploy EVoting Contract**
```bash
npx hardhat ignition deploy ignition/modules/Evoting.ts --network localhost
```
**Output**: EVoting contract address (uses Secp256k1 library)

↓

### Phase 1: System Setup
```bash
node scripts/admin/simple-setup.js
```
- Creates config directory
- Generates government authority keys (ECDSA)
- Saves `deployment.json` and `government-config.json`

↓

### Phase 1.5: Voter Registration (LSAG-based)

**Step 1: Generate Key Pair**
```bash
node scripts/generate-keypair.js
```
**Output**: Private key + Public key (64 bytes) - save both ✅

**Step 2: Pre-Register with Government**
```bash
node scripts/pre_registration/pre-register-voter.js
```
**Input**: Voter name, public key (from Step 1), student ID  
**Output**: `CERT_<sid>.json` (government-signed certificate) ✅

**Step 3: Update Voter Ring**
```bash
node scripts/registration_new/update_voter_ring.js scripts/pre_registration/CERT_<sid>.json
```
**Output**: Voter added to ring, returns ring members + voter position ✅

**Step 4: Generate LSAG Signature**
```bash
ORIGINAL_PRIVATE_KEY=0x... REGISTERED_PUBLIC_KEY=0x... VOTER_NAME="..." VOTER_SID="..." \
npx hardhat run scripts/registration_new/generate-lsag-signature.js --network localhost
```
**Output**: `LSAG_<sid>.json` (signature proving ring membership) ✅

**Step 5: Submit Registration (BBverify)**
```bash
LSAG_FILE=scripts/pre_registration/LSAG_<sid>.json \
npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost
```
**Output**: **Kv (Registration Index)** - voter is now registered & can vote ✅

↓

### Phase 2: Vote Casting (Anonymous)
```bash
node scripts/voting/1-cast-vote.js VOTER_001 Candidate_X
```
- Off-chain: Creates commitment `h_v = H(candidate || randomness)`
- Off-chain: Signs with voter's private key
- On-chain: Submits commitment + signature via `voting()` (~28k gas/vote)
- Off-chain: Saves anonymous reveals to `vote-reveals.json`
- **Result**: Anonymous votes cast, voter ID not linked ✅

↓

### Phase 3: Vote Tallying (Anonymous)
```bash
node scripts/voting/2-tally-votes.js
```
- Loads anonymous reveals from `vote-reveals.json`
- **Shuffles votes** to break temporal correlation
- For each vote: reveals `(candidate, randomness)` to contract
- Contract verifies: `H(candidate || randomness) == h_v`
- Counts votes and determines winner
- **Result**: Candidate_X wins with 2 votes (66.7%) 🏆
- **Privacy**: No voter ID linkage, shuffled processing - truly anonymous!

### The evoting protocol is currently under implmentations via this project, most of the parts may look rushed, this is simple because it's faster this way.

### Project structure and docs would be improved as the project develops.
