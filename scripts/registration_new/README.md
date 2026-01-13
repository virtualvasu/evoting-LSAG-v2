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


-------------------------------------------

 node scripts/generate-keypair.js
Generating new secp256k1 key pair...

✅ New Key Pair Generated:

Private Key:
  0x11c681176c8c1ed70e6d87e9924e3c84a905dee0cf5401d92c41ff4d7e6b4d0a

Public Key (64 bytes, uncompressed):
  0x72f176d8fa78b3c1fafaf3dce1d17020b84e297f7569396afbc7837ff3f4dfd1ce9ed5deb6616af922c93d97696c912a012624adcbf88beb9466a16b4cf4b356

Public Key X:
  0x72f176d8fa78b3c1fafaf3dce1d17020b84e297f7569396afbc7837ff3f4dfd1

Public Key Y:
  0xce9ed5deb6616af922c93d97696c912a012624adcbf88beb9466a16b4cf4b356

──────────────────────────────────────────────────────────────────────
Save these values! You'll need:
1. Private Key: for signing LSAG signatures
2. Public Key: for registration in the voter ring
──────────────────────────────────────────────────────────────────────

✓ Verification: PASSED
❯ node scripts/pre_registration/pre-register-voter.js
🏛️  Pre-Registration Service initialized
Government Address: 0xcBe9CfD1ECE95Cc47A24533F11fA05DDEddb5fAA

📋 Voter Pre-Registration
==================================================
Enter voter name: test voter 2
Enter voter public key (64 bytes hex, with or without 0x): 0x72f176d8fa78b3c1fafaf3dce1d17020b84e297f7569396afbc7837ff3f4dfd1ce9ed5deb6616af922c93d97696c912a012624adcbf88beb9466a16b4cf4b356
Enter student ID: 12345555

🔐 Generating signature...

✅ Signature Generated!
Signature: 0x7b2f3c25bba6fc1d5ea85ee6e98fb56942b55f6d48d7cd57c44a2224cb68f8595d13d04a8275d2bff6b99b3822adcc723b889f206cb982ef69fdeb692d2c087f1b
Signature Length: 65 bytes

🔍 Verifying signature...
✅ Signature verification PASSED

✅ Certificate saved to: CERT_12345555.json

📊 Pre-Registration Summary
==================================================
Voter Name: test voter 2
Student ID: 12345555
Public Key: 0x72f176d8fa78b3c1fafaf3dce1d17020b84e297f7569396afbc7837ff3f4dfd1ce9ed5deb6616af922c93d97696c912a012624adcbf88beb9466a16b4cf4b356
Signature: 0x7b2f3c25bba6fc1d5ea85ee6e98fb56942b55f6d48d7cd57c44a2224cb68f8595d13d04a8275d2bff6b99b3822adcc723b889f206cb982ef69fdeb692d2c087f1b
Signature Length: 65 bytes
Government Address: 0xcBe9CfD1ECE95Cc47A24533F11fA05DDEddb5fAA
❯ node scripts/registration_new/update_voter_ring.js scripts/pre_registration/CERT_12345555.json

📋 Update Voter Ring

======================================================================

📄 Loading certificate from: /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2/scripts/pre_registration/CERT_12345555.json

✓ Certificate loaded
  Voter: test voter 2
  SID: 12345555
  Public Key: 0x72f176d8fa78b3c1fa...
Connected wallet: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

📡 Connected to contract: 0x998abeb3E57409262aE5b751f60747921B33613E
👤 Using signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

📊 Current ring size: 2

📤 Submitting certificate to contract...
  Transaction hash: 0xa01ce1bcf7c3b1f5da4e4ea6ea8dde1f6c3d33722b909520f3ef86a603520d64
  Waiting for confirmation...
  ✅ Transaction confirmed!
  Gas used: 222118

📊 Updated ring size: 3

🔐 Updated Voter Ring:
======================================================================
  [0] 0x0bf82e5907c7db04ab6bf2ec12f96fbe225ca6db3f201ac00b8360ba084cea80
  [1] 0x64e53b9dac85d07fc6e2f071519c8eb5d3ac1690ae98e993f4a249b2ffae5734
  [2] 0x75c385adac59003cc37b28237c7151b84abba86007e3cfea6f794c9f0b66bf64

======================================================================
✅ Voter added to ring successfully!
   Voter: test voter 2 (12345555)
   Position in ring: 2
======================================================================

🚀 Next step:
  Run: node scripts/registration_new/generate_voting_credentials.js /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2/scripts/pre_registration/CERT_12345555.json

❯ 
ORIGINAL_PRIVATE_KEY=0x11c681176c8c1ed70e6d87e9924e3c84a905dee0cf5401d92c41ff4d7e6b4d0a REGISTERED_PUBLIC_KEY=0x72f176d8fa78b3c1fafaf3dce1d17020b84e297f7569396afbc7837ff3f4dfd1ce9ed5deb6616af922c93d97696c912a012624adcbf88beb9466a16b4cf4b356 VOTER_NAME="test voter 2" VOTER_SID="12345555" npx hardhat run scripts/registration_new/generate-lsag-signature.js --network localhost

🔐 Generate LSAG Signature

======================================================================

✓ Input parameters validated
  Voter: test voter 2
  SID: 12345555
  Private Key: 0x11c681176c8c1ed70e...
  Registered Public Key: 0x72f176d8fa78b3c1fa...

📡 Connected to contract: 0x998abeb3E57409262aE5b751f60747921B33613E

📊 Fetching voter ring...
  Ring size: 3
  ✓ Found voter at position 2 in ring

🔑 Generating new PKS key pair...
  ✓ New key pair generated
  Public Key: 0xa5d8902e787799b931...

🔐 Generating LSAG signature using original private key...
  ✓ Using ORIGINAL private key for LSAG signature
  ✓ Signing election ID: election_001
Generating simple LSAG signature...
  Ring size: 3
  Signer index: 2
  ✓ Key image computed
  ✓ Random alpha generated
  ✓ Initial challenge at position 0
  ✓ Ring closed at position 2
✅ Simple LSAG signature generated
  c[0]: 0xb834bf41c178b8b5...
  ✓ LSAG signature generated
  Key Image X: 0x9a7691f381a24f8a367c93b6dad329974b49aecdaffaaafff47030f9106027dc
  Key Image Y: 0xebf14a1afcbee2794e952aa84db7e6ce47582d539976db9016ecf658f736c3a5
  Challenge c[0]: 0xb834bf41c178b8b50279c247f054652ef9e2d392fbb24f3fddffb9d1c72d4025
  Responses: 3 values

📤 Signature saved to: /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2/scripts/pre_registration/LSAG_12345555.json

======================================================================
✅ LSAG Signature generated successfully!
   Voter: test voter 2 (12345555)
   Election ID: election_001
   New Public Key: 0xa5d8902e787799b931...
   Key Image X: 0x9a7691f381a24f8a...
   Key Image Y: 0xebf14a1afcbee279...
======================================================================

❯ 
❯ LSAG_FILE=scripts/pre_registration/LSAG_12345555.json npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost

📝 Submit LSAG Registration (BB.verify)

======================================================================

📂 Loading LSAG signature from: /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2/scripts/pre_registration/LSAG_12345555.json
  ✓ Loaded signature for voter: test voter 2 (12345555)

📡 Connected to contract: 0x998abeb3E57409262aE5b751f60747921B33613E
  Signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

🔑 Key Image:
  X: 0x9a7691f381a24f8a367c93b6dad329974b49aecdaffaaafff47030f9106027dc
  Y: 0xebf14a1afcbee2794e952aa84db7e6ce47582d539976db9016ecf658f736c3a5

📋 LSAG Signature Parameters:
  Election ID: election_001
  Election ID (hash): 0x3880f3ec42b6e388c0b850db1c7ce8111cdf912870acad8b8e02d7ac03561595
  Challenge c: 0xb834bf41c178b8b50279c247f054652ef9e2d392fbb24f3fddffb9d1c72d4025
  Responses s: 3 values

🆕 New Public Key: 0xa5d8902e787799b931...

🔐 Calling BBverify function...
  This will:
  1. Verify LSAG signature
  2. Check for double registration
  3. Add to registration table

⏳ Transaction submitted: 0x99b1a2fe2adcbb59c99b6db4f03922fb982d2d34b07f5ea28f5d0125ee9a01a9
  Waiting for confirmation...

✅ Transaction confirmed!
  Block: 57
  Gas used: 9399573

🎉 Registration Successful!
  Registration Index (kv): 2
  Voter Public Key: 0xa5d8902e787799b931...

💾 Registration result saved to: /home/virtualvasu/Desktop/evoting_project/evoting-LSAG-v2/scripts/config/registration_result_12345555.json

======================================================================
✅ BB.verify Registration Complete!
   Voter: test voter 2 (12345555)
   Registration Index (kv): 2
   New Public Key: 0xa5d8902e787799b931...
======================================================================
