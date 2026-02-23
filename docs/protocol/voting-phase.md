# Voting Phase Documentation

## Overview

The voting phase allows registered voters to cast their votes anonymously and securely on the blockchain. This implementation follows the protocol exactly as specified.

## Architecture

### Backend (Node.js Script)

**File**: `scripts/voting/generate-vote.js`

This script generates and casts votes from the command line.

### Frontend (Voter Portal)

**Files**:
- `voter-portal/lib/voting-service.ts` - Core voting logic
- `voter-portal/components/VotingInterface.tsx` - React component
- `voter-portal/app/vote/page.tsx` - Next.js page

## Usage

### Command Line (Backend)

```bash
NEW_PRIVATE_KEY=0x... CANDIDATE_CHOICE=A KV=<registration_index> node scripts/voting/generate-vote.js
```

**Parameters**:
- `NEW_PRIVATE_KEY`: The new private key (P_rv') generated during registration
- `CANDIDATE_CHOICE`: Your candidate choice (A, B, C, D, or E)
- `KV`: Your registration index from BB.verify

**Example**:
```bash
NEW_PRIVATE_KEY=0x65094df2e299ff0f2220ff6e22f09a049d12b2eceb7ad367e58d136c1e9a6e59 \
CANDIDATE_CHOICE=A \
KV=0 \
node scripts/voting/generate-vote.js
```

### Web Interface (Voter Portal)

1. Navigate to `http://localhost:3000/vote`
2. Connect your wallet
3. Enter your registration index (k_v)
4. Check if you have already voted
5. Enter your new private key (P_rv')
6. Select your candidate choice
7. Click "Generate Vote"
8. Review the vote data
9. Click "Cast Vote on Blockchain"

## Protocol Implementation

The voting phase follows this exact protocol:

### Step 1: Generate Vote (Client-side)

```
Input: NEW_PRIVATE_KEY (P_rv'), CANDIDATE_CHOICE (c), KV (k_v)

1. c = candidate choice (e.g., 'A')
2. r = random 32-byte number
3. h_v = keccak256(c || r)
4. σ_v' = PKS.sign(h_v, P_rv')
5. Output: (σ_v', h_v, k_v)
```

### Step 2: Cast Vote (Blockchain)

```
BB.voting(k, h_v, σ_v'):
1. Verify k < |T| (valid registration index)
2. Verify T[k][2] = 0 (voter hasn't voted yet)
3. Verify PKS.ver(h_v, T[k][1], σ_v') = 1 (valid signature)
4. T[k][2] := h_v (store vote hash)
5. Emit VoteCasted event
```

## Vote Data Structure

```typescript
{
  kv: number;                    // Registration index
  candidateChoice: string;       // 'A', 'B', 'C', 'D', or 'E'
  r: string;                     // Random 32-byte hex
  h_v: string;                   // Vote hash
  sigma_v_prime: {
    r: string;                   // Signature component r
    s: string;                   // Signature component s
    v: number;                   // Recovery byte (27 or 28)
  };
  timestamp: string;             // ISO timestamp
}
```

## Security Features

1. **Anonymity**: Vote hash (h_v) hides the actual vote using random r
2. **Authentication**: Only registered voter with valid k_v can vote
3. **Non-replayability**: Each k_v can only vote once (T[k][2] check)
4. **Integrity**: Signature σ_v' ensures vote wasn't tampered with
5. **Privacy**: Actual vote (c, r) is kept private until reveal phase

## Contract Functions

### BBvoting

```solidity
function BBvoting(
    uint256 k,      // Registration index
    bytes32 h,      // Vote hash
    bytes32 r,      // Signature r
    bytes32 s,      // Signature s
    uint8 v         // Signature v
) public returns (bool)
```

**Events**:
- `VoteCasted(uint256 indexed kv, bytes32 indexed voteHash)`

## Error Handling

The system handles these error cases:

1. **Invalid registration index**: k >= registrationTable.length
2. **Already voted**: T[k][2] != 0
3. **Invalid signature**: PKS.ver fails
4. **Invalid candidate**: Not in [A, B, C, D, E]
5. **Missing parameters**: Required fields not provided

## Files Generated

### Command Line
- `scripts/config/vote_<timestamp>.json` - Vote data saved locally

### Web Interface
- Downloads vote data as JSON file on user's computer

## Testing

### Check if Voter Has Already Voted

```javascript
const hasVoted = await votingService.hasVoted(kv);
console.log(hasVoted ? "Already voted" : "Can vote");
```

### Get Registration Entry

```javascript
const entry = await votingService.getRegistrationEntry(kv);
console.log("Vote hash:", entry.voteHash);
console.log("Public key:", entry.publicKey);
```

## Integration with Tally Phase

After voting closes, the tally phase will:
1. Request vote reveals from voters (c, r)
2. Verify h_v = keccak256(c || r)
3. Update results R[c]++

## Workflow Example

### Complete Flow

1. **Pre-registration**: Get certificate from government
2. **Ring Update**: Register public key via BB.storePub
3. **LSAG Registration**: Submit LSAG signature via BB.verify → receive k_v
4. **Generate Vote**: Create vote with new private key
5. **Cast Vote**: Submit to blockchain via BB.voting
6. **Wait for Tally**: Keep (c, r) private until reveal phase

## Candidates

The system supports 5 candidates:
- **A**: Candidate A
- **B**: Candidate B
- **C**: Candidate C
- **D**: Candidate D
- **E**: Candidate E

## Dependencies

### Backend (Node.js)
```json
{
  "ethers": "^6.x",
  "dotenv": "^16.x",
  "secp256k1": "^5.x"
}
```

### Frontend (Next.js)
```json
{
  "ethers": "^6.x",
  "next": "^14.x",
  "react": "^18.x"
}
```

## Environment Variables

### Backend (.env)
```bash
PRIVATE_KEY=0x...           # Admin/deployer private key (for tx fees)
NEW_PRIVATE_KEY=0x...       # Voter's new private key
CANDIDATE_CHOICE=A          # Candidate choice
KV=0                        # Registration index
```

## API Endpoints

### GET /api/contract
Returns contract configuration:
```json
{
  "address": "0x...",
  "abi": [...]
}
```

## Smart Contract Events

Listen for these events during voting:

```solidity
event VoteCasted(uint256 indexed kv, bytes32 indexed voteHash);
```

## Privacy Considerations

⚠️ **IMPORTANT**: 
- Keep your new private key (P_rv') secure
- Keep your vote reveal data (c, r) private until tally phase
- Never share your registration index (k_v) with the choice you made
- The vote hash (h_v) is public but doesn't reveal your choice

## Next Steps

After voting:
1. Wait for voting period to close
2. Participate in tally phase by revealing (c, r)
3. Verify your vote was counted correctly
4. Check final election results

## Troubleshooting

### "Invalid registration index"
- Verify your k_v is correct from registration
- Check you haven't made a typo

### "Voter has already voted"
- Each k_v can only vote once
- Check if you already voted with this registration

### "Invalid vote signature"
- Verify you're using the correct new private key (P_rv')
- Ensure the private key matches the public key in T[k_v][1]

### "Contract not initialized"
- Connect your wallet first
- Check contract address is correct

## Support

For issues or questions:
1. Check contract logs: `scripts/check-transaction.js`
2. Verify registration: `scripts/check-registration-table.js`
3. Check ring status: `scripts/check-ring.js`
