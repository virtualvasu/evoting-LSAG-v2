# Key Management & Encryption System

## Overview

This document outlines the complete key lifecycle for the voter portal: creation, secure storage, encryption, management, and usage across the registration and voting phases.

The voter portal handles two critical cryptographic key pairs:
1. **Registration Key** - Used during pre-registration phase
2. **Voting Key** - Used during voting phase (up to 2 months later)

## Architecture

### Threat Model & Security Goals

- **Never expose private keys in UI** - No copy/paste operations, no textareas with raw keys
- **Protect keys at rest** - Encrypt keys using user's passphrase before storage
- **Protect keys in memory** - Clear key material after use or on timeout
- **Survive long dormancy** - Keys persist securely across 2-month gaps between registration and voting
- **Enable recovery** - User backup ensures keys are never permanently lost

### Storage Strategy

```
User Local Machine (Browser)
├── IndexedDB (Persistent)
│   └── Encrypted Key Pairs
│       ├── Registration Key (encrypted blob)
│       ├── Voting Key (encrypted blob)
│       └── Metadata (timestamps, fingerprints, labels)
└── Browser Memory (Temporary, during signing only)
    └── Decrypted keys cleared after use or ~10 min timeout
```

**Why IndexedDB?**
- Persists across browser close, tab close, device restart
- Survives 2-month gaps between pre-registration and voting phases
- Not cleared by default privacy cleanups (unlike SessionStorage)
- Larger quota than localStorage
- Supports transactions and structured data

## Key Management System

### Phase 1: Initial Setup (Pre-Registration)

#### 1.1 First-Time User Flow

1. **Generate Keys**
   - User clicks "Generate Registration Key"
   - System generates keypair (LSAG scheme specific)
   - Public key is displayed and ready for registration contract call
   - Private key is NOT shown to user

2. **Create Passphrase**
   - User is prompted: "Create a passphrase to protect your keys"
   - Requirements:
     - Minimum 12 characters
     - Mix of uppercase, lowercase, numbers, symbols
     - Entropy validation (reject common patterns)
   - Passphrase is NOT stored; only hash + salt are saved
   - User confirms passphrase by re-entering

3. **Encrypt & Store**
   - Registration key pair is encrypted using passphrase via `PBKDF2` or `Argon2`
   - Encrypted blob stored in IndexedDB with metadata:
     ```json
     {
       "id": "key-1",
       "type": "registration",
       "createdAt": "2026-01-20T10:30:00Z",
       "keyFingerprint": "abc123def456...",
       "label": "Registration Key (Jan 20)",
       "encryptedPayload": "base64-encrypted-blob",
       "salt": "base64-salt",
       "algorithm": "AES-256-GCM"
     }
     ```

4. **Generate Backup**
   - After passphrase confirmation, generate encrypted backup
   - Two backup options:
     - **JSON File**: Download `voter-backup-2026-01-20.json` (encrypted)
     - **QR Code**: Display scannable QR containing encrypted blob (for paper backup)
   - Backup file is ENCRYPTED with same passphrase—not usable without it
   - User prompt: "Save this backup in a safe location (USB drive, cloud, printed QR, password manager)"

#### 1.2 Pre-Registration Phase Usage

1. **Unlock Key** (when user needs to register)
   - User clicks "Start Registration"
   - System detects: "Registration key exists, locked"
   - Prompt: "Enter your passphrase to unlock your key"
   - User enters passphrase
   - System verifies passphrase hash matches stored salt
   - If correct: decrypt private key into memory only
   - If incorrect: error, no retry limit but UX discourages brute force (add 1-sec delay per attempt)

2. **Sign Registration Data**
   - Private key available in memory temporarily
   - Sign registration transaction (contract call payload)
   - Signature sent to blockchain
   - **Private key immediately cleared from memory**

3. **Auto-Lock After Use**
   - 10-minute inactivity timeout: key automatically cleared from memory
   - User can click "Lock Key" manually to clear immediately
   - Next action requires re-unlock passphrase

### Phase 2: Dormancy (Pre-Voting, 2-Month Gap)

**During this period:**
- Keys remain encrypted in IndexedDB
- Browser may be closed, device may restart, tab never opened
- User may uninstall/reinstall browser
- Keys are safe as long as:
  - Backup file is secure
  - Device is not compromised
  - IndexedDB not manually cleared

**User should:**
- Keep backup file safe (offline is better)
- Remember the passphrase (no recovery mechanism)

### Phase 3: Voting Phase (2+ Months Later)

#### 3.1 Voting Flow

1. **Open App on Voting Day**
   - User opens voter portal during voting period
   - System checks: "Voting key exists?"
   - Two cases:

   **Case A: Voting key exists (normal path)**
   - System displays "Voting Key is ready"
   - Show key metadata: created date, fingerprint for confirmation
   - UI indicates: "Locked"

   **Case B: Voting key doesn't exist (first time voting)**
   - User must generate voting key
   - Follow same flow as Phase 1 (generate → set passphrase → backup)

2. **Unlock Voting Key**
   - User clicks "Vote"
   - System prompts: "Enter passphrase to unlock voting key"
   - User enters passphrase (same one from pre-registration)
   - Verify against stored hash with salt
   - If correct: decrypt voting key into memory
   - If incorrect: error message, let user retry

3. **Cast Vote**
   - Private key in memory
   - Sign vote bundle (vote choice + LSAG signature)
   - Send signed data to contract
   - **Private key immediately cleared from memory**

4. **After Voting**
   - Key auto-locks after 10 min inactivity or user clicks "Lock"
   - Can vote multiple times?: depends on contract rules
   - If multiple voting allowed: user re-unlocks passphrase each time

#### 3.2 Multi-Key Management (Both Keys Exist)

- **UI Key Selector**: If user has both registration and voting keys
  - Show list: "Registration Key (locked)", "Voting Key (locked)"
  - User selects which key to unlock
  - Enter passphrase once → unlock selected key
  - Other key remains locked

## Passphrase & Recovery

### Passphrase Best Practices

- **Do NOT store passphrase anywhere**
- **Do NOT transmit passphrase to server**
- **Do NOT log passphrase in dev tools**
- System only stores `PBKDF2(passphrase, salt)` hash

### Recovery Scenarios

| Scenario | Solution | Outcome |
|----------|----------|---------|
| **User forgets passphrase** | No recovery mechanism by design | Must use backup file + try alternative passphrases; if all fail, keys are lost |
| **Browser data cleared accidentally** | User imports backup file | Backup file + passphrase → keys restored to new IndexedDB |
| **Device wiped** | User imports backup file on new device | Works same as above |
| **Backup file lost & passphrase forgotten** | No solution | Keys are permanently lost; must restart voting process |
| **Backup file compromised** | Not usable without passphrase | Attacker cannot decrypt without passphrase; user can rotate keys if pre-voting |

### Backup Import Flow

1. User clicks "Import Encrypted Backup"
2. User selects `voter-backup-YYYY-MM-DD.json` file
3. System prompts: "Enter passphrase for this backup"
4. System decrypts backup using passphrase
5. If correct: restore all keys to IndexedDB
6. If incorrect: error, let user retry

## Security Hardening

### Content Security Policy (CSP)

- Strict CSP for pages handling keys
- No inline scripts
- No third-party analytics on key management pages
- No automatic resource loading

### Logging & Debugging

- **Never log key material** (even in dev mode)
- Never log full passphrases or hashes
- If debugging: log only key IDs/fingerprints, not values
- Disable error telemetry on signing pages

### Session Management

- Keys exist only in memory during active session
- 10-minute inactivity timeout auto-locks keys
- Page visibility listener: lock keys when tab becomes hidden (user switches tabs)
- Window close: clear all memory

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-256, 100,000+ iterations (or Argon2id)
- **IV/Nonce**: Random per encryption
- **Supported Browsers**: All modern browsers (Web Crypto API)

## Implementation Checklist

### Core Components Needed

```
voter-portal/
├── lib/
│   ├── key-encryption-service.ts       # Encrypt/decrypt with passphrase
│   ├── key-storage-service.ts          # IndexedDB CRUD operations
│   ├── key-backup-service.ts           # Export/import encrypted backups
│   └── key-lifecycle-manager.ts        # Orchestrate key states
│
├── components/
│   ├── KeyGenerationFlow.tsx           # First-time key generation
│   ├── PassphraseSetup.tsx             # Create passphrase
│   ├── BackupKeyUI.tsx                 # Show backup options (JSON/QR)
│   ├── KeyUnlockModal.tsx              # Passphrase entry & unlock
│   ├── KeyManagementDashboard.tsx      # View key status, labels, backup
│   └── KeyImportFlow.tsx               # Import from backup file
│
└── app/
    ├── setup-keys/                     # First-time setup pages
    ├── manage-keys/                    # Key management dashboard
    └── voting/                         # Updated to integrate key unlock
```

### Usage Example Flow

**Pre-Registration:**
```
1. User opens voter portal → "First time? Generate registration key"
2. [KeyGenerationFlow] → Generate keypair
3. [PassphraseSetup] → User creates passphrase
4. [BackupKeyUI] → User downloads/scans backup
5. Keys stored encrypted in IndexedDB
6. User navigates to registration contract call
7. [KeyUnlockModal] → User enters passphrase
8. Registration key decrypted in memory → signing → cleared
```

**Voting (2 months later):**
```
1. User opens voter portal during voting period
2. System detects: "Voting key exists"
3. User clicks "Vote"
4. [KeyUnlockModal] → User enters passphrase (same as pre-reg)
5. Voting key decrypted in memory → signing → cleared
6. Vote submitted to contract
```

**Backup Recovery:**
```
1. User's browser cache cleared or device wiped
2. User reinstalls app, opens portal
3. System detects: "No keys found"
4. "Import Backup?" → [KeyImportFlow]
5. User selects backup JSON file
6. System decrypts with passphrase
7. Keys restored to IndexedDB
8. Ready to use
```

## Testing Scenarios

- [ ] Generate registration key → verify stored encrypted in IndexedDB
- [ ] Set passphrase → verify hash stored (not plaintext)
- [ ] Unlock key with correct passphrase → verify decryption
- [ ] Unlock key with wrong passphrase → verify rejection
- [ ] Sign transaction with unlocked key → verify signature
- [ ] Lock key → verify memory cleared
- [ ] 10-min timeout → verify auto-lock
- [ ] Tab hidden → verify keys cleared
- [ ] Browser close → verify keys persist on re-open
- [ ] Export backup → verify encrypted JSON
- [ ] Import backup → verify all keys restored
- [ ] Import with wrong passphrase → verify rejection
- [ ] Device wipe simulation → delete IndexedDB, import backup

## Future Enhancements

- [ ] Hardware wallet integration (Ledger, Trezor) for key generation
- [ ] Biometric unlock (fingerprint, Face ID) for passphrase supplement
- [ ] Key rotation mechanism (re-encrypt with new passphrase)
- [ ] Multi-device sync (encrypted key sync to other user devices)
- [ ] Shareable encrypted key escrow (trusted third party holds encrypted backup)

## User Documentation

### For Voters

- **Quick Start**: How to generate your first key and create a passphrase
- **Voting Day**: How to unlock your key and cast your vote
- **Backup**: Where to store your backup and why it matters
- **Forgot Passphrase**: What to do (recover from backup, or restart voting)
- **Lost Device**: How to restore keys on a new device

## Compliance & Audit

- [ ] No plaintext keys stored anywhere
- [ ] No key material in logs or dev tools
- [ ] CSP enforced on sensitive pages
- [ ] Encryption algorithm verified (AES-256-GCM standard)
- [ ] Passphrase hashing verified (PBKDF2 100k+ iterations)
- [ ] Memory clearing verified (no keys in heap after logout)
- [ ] IndexedDB permissions (origin-specific, no third-party access)

---

**Last Updated**: March 2026  
**Status**: Architecture & Design (awaiting implementation)
