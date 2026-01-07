# New Registration Process (LSAG-based)

This directory contains the updated registration flow that follows the LSAG protocol as shown in the registration phase diagram.

## Registration Flow Overview

```
┌─────────────┐
│   Voter     │
│ (CERTᵥ, Pᵥ) │
└──────┬──────┘
       │
       │ Step 1: Pre-registration (already completed)
       │ - Certificate generated: CERTᵥ
       │ - Keys generated: (Pᵥ, sᵥ)
       │
       ├─────────► Step 2: Update Voter Ring
       │           - Submit CERTᵥ to blockchain
       │           - Blockchain verifies certificate
       │           - Get updated ring: Pₑₗ
       │
       ├◄──────────┘ Pₑₗ (Voter Ring)
       │
       │ Step 3: Generate Voting Credentials
       │ - Generate new key pair: (P'ᵤᵥ, s'ᵥ)
       │ - Sign ring with LSAG: σᵥ
       │ - Get key image: Iᵥ
       │
       ├─────────► Step 4: Complete Registration
       │           - Submit LSAG signature to blockchain
       │           - Blockchain verifies: LSAG.verify(Pₑₗ, Pᵤᵥ, σᵥ) = 1
       │           - Check abort conditions
       │
       ├◄──────────┘ bᵥ (Registration confirmed)
       │
       └─────────► Ready to vote!
```

## Scripts

### Step 2: `update_voter_ring.js`

Submits the voter's certificate to the blockchain and retrieves the updated voter ring.

**Usage:**
```bash
node scripts/registration_new/update_voter_ring.js <certificate_path>
```

**Example:**
```bash
node scripts/registration_new/update_voter_ring.js scripts/pre_registration/CERT_12342330.json
```

**What it does:**
1. Loads voter's certificate (generated in pre-registration)
2. Connects to the deployed EVoting contract
3. Submits certificate via `storePub()` function
4. Retrieves updated voter ring from blockchain
5. Saves the voter ring to voter's keys file for Step 3
6. Returns the voter ring and transaction details

**Output:**
- Updates `VOTER_KEYS_<SID>.json` with the voter ring
- Console output showing transaction hash and ring members

---

### Step 3: `generate_voting_credentials.js`

Generates the voter's voting credentials (new key pair + LSAG signature).

**Usage:**
```bash
node scripts/registration_new/generate_voting_credentials.js <certificate_path>
```

**Example:**
```bash
node scripts/registration_new/generate_voting_credentials.js scripts/pre_registration/CERT_12342330.json
```

**What it does:**
1. Loads voter's certificate and registration keys
2. Retrieves the voter ring (from Step 2)
3. Generates NEW key pair for voting: (P'ᵤᵥ, s'ᵥ)
   - This is separate from registration keys
   - Used only for casting votes
4. Creates LSAG signature proving voter is in the ring
   - Uses original registration private key (sᵥ)
   - Signs the voter ring to prove membership
   - Generates key image (Iᵥ) for linkability
5. Saves voting credentials securely

**Output:**
- Creates `voting_credentials/VOTING_CREDS_<SID>.json` with:
  - Voting private key (s'ᵥ) - **KEEP SECRET!**
  - Voting public key (P'ᵤᵥ)
  - LSAG signature (σᵥ)
  - Key image (Iᵥ)
  - Voter ring snapshot

**⚠️ Security Warning:**
The voting credentials file contains the private voting key. Keep it secure! Anyone with this key can cast votes on behalf of the voter.

---

### Step 4: `complete_registration.js` (Coming Soon)

Submits the LSAG signature to the blockchain to complete registration.

**What it will do:**
1. Load voting credentials from Step 3
2. Submit LSAG signature to blockchain
3. Blockchain verifies the signature
4. Registration is complete - voter can now cast votes

---

## File Structure

```
registration_new/
├── update_voter_ring.js              # Step 2: Submit cert, get ring
├── generate_voting_credentials.js    # Step 3: Generate voting keys + LSAG
└── complete_registration.js          # Step 4: Submit LSAG to blockchain (TODO)

voting_credentials/                    # Created by Step 3
└── VOTING_CREDS_<SID>.json           # Voter's private voting credentials

pre_registration/                      # From initial setup
├── CERT_<SID>.json                   # Voter's certificate
└── VOTER_KEYS_<SID>.json             # Voter's registration keys (updated in Step 2)
```

## Key Concepts

### Two Sets of Keys

1. **Registration Keys** (generated in pre-registration):
   - Used to prove identity and get into the voter ring
   - Public key stored on blockchain
   - Private key used to generate LSAG signature in Step 3

2. **Voting Keys** (generated in Step 3):
   - Used ONLY for casting votes
   - Completely separate from registration keys
   - Provides anonymity - voting key not linked to identity
   - Private key never shared with blockchain

### LSAG Signature

The LSAG (Linkable Spontaneous Anonymous Group) signature:
- Proves voter is a member of the voter ring
- Does NOT reveal which member they are (anonymity)
- Includes a key image to prevent double registration
- Links voting credentials to the ring without revealing identity

### Voter Ring (Pₑₗ)

The voter ring is the list of all registered voters' public keys:
- Retrieved from blockchain after certificate submission
- Used as the "ring" in LSAG signature
- Voter proves membership without revealing position
- Updated as more voters register

## Complete Example Flow

```bash
# Assuming pre-registration is complete and you have:
# - scripts/pre_registration/CERT_12342330.json
# - scripts/pre_registration/VOTER_KEYS_12342330.json

# Step 2: Submit certificate and get voter ring
node scripts/registration_new/update_voter_ring.js scripts/pre_registration/CERT_12342330.json

# Output: Voter ring saved to VOTER_KEYS_12342330.json

# Step 3: Generate voting credentials
node scripts/registration_new/generate_voting_credentials.js scripts/pre_registration/CERT_12342330.json

# Output: Voting credentials saved to voting_credentials/VOTING_CREDS_12342330.json

# Step 4: Complete registration (coming soon)
node scripts/registration_new/complete_registration.js voting_credentials/VOTING_CREDS_12342330.json
```

## Next Steps

After completing all registration steps, the voter will have:
- ✅ Certificate verified and stored on blockchain
- ✅ Position in the voter ring
- ✅ Voting key pair for anonymous vote casting
- ✅ LSAG signature proving ring membership
- ✅ Ready to cast anonymous votes!

## Troubleshooting

### "Voter ring not found"
- Make sure you ran Step 2 (update_voter_ring.js) first
- Check that VOTER_KEYS_<SID>.json exists and contains voterRing

### "Voter public key not found in ring"
- The certificate submission (Step 2) may have failed
- Check the transaction hash and blockchain logs
- Verify contract address in deployment.json

### "Private key not found"
- Make sure VOTER_KEYS_<SID>.json exists from pre-registration
- This file should contain the voter's private registration key

## Security Notes

1. **Private Keys**: Never share private keys or voting credentials
2. **Voting Credentials**: The VOTING_CREDS file is highly sensitive
3. **LSAG Signature**: Proves ring membership without revealing identity
4. **Key Image**: Prevents double registration/voting
5. **Separation**: Registration keys ≠ Voting keys (by design)
