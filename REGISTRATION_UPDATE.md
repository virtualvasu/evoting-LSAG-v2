# Registration Phase Update - Certificate Format Enhancement

## Overview
Updated the EVoting system to accept certificates in the new format that includes voter name and student ID (sid), improving traceability and verification.

## Certificate Format

### New Format (JSON)
```json
{
  "voterName": "vasu g",
  "sid": "12342330",
  "voterPublicKey": "0x...",
  "signature": "0x...",
  "governmentPublicKey": "0x..."
}
```

### Contract Format (Solidity)
```solidity
struct Certificate {
    bytes sigma_tilde_v;   // Signature
    bytes P_ugov;          // Government public key
    bytes P_uv;            // Voter's public key
    string voterName;      // Voter's name
    string sid;            // Student/Voter ID
}
```

## Changes Made

### 1. EVoting Smart Contract ([contracts/Evoting.sol](contracts/Evoting.sol))
- **Updated Certificate struct**: Added `voterName` and `sid` fields
- **Modified pksVerifyCertificate()**: Now verifies signature of `hash(voterName + sid + voterPublicKey)` instead of just the public key
- **Updated createCertificate()**: Added parameters for voterName and sid

### 2. Crypto Utils ([scripts/utils/crypto-utils.js](scripts/utils/crypto-utils.js))
- **Enhanced createCertificate()**: Now accepts optional voterName and sid parameters
  - Signs: `hash(voterName + sid + voterPublicKey)` when provided
  - Maintains backward compatibility (signs just publicKey if name/sid not provided)
- **Fixed signMessageHash()**: Properly creates 65-byte signature (r + s + v format)
- **Fixed verifySignature()**: Handles signature as hex string properly for ethers v6

### 3. Government Certificate Generator ([scripts/registration/government-certificate-generator.js](scripts/registration/government-certificate-generator.js))
- **Updated generateCertificate()**: 
  - Now includes voterName and sid in certificate generation
  - Returns certificate in new format
  - Certificate hash now includes name and sid
- **Enhanced verifyCertificate()**: Supports both old and new certificate formats for backward compatibility

### 4. Voter Registration ([scripts/registration/voter-registration.js](scripts/registration/voter-registration.js))
- **Updated receiveCertificate()**: Accepts both old and new certificate formats
- **Modified submitCertificate()**: Sends certificate to blockchain with voterName and sid fields

### 5. Blockchain Interface ([scripts/utils/blockchain-interface.js](scripts/utils/blockchain-interface.js))
- **Updated storePub()**: Handles both old and new certificate format fields

## Verification Process

The contract now performs the following verification:
1. Check certificate has all required fields (signature, government public key, voter public key, voterName, sid)
2. Derive government address from public key
3. Create message hash: `keccak256(abi.encodePacked(voterName, sid, voterPublicKey))`
4. Apply Ethereum signed message prefix
5. Recover signer address from signature
6. Verify recovered address matches government address
7. If valid, add voter's public key to the ring

## Testing

Run the test script to verify certificate generation and verification:
```bash
node scripts/registration/test-new-certificate.js
```

This will:
- Generate government and voter keys
- Create a certificate with voterName and sid
- Verify the signature
- Save the certificate to `scripts/pre_registration/CERT_{sid}.json`
- Save voter keys to `scripts/pre_registration/VOTER_KEYS_{sid}.json`

## Next Steps

1. **Redeploy Contract**: Deploy the updated EVoting contract
   ```bash
   npx hardhat run ignition/modules/Evoting.ts --network localhost
   ```

2. **Generate Certificates**: Use government-certificate-generator.js to create certificates for eligible voters

3. **Register Voters**: Use the generated certificates to register voters on the blockchain via `storePub()`

4. **Complete LSAG Registration**: After public keys are stored, voters complete LSAG registration via `verify()`

## Backward Compatibility

The system maintains backward compatibility:
- Old format certificates (without voterName/sid) are still supported
- Verification functions check for new fields first, fall back to old format
- This allows gradual migration from old to new format

## Security Improvements

- **Enhanced Verification**: Signature now covers voterName and sid, preventing certificate reuse with different identities
- **Better Traceability**: Voter identity is cryptographically bound to their public key
- **Government Accountability**: Each certificate explicitly includes the government's public key
