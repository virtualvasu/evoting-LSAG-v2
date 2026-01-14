# Government Frontend - Standalone Webapp Architecture

## Overview

The government frontend is now a **completely standalone webapp** with all business logic embedded directly in the application. It no longer depends on external scripts from the main project.

### Key Principle
**NO external script calls** - All logic is ported directly into the frontend codebase and can be modified independently.

---

## Architecture

### 1. Crypto Utilities Library (`lib/crypto-utils.ts`)

**Purpose**: Cryptographic operations for certificate generation

**Ported from**: `scripts/utils/crypto-utils.js`

**Functions**:
- `signVoterCredentials()` - Signs voter details with government private key
  - Input: voterName, voterStudentId, voterPublicKey, governmentPrivateKey
  - Output: 65-byte signature (r + s + v)
  - Uses: Solidity-compatible packed encoding + Ethereum personal_sign

- `verifySignature()` - Verifies government signature
  - Input: voter details, signature, governmentAddress
  - Output: boolean (true if valid)
  - Uses: Ethereum address recovery

**Dependencies**:
- `ethers.js` - Ethereum cryptography library

---

### 2. Pre-Registration Service (`lib/pre-registration-service.ts`)

**Purpose**: Business logic for voter pre-registration

**Ported from**: `scripts/pre_registration/pre-register-voter.js` (without interactive prompts)

**Main Class**: `PreRegistrationService`

**Key Methods**:

#### `validatePublicKey(publicKey: string)`
- Validates 128 hex character (64 byte) format
- Handles optional 0x prefix and 04 prefix removal
- Returns: `{ isValid, cleanedKey, error }`

#### `validateVoterDetails(details)`
- Comprehensive validation of name, studentId, publicKey
- Returns: `{ isValid, error }`

#### `loadGovernmentConfig(configPath: string)`
- Reads government-config.json
- Validates required fields: privateKey, address, publicKey
- Throws error if missing or invalid

#### `generateCertificate(voterDetails, governmentConfig)`
- Orchestrates signing process
- Validates inputs
- Generates signature
- Verifies signature before returning
- Returns: `{ certificate, signature }`

#### `saveCertificate(certificate, outputDir)`
- Saves certificate as `CERT_<studentId>.json`
- Creates directory if needed
- Returns: file path

#### `preRegisterVoter(voterDetails, govConfigPath, certificateOutputDir)`
- **Main entry point** - Orchestrates complete flow
- Loads config → generates certificate → saves to file
- Returns: `{ certificate, filePath, signature }`

**Certificate Format**:
```json
{
  "voterName": "John Voter",
  "sid": "12340450",
  "voterPublicKey": "0x...",
  "signature": "0x...",
  "governmentPublicKey": "0x..."
}
```

---

### 3. API Route (`app/api/pre-register/route.ts`)

**Purpose**: HTTP endpoint for pre-registration requests from frontend UI

**Ported from**: `scripts/pre_registration/pre-register-voter.js` (interactive prompts → HTTP endpoint)

**Request**:
```json
{
  "name": "John Voter",
  "publicKey": "0x...",
  "studentId": "12340450"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Voter ... successfully pre-registered. Certificate generated.",
  "certificate": { ... },
  "studentId": "12340450",
  "filePath": "/path/to/CERT_12340450.json",
  "signatureLength": 132
}
```

**Response (Error)**:
```json
{
  "error": "Error message explaining what went wrong"
}
```

**Process**:
1. Validate inputs
2. Load government config from `scripts/config/government-config.json`
3. Use PreRegistrationService to generate and sign certificate
4. Save to `scripts/pre_registration/CERT_<sid>.json`
5. Return certificate to frontend

---

## File Structure

```
government-frontend/
├── app/
│   ├── api/
│   │   └── pre-register/
│   │       └── route.ts              ← API endpoint
│   └── ...
├── lib/
│   ├── crypto-utils.ts               ← Cryptographic functions
│   └── pre-registration-service.ts   ← Business logic
├── components/
│   └── PreRegistration.tsx           ← UI component
└── ...
```

---

## How It Works

### Pre-Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Government Frontend UI                                      │
│ (PreRegistration.tsx component)                             │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/pre-register
                     │ { name, publicKey, studentId }
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ API Route (route.ts)                                        │
│ 1. Validate inputs                                          │
│ 2. Parse request                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PreRegistrationService                                      │
│ 1. Validate voter details & public key format              │
│ 2. Load government config from filesystem                   │
│ 3. Generate certificate                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ CryptoUtils                                                 │
│ 1. Sign voter details with gov private key                 │
│ 2. Verify signature                                         │
│ Return: signature                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PreRegistrationService (continued)                          │
│ 1. Save certificate to filesystem                          │
│ Return: { certificate, filePath, signature }               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ JSON response
┌─────────────────────────────────────────────────────────────┐
│ Frontend UI                                                 │
│ 1. Display certificate                                      │
│ 2. Offer download as JSON                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Inputs Required
1. **Voter Name** - String, non-empty
2. **Public Key** - 128 hex chars (64 bytes) or 0x prefixed, may have 04 prefix
3. **Student ID** - String, non-empty

### Processing
1. **Validation** - Check format and lengths
2. **Normalization** - Remove prefixes, lowercase
3. **Signature Generation** - Using government private key
4. **Verification** - Ensure signature is valid before saving
5. **Storage** - Save to JSON file

### Output
- **Certificate JSON** - All voter details + signature
- **File Path** - Where certificate was saved
- **Response to Client** - Certificate data + metadata

---

## Environment Requirements

### Required Files (in main project)
- `scripts/config/government-config.json` - Government keys
  ```json
  {
    "address": "0x...",
    "publicKey": "0x...",
    "privateKey": "0x...",
    "createdAt": "..."
  }
  ```

### Directory Structure
```
evoting-LSAG-v2/
├── scripts/
│   ├── config/
│   │   └── government-config.json    ← Must exist
│   └── pre_registration/
│       └── CERT_*.json               ← Output goes here
└── government-frontend/
    ├── app/api/pre-register/route.ts
    ├── lib/
    │   ├── crypto-utils.ts
    │   └── pre-registration-service.ts
    └── ...
```

---

## Setup Instructions

### 1. Ensure Government Config Exists
```bash
cd /path/to/evoting-LSAG-v2
node scripts/admin/simple-setup.js
```
This creates `scripts/config/government-config.json` with government keys.

### 2. Start Government Frontend
```bash
cd government-frontend
npm install  # if needed
npm run dev
```

### 3. Test Pre-Registration
1. Open http://localhost:3000
2. Fill in test voter data:
   - Name: "Test Voter"
   - Public Key: (128 hex characters)
   - Student ID: "12345"
3. Click "Pre-Register"
4. Certificate displays on screen
5. Click download button

### 4. Verify Certificate Created
```bash
ls scripts/pre_registration/CERT_12345.json
cat scripts/pre_registration/CERT_12345.json
```

---

## Key Differences from Script

| Aspect | Script | Frontend |
|--------|--------|----------|
| Input | Interactive prompts (readline) | HTTP POST request |
| Error Handling | Console errors | HTTP error responses |
| Output | File + Console | File + HTTP response |
| Dependencies | Node.js CLI | Next.js server |
| Extensibility | Modify script | Modify TypeScript code |

---

## Future Modifications

Since all logic is now embedded:

1. **Change signature algorithm** - Modify `CryptoUtils.signVoterCredentials()`
2. **Add new fields to certificate** - Update `Certificate` interface
3. **Change validation rules** - Modify `PreRegistrationService.validateVoterDetails()`
4. **Add new functionality** - Add methods to PreRegistrationService
5. **No version sync issues** - Frontend has its own copy of logic

---

## Version Control

### This is NOT the original script
The government frontend contains **a copy and modification** of:
- `scripts/pre_registration/pre-register-voter.js` (removed interactive prompts)
- `scripts/utils/crypto-utils.js` (ported to TypeScript)

### Independent Development
- Modifications to the frontend version do **NOT** affect the main script
- Modifications to the main script do **NOT** affect the frontend
- Each can evolve independently

---

## Benefits

✅ **Truly Standalone** - No external script dependencies
✅ **Type-Safe** - Full TypeScript implementation
✅ **Easy to Modify** - All logic in accessible TypeScript files
✅ **Testable** - Service layer can be unit tested
✅ **Performant** - No subprocess overhead
✅ **Version Control** - Frontend code in frontend repository
✅ **API-Based** - HTTP interface instead of CLI prompts

---

## Troubleshooting

### Error: "Government configuration not found"
**Solution**: Run `node scripts/admin/simple-setup.js` to create config

### Error: "Invalid public key length"
**Solution**: Public key must be 128 hex characters (64 bytes)
- ✓ `a1b2c3...` (128 chars)
- ✓ `0xa1b2c3...` (with 0x prefix)
- ✓ `04a1b2c3...` (with 04 prefix for uncompressed point)
- ✗ `a1b2c3` (too short)

### Error: "Signature verification failed"
**Solution**: Government config or key is corrupted. Regenerate using `simple-setup.js`

### Certificate not saved
**Solution**: Check that `scripts/pre_registration/` directory exists and is writable

---

## Summary

The government frontend is now a **production-ready standalone webapp** with:
- ✅ All business logic embedded
- ✅ Cryptographic signing with government keys
- ✅ No external script calls
- ✅ TypeScript type safety
- ✅ Proper error handling
- ✅ REST API interface
- ✅ Clean architecture with separated concerns

You can now modify and extend it independently of the main project scripts.
