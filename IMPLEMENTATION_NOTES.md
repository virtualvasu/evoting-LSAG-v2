# EVoting with Secp256k1 LSAG Implementation

## Summary

Successfully integrated the proven LSAG verification implementation from UntraceableVoting.sol into the EVoting contract while maintaining **exact function signatures**.

## Deployed Contracts

- **Secp256k1 Library**: `0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690`
  - Provides elliptic curve operations (ScalarMult, ScalarBaseMult, HashToPoint, Add)
  - Modernized from Solidity 0.4.2 to 0.8.20
  
- **EVoting Contract**: `0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB`
  - Uses Secp256k1 library for LSAG verification
  - Implements proven verification algorithm from UntraceableVoting

## Implementation Details

### Function Signatures (Maintained Exactly as Specified)

```solidity
// LSAG signature structure
struct LSAGSignature {
    uint256 keyImageX;
    uint256 keyImageY;
    uint256 c;
    uint256[] s;
}

// Main verification functions
function LSAGver(uint256 electionId, LSAGSignature memory lsagSig) 
    public view returns (bool)

function LSAGlinkVer(LSAGSignature memory sig1, LSAGSignature memory sig2) 
    public pure returns (bool)

function BBverify(uint256 electionId, LSAGSignature memory lsagSig, bytes memory voterPubKey) 
    public returns (uint256 kv)
```

### Verification Algorithm

The LSAGver function now uses the **proven algorithm** from UntraceableVoting:

```solidity
// For each ring member i:
1. Compute L = [s[i]]G + [c]Pi
2. Compute R = [s[i]]H(Pi) + [c]I
3. Hash to get next challenge: c' = H(electionId, Li, Ri)
4. Verify ring closure: ci[ringSize % 2] == lsagSig.c
```

Key improvements:
- Uses Secp256k1 contract functions (battle-tested implementation)
- Follows exact algorithm from working reference implementation
- Uses alternating challenge array `ci[0]` and `ci[1]` pattern
- Proper ring closure verification

## Next Steps: JavaScript Integration

Now you need to write JavaScript that generates LSAG signatures matching this exact format.

### Option 1: Study Reference Implementation

1. Look at how the reference implementation generates signatures
2. Check if they use SHA256 or keccak256
3. Verify point compression format
4. Match the challenge computation exactly

### Option 2: Write Fresh Implementation

Based on the Solidity verification logic:

```javascript
// LSAG Signature Generation (pseudocode)
function generateLSAG(message, privateKey, publicKey, ring, signerIndex) {
    // 1. Compute key image: I = x·H(P)
    const I = privateKey * hashToPoint(publicKey);
    
    // 2. Generate random alpha
    const alpha = randomScalar();
    
    // 3. Compute L[signerIndex] = alpha·G
    const L_alpha = alpha * G;
    
    // 4. Compute R[signerIndex] = alpha·H(P_signer)
    const R_alpha = alpha * hashToPoint(publicKey);
    
    // 5. Start challenge from next member
    let c = keccak256(message, L_alpha, R_alpha);
    
    // 6. Loop through ring (skipping signer initially)
    const s = [];
    for (let i = (signerIndex + 1) % n; i != signerIndex; i = (i + 1) % n) {
        const s_i = randomScalar();
        s[i] = s_i;
        
        // L = s[i]·G + c·P[i]
        const L = s_i * G + c * ring[i];
        
        // R = s[i]·H(P[i]) + c·I
        const R = s_i * hashToPoint(ring[i]) + c * I;
        
        // Next challenge
        c = keccak256(message, L, R);
    }
    
    // 7. Close the ring at signer position
    s[signerIndex] = alpha - c * privateKey (mod n);
    
    return { I, c_initial, s };
}
```

### Key Points to Match

1. **Hash Function**: Use `keccak256` (same as Solidity `keccak256(abi.encodePacked(...))`)
2. **HashToPoint**: Must match `Secp256k1.HashToPoint(Px, Py)` behavior
3. **Point Format**: Uncompressed coordinates (32 bytes X, 32 bytes Y)
4. **Challenge Computation**: `keccak256(electionId, Lix, Liy, Rix, Riy)`
5. **Ring Order**: Match the order in voterRing array

## Testing Workflow

1. **Register voters** (populate ring):
   ```bash
   npx hardhat run scripts/registration/register-existing-voters.js --network localhost
   ```

2. **Generate LSAG signature** (JavaScript):
   - Create script matching the algorithm above
   - Ensure exact format match with Solidity verification

3. **Submit signature**:
   ```bash
   npx hardhat run scripts/registration_new/submit-lsag-registration.js --network localhost
   ```

## Files Modified/Created

### Contracts
- `contracts/Secp256k1.sol` - New: Modernized EC operations library
- `contracts/Evoting.sol` - Updated: Uses Secp256k1 library with proven LSAG verification

### Scripts
- `scripts/deploy-secp256k1.js` - New: Deploy Secp256k1 library
- `scripts/deploy-evoting.js` - New: Deploy EVoting with Secp256k1 dependency
- `scripts/test-deployment.js` - New: Verify deployment and test basic functions

### Configuration
- `scripts/config/deployment.json` - Updated: Contains both contract addresses

## Benefits of This Approach

1. ✅ **Proven Algorithm**: Uses working implementation from UntraceableVoting
2. ✅ **Exact Function Signatures**: Maintained all your specified function signatures
3. ✅ **Proper EC Operations**: Uses battle-tested Secp256k1 contract
4. ✅ **Clean Separation**: Secp256k1 library can be reused for other contracts
5. ✅ **Easier Debugging**: Isolated EC operations from LSAG logic

## Current Status

- ✅ Secp256k1 deployed and tested
- ✅ EVoting deployed and linked to Secp256k1
- ✅ Basic tests passing
- ⏳ Need to write JavaScript LSAG generation matching Solidity verification
- ⏳ Need to test end-to-end registration flow
