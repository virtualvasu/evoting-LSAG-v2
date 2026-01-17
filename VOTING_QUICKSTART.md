# Quick Start: Voting Phase

## Option 1: Command Line (Backend)

### Step 1: Prepare Your Information
```bash
# From your LSAG registration, you should have:
NEW_PRIVATE_KEY=0x65094df2e299ff0f2220ff6e22f09a049d12b2eceb7ad367e58d136c1e9a6e59
KV=0  # Your registration index from BB.verify
```

### Step 2: Run the Script
```bash
cd /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2

NEW_PRIVATE_KEY=0x65094df2e299ff0f2220ff6e22f09a049d12b2eceb7ad367e58d136c1e9a6e59 \
CANDIDATE_CHOICE=A \
KV=0 \
node scripts/voting/generate-vote.js
```

### Step 3: Review Output
```
🗳️  Generate Vote
======================================================================

✓ Input parameters validated
  Candidate choice: A
  Registration index (k_v): 0
  New private key: 0x65094df2e299ff0f...

✓ Candidate selected: A
✓ Generated random number r
✓ Generated hash h_v = keccak256(c || r)
✓ Generated PKS signature sigma_v_prime

======================================================================
✅ Vote generated successfully!

Vote Data:
{
  "kv": 0,
  "candidateChoice": "A",
  "r": "0x...",
  "h_v": "0x...",
  "sigma_v_prime": {
    "r": "0x...",
    "s": "0x...",
    "v": 27
  },
  "timestamp": "2026-01-17T..."
}

📁 Vote saved to: /path/to/vote_1737123456789.json

======================================================================
📡 Casting vote on-chain...
  Transaction hash: 0x...
  Waiting for confirmation...
  ✅ Vote cast successfully!
  Gas used: 150000
======================================================================
```

---

## Option 2: Web Interface (Voter Portal)

### Step 1: Start the Portal
```bash
cd voter-portal
npm run dev
```

### Step 2: Open in Browser
Navigate to: **http://localhost:3000/vote**

### Step 3: Connect Wallet
Click: **"🔐 Connect Wallet"**
- MetaMask will prompt for connection
- Approve the connection request

### Step 4: Enter Registration Details
Fill in the form:
1. **Registration Index (k_v)**: `0` (from your LSAG registration)
2. Click **"Check Status"** to verify you haven't voted
3. **New Private Key**: `0x65094df2e299ff0f2220ff6e22f09a049d12b2eceb7ad367e58d136c1e9a6e59`
4. **Candidate Choice**: Click on `A`, `B`, `C`, `D`, or `E`

### Step 5: Generate Vote
Click: **"🎲 Generate Vote"**

The system will:
- Generate random `r`
- Calculate `h_v = keccak256(c || r)`
- Create signature `σ_v' = PKS.sign(h_v, P_rv')`

### Step 6: Review Vote
You'll see:
- Registration Index: `0`
- Candidate: `A`
- Vote Hash: `0x...`
- Signature details (expandable)
- Timestamp

### Step 7: Cast Vote
Click: **"📤 Cast Vote on Blockchain"**

MetaMask will prompt:
- Review gas fees
- Confirm transaction
- Wait for confirmation

### Step 8: Success!
You'll see:
```
✅ Vote cast successfully!
Transaction: 0x...
Gas used: 150000
```

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    VOTING PHASE FLOW                        │
└─────────────────────────────────────────────────────────────┘

Registration Phase Complete ✓
         │
         ├─ You have: k_v (registration index)
         └─ You have: P_rv' (new private key)
         
         ↓
         
┌────────────────────┐
│  Generate Vote     │
│  ──────────────    │
│  1. Choose c       │  ← Candidate (A, B, C, D, E)
│  2. Generate r     │  ← Random 32 bytes
│  3. h_v = H(c||r)  │  ← Vote hash
│  4. σ_v' = sign    │  ← Signature
└────────────────────┘
         │
         ↓
┌────────────────────┐
│   Review Vote      │
│  ──────────────    │
│  • k_v: 0          │
│  • c: A            │
│  • h_v: 0x...      │
│  • σ_v': {...}     │
└────────────────────┘
         │
         ↓
┌────────────────────┐
│   Cast on Chain    │
│  ──────────────    │
│  BB.voting(        │
│    k_v,            │
│    h_v,            │
│    σ_v'            │
│  )                 │
└────────────────────┘
         │
         ↓
┌────────────────────┐
│ Contract Verifies  │
│  ──────────────    │
│  ✓ k_v valid       │
│  ✓ Not voted yet   │
│  ✓ Signature valid │
│  → T[k_v][2] := h_v│
└────────────────────┘
         │
         ↓
┌────────────────────┐
│   Vote Recorded    │
│  ──────────────    │
│  ✅ Success!       │
│  Event emitted     │
│  Gas: ~150k        │
└────────────────────┘
```

---

## Important: Keep These Private!

```
🔒 DO NOT SHARE:
   • P_rv' (new private key)
   • c (your candidate choice)
   • r (random number)
   • The combination of k_v + candidate

🔓 PUBLIC (on blockchain):
   • k_v (registration index)
   • h_v (vote hash) - doesn't reveal choice
   • σ_v' (signature)
```

---

## Troubleshooting

### Error: "Voter has already voted"
- Each k_v can only vote once
- Check if you already submitted a vote
- Use a different registration if needed

### Error: "Invalid vote signature"
- Verify you're using the correct P_rv'
- Ensure the private key matches the public key registered at T[k_v][1]

### Error: "Invalid registration index"
- Verify your k_v is correct
- Check it's the value returned from BB.verify

### Error: "Contract not initialized"
- Connect your wallet first (web interface)
- Check contract address in config

### Transaction Failed
- Check you have enough gas
- Verify network connection
- Check contract is deployed

---

## Next: Reveal Phase

After voting closes:
1. Keep your `(c, r)` safe
2. Wait for reveal phase announcement
3. Submit `(c, r)` to prove your vote
4. Contract verifies: `keccak256(c || r) === h_v`
5. Your vote is counted: `R[c]++`

---

## Commands Summary

```bash
# Check if voted
node scripts/check-registration-table.js

# View ring
node scripts/check-ring.js

# View transaction
node scripts/check-transaction.js

# Generate and cast vote
NEW_PRIVATE_KEY=0x... CANDIDATE_CHOICE=A KV=0 node scripts/voting/generate-vote.js

# Start web interface
cd voter-portal && npm run dev
```

---

## Files Location

- **Vote data**: `scripts/config/vote_<timestamp>.json`
- **Contract config**: `scripts/config/deployment.json`
- **LSAG data**: `scripts/pre_registration/LSAG_<sid>.json`

---

That's it! You're ready to vote! 🗳️
