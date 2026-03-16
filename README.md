# LSAG-Based E-Voting System

> **Professional Blockchain Voting Platform** with Anonymous Authentication and Zero-Knowledge Privacy

[![Network Status](https://img.shields.io/badge/Network-IITBH%20Blockchain-blue)](http://10.10.0.61:8550)
[![Smart Contract](https://img.shields.io/badge/Contract-0xED8CAB...fD23E-green)](#smart-contract)
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Monorepo-orange)](#architecture)

---

## Architecture Overview

This project is organized as a **professional modular monorepo** with three distinct, focused modules:

```
evoting-lsag-v2/
├── blockchain/           # Smart contracts, deployment, and blockchain infrastructure
├── voter-portal/         # Voter interface and participation tools
├── government-portal/    # Administrator dashboard and election management
├── docs/                # Centralized documentation hub
├── shared/              # Common utilities and types
└── README.md            # This file
```

### Core Design Principles

- **Zero Server Architecture** - Only voter's machine + blockchain smart contract  
- **Anonymous Voting** - LSAG (Linkable Spontaneous Anonymous Group) signatures  
- **Cryptographic Privacy** - No vote content stored on blockchain  
- **Modular Design** - Clean separation of concerns  
- **Developer Experience** - Professional tooling and documentation  

---

## Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **MetaMask** wallet extension
- **Git** for version control

### 1. **Clone Repository**
```bash
git clone <repository-url>
cd evoting-lsag-v2
```

### 2. **Setup Blockchain Module**
```bash
cd blockchain
npm install
npx hardhat compile
```

### 3. **Deploy Smart Contracts** (Admin Only)
```bash
# Deploy Secp256k1 library first
npx hardhat run scripts/deploy/deploy-secp256k1.js --network iitbh

# Deploy main EVoting contract
npx hardhat ignition deploy ignition/modules/Evoting.ts --network iitbh
```

### 4. **Start Government Portal**
```bash
cd government-portal
npm install
npm run dev
# Access: http://localhost:3000
```

### 5. **Start Voter Portal**
```bash
cd voter-portal  
npm install
npm run dev
# Access: http://localhost:3001
```

---

## Module Overview

### Blockchain Module
**Location**: [`blockchain/`](blockchain/)  
**Purpose**: Smart contract infrastructure, deployment, and blockchain utilities

**Key Components:**
- **Solidity Contracts** - Core voting logic with LSAG verification
- **Deployment Scripts** - Automated contract deployment
- **Monitoring Tools** - Election status and transaction checking
- **Configuration** - Network settings and contract addresses

**Documentation**: [`blockchain/README.md`](blockchain/README.md)

---

### Voter Portal  
**Location**: [`voter-portal/`](voter-portal/)  
**Purpose**: Complete voter experience from registration to vote casting

**Key Features:**
- **Key Generation** - Secure cryptographic keypair creation
- **Certificate Upload** - Government-signed voter authentication
- **LSAG Registration** - Anonymous registration with ring signatures  
- **Vote Casting** - Private vote generation and submission
- **Vote Tallying** - Collaborative result computation

**Documentation**: [`voter-portal/README.md`](voter-portal/README.md)

---

### Government Portal
**Location**: [`government-portal/`](government-portal/)  
**Purpose**: Election administration and voter certificate management  

**Key Features:**
- **Voter Certification** - Generate cryptographically signed certificates
- **Election Management** - Full lifecycle election control
- **Ring Management** - Voter ring construction and verification
- **Result Monitoring** - Real-time election status dashboard

**Documentation**: [`government-portal/README.md`](government-portal/README.md)

---

### Documentation Hub
**Location**: [`docs/`](docs/)  
**Purpose**: Centralized, comprehensive project documentation

**Structure:**
- **Architecture** - System design and module interactions
- **Protocol** - LSAG signature scheme and voting protocol
- **Guides** - Step-by-step user and developer guides  
- **Implementation** - Technical implementation details
- **API Reference** - Smart contract and frontend APIs

---

### Shared Resources
**Location**: [`shared/`](shared/)  
**Purpose**: Common utilities to avoid code duplication

**Contents:**
- **Types** - TypeScript interfaces and type definitions
- **Constants** - Shared configuration and constants
- **Utils** - Cross-module utility functions

---

## Election Workflow

### Phase 1: **Setup** (Government)
1. Deploy smart contracts using blockchain module
2. Generate government authority keypair
3. Launch government portal for administration

### Phase 2: **Registration** (Voters + Government)  
1. Voters generate cryptographic keypairs
2. Government issues signed voter certificates
3. Voters upload certificates to blockchain (ring formation)
4. Voters generate LSAG signatures for anonymous registration

### Phase 3: **Voting** (Voters)
1. Generate anonymous votes with LSAG proofs
2. Submit encrypted vote hashes to blockchain
3. Store vote data locally for later tallying

### Phase 4: **Tallying** (Collaborative)
1. Voters reveal vote data for verification
2. Blockchain verifies vote integrity 
3. Results computed and announced transparently

---

## Development

### Workspace Commands

```bash
# Install all dependencies
npm run install:all

# Build blockchain module
npm run build:blockchain

# Build voter portal
npm run build:voter

# Build government portal  
npm run build:gov

# Start development servers
npm run dev:voter
npm run dev:gov
```

### Module-Specific Development

**Blockchain Module:**
```bash
cd blockchain
npm run compile    # Compile contracts
npm run deploy     # Deploy to network
npm run test       # Run contract tests
npm run verify     # Verify on explorer
```

**Frontend Modules:**
```bash
cd voter-portal    # or government-portal
npm run dev        # Start development server  
npm run build      # Production build
npm run lint       # Code linting
npm run type-check # TypeScript validation
```

---

## Configuration

### Environment Setup

**Blockchain Module** (`.env`):
```bash
PRIVATE_KEY=0x...                              # Deployment wallet
IITBH_RPC_URL=http://10.10.0.61:8550         # Network RPC
```

**Portal Modules** (`.env.local`):
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...             # EVoting contract
NEXT_PUBLIC_RPC_URL=http://10.10.0.61:8550   # Blockchain RPC
NEXT_PUBLIC_CHAIN_ID=1337                     # Network chain ID  
```

### Network Information
- **Network**: Private IITBH Blockchain
- **RPC Endpoint**: `http://10.10.0.61:8550`
- **Chain ID**: `1337`
- **Contract**: `0xED8CAB8a931A4C0489ad3E3FB5BdEA84f74fD23E`

---

## Documentation Links

| Resource | Description | Link |
|----------|-------------|------|
| **System Architecture** | High-level design overview | [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) |
| **LSAG Protocol** | Cryptographic signature scheme | [`docs/protocol/lsag-signature-scheme.md`](docs/protocol/lsag-signature-scheme.md) |
| **Deployment Guide** | Complete setup instructions | [`docs/guides/deployment-guide.md`](docs/guides/deployment-guide.md) |
| **Voter Guide** | How to participate in elections | [`docs/guides/voter-guide.md`](docs/guides/voter-guide.md) |
| **Admin Guide** | Election administration | [`docs/guides/admin-guide.md`](docs/guides/admin-guide.md) |
| **Smart Contract API** | Contract interface reference | [`docs/api/smart-contract-api.md`](docs/api/smart-contract-api.md) |
| **Legacy README** | Original documentation | [`docs/LEGACY_README.md`](docs/LEGACY_README.md) |

---

## Contributing

### Adding New Features
1. Identify the appropriate module (`blockchain/`, `voter-portal/`, `government-portal/`)
2. Implement feature following module conventions
3. Update module-specific README if needed
4. Update root README if architecture changes

### Shared Code Guidelines
- Place reusable utilities in `shared/` directory  
- Update TypeScript types in `shared/types/`
- Document shared functions thoroughly

### Development Workflow
1. Create feature branch: `git checkout -b feature/description`
2. Implement changes in appropriate modules
3. Test thoroughly across affected modules
4. Update documentation as needed  
5. Submit pull request with clear description

---

## Security Considerations

### Cryptographic Security
- **Private Keys** - Never commit to version control
- **LSAG Signatures** - Quantum-resistant elliptic curve cryptography
- **Vote Privacy** - Only hashes stored on blockchain, full votes stored locally

### Network Security  
- **Private Blockchain** - Controlled network environment
- **Contract Verification** - All smart contracts auditable
- **Frontend Validation** - Client-side cryptographic verification

### Operational Security
- **Environment Variables** - Sensitive data in `.env` files (gitignored)
- **Certificate Signing** - Government authority key protection
- **Vote Storage** - Local storage for vote privacy

---

## Project Statistics

| Metric | Value |
|--------|--------|
| **Modules** | 3 (blockchain, voter-portal, government-portal) |
| **Smart Contracts** | 4 (Evoting, Secp256k1, ECOperations, MessageHashUtils) |
| **Documentation Files** | 15+ comprehensive guides |
| **Supported Networks** | IITBH Private Blockchain |
| **Frontend Framework** | Next.js 16+ with React 19 |
| **Blockchain Framework** | Hardhat with OpenZeppelin |

---

## Troubleshooting

### Common Issues

**Contract Deployment Fails**
```bash
cd blockchain
npm run compile
# Check network connection and private key
```

**Frontend Build Errors**  
```bash
cd voter-portal  # or government-portal
rm -rf .next node_modules
npm install
npm run build
```

**MetaMask Connection Issues**
1. Ensure MetaMask is installed and unlocked
2. Add IITBH network manually:
   - RPC: `http://10.10.0.61:8550`
   - Chain ID: `1337`
3. Import deployment wallet if needed

### Support Resources
- **Issues**: GitHub Issues for bug reports
- **Documentation**: Comprehensive guides in [`docs/`](docs/)  
- **Code Examples**: Working examples in each module
- **Legacy Documentation**: [`docs/LEGACY_README.md`](docs/LEGACY_README.md)

---

## License

This project is developed for research and educational purposes. Please refer to the LICENSE file for detailed terms and conditions.

---

## Acknowledgments

- **LSAG Cryptography** - Implementation based on academic research
- **Elliptic Curve Operations** - Optimized for blockchain efficiency  
- **Hardhat Framework** - Professional Ethereum development tooling
- **Next.js Framework** - Modern React development platform

---

**Built for transparent, private, and secure digital democracy**