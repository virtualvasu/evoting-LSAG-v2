# Project Reorganization Plan

## Executive Summary

This document outlines the professional reorganization of the LSAG-based E-Voting System into three distinct, modular segments: **Blockchain Infrastructure**, **Voter Portal**, and **Government Portal**. This restructuring will improve maintainability, scalability, and developer experience.

---

## Current State Analysis

### Issues with Current Structure
- **Mixed Concerns**: Blockchain scripts, voter portal, and government portal coexist in root directory
- **Scattered Configuration**: Config files distributed across multiple locations
- **Documentation Fragmentation**: Implementation summaries and guides spread throughout project
- **Dependency Confusion**: Unclear which dependencies belong to which module
- **Navigation Complexity**: Developers must navigate deeply nested structures to find relevant code

### Current Directory Structure
```
evoting-LSAG-v2/
├── contracts/                      # Solidity smart contracts
├── scripts/                        # Mixed blockchain & utility scripts
├── voter-portal/                   # Next.js voter application
├── government-frontend/            # Next.js government application
├── artifacts/, cache/              # Build outputs
├── ignition/                       # Deployment modules
├── flowcharts/                     # Documentation assets
├── *.md files                      # Scattered documentation
├── hardhat.config.js              # Blockchain configuration
└── package.json                   # Blockchain dependencies
```

---

## Proposed Architecture

### Target Structure
```
evoting-lsag-v2/
│
├── blockchain/                     # 🔗 Blockchain Infrastructure
│   ├── contracts/                  # Solidity smart contracts
│   │   ├── Evoting.sol
│   │   ├── Secp256k1.sol
│   │   ├── ECOperations.sol
│   │   └── MessageHashUtils.sol
│   │
│   ├── scripts/                    # Deployment & utility scripts
│   │   ├── deploy/
│   │   │   ├── deploy-evoting.js
│   │   │   ├── deploy-secp256k1.js
│   │   │   └── redeploy-all.sh
│   │   │
│   │   ├── admin/
│   │   │   └── simple-setup.js
│   │   │
│   │   ├── utils/                  # Shared blockchain utilities
│   │   │   ├── blockchain-interface.js
│   │   │   ├── crypto-utils.js
│   │   │   ├── lsag-generator-template.js
│   │   │   └── real-lsag.js
│   │   │
│   │   ├── monitoring/             # Status check scripts
│   │   │   ├── check-election-status.js
│   │   │   ├── check-registration-table.js
│   │   │   ├── check-ring.js
│   │   │   └── check-transaction.js
│   │   │
│   │   └── testing/                # Test & demo scripts
│   │       ├── complete-demo.js
│   │       └── archived-tests/
│   │
│   ├── ignition/                   # Hardhat Ignition deployment
│   │   └── modules/
│   │       └── Evoting.ts
│   │
│   ├── test/                       # Smart contract tests (future)
│   │
│   ├── config/                     # Blockchain configurations
│   │   ├── deployment.json
│   │   ├── government-config.json
│   │   └── network-config.js
│   │
│   ├── artifacts/                  # Compiled contracts (gitignored)
│   ├── cache/                      # Build cache (gitignored)
│   │
│   ├── hardhat.config.js          # Hardhat configuration
│   ├── package.json               # Blockchain dependencies
│   ├── .env.example               # Environment template
│   └── README.md                  # Blockchain setup guide
│
├── voter-portal/                   # 🗳️ Voter Application
│   ├── app/                        # Next.js app directory
│   │   ├── page.tsx               # Home page
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── keypair/               # Key generation page
│   │   ├── certificate/           # Certificate upload page
│   │   ├── register/              # LSAG registration page
│   │   ├── vote/                  # Voting interface page
│   │   └── tally/                 # Tally submission page
│   │
│   ├── components/                 # React components
│   │   ├── GenerateKeyPair.tsx
│   │   ├── UpdateVoterRing.tsx
│   │   ├── GenerateLSAGSignature.tsx
│   │   ├── SubmitLSAGRegistration.tsx
│   │   ├── VotingInterface.tsx
│   │   └── TallyInterface.tsx
│   │
│   ├── lib/                        # Business logic & utilities
│   │   ├── keypair-utils.ts
│   │   ├── blockchain-utils.ts
│   │   ├── lsag-utils.ts
│   │   ├── registration-service.ts
│   │   ├── voting-service.ts
│   │   └── tally-service.ts
│   │
│   ├── public/                     # Static assets
│   │   ├── contract-config.json
│   │   └── abi/
│   │
│   ├── types/                      # TypeScript definitions
│   │   └── global.d.ts
│   │
│   ├── scripts/                    # CLI equivalents (optional)
│   │   ├── generate-keypair.js
│   │   ├── registration/
│   │   │   ├── generate-lsag-signature.js
│   │   │   └── submit-lsag-registration.js
│   │   ├── voting/
│   │   │   └── generate-vote.js
│   │   └── credentials/            # Vote data storage
│   │
│   ├── next.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md                   # Voter portal guide
│
├── government-portal/              # 🏛️ Government Administration
│   ├── app/                        # Next.js app directory
│   │   ├── page.tsx               # Admin dashboard
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── certificate/           # Certificate generation
│   │   ├── election/              # Election management
│   │   └── api/                   # Backend API routes
│   │       └── pre-register/
│   │
│   ├── components/                 # React components
│   │   ├── PreRegistration.tsx
│   │   └── ElectionManagement.tsx
│   │
│   ├── lib/                        # Business logic
│   │   ├── crypto-utils.ts
│   │   └── pre-registration-service.ts
│   │
│   ├── public/                     # Static assets
│   │   └── contract-config.json
│   │
│   ├── types/
│   │   └── global.d.ts
│   │
│   ├── scripts/                    # CLI equivalents (optional)
│   │   └── pre-registration/
│   │       ├── generate-certificate.js
│   │       └── pre-register-voter.js
│   │
│   ├── next.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md                   # Government portal guide
│
├── docs/                           # 📚 Centralized Documentation
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── blockchain-design.md
│   │   ├── voter-portal-architecture.md
│   │   └── government-portal-architecture.md
│   │
│   ├── protocol/
│   │   ├── lsag-signature-scheme.md
│   │   ├── election-phases.md
│   │   └── security-model.md
│   │
│   ├── guides/
│   │   ├── deployment-guide.md
│   │   ├── voter-guide.md
│   │   ├── admin-guide.md
│   │   └── development-setup.md
│   │
│   ├── implementation/
│   │   ├── voting-implementation.md
│   │   ├── tally-implementation.md
│   │   └── registration-implementation.md
│   │
│   ├── assets/
│   │   └── flowcharts/
│   │       └── evoting.png
│   │
│   └── api/
│       ├── smart-contract-api.md
│       └── frontend-api.md
│
├── shared/                         # 🔄 Shared Resources (if needed)
│   ├── types/                      # Common TypeScript types
│   ├── constants/                  # Shared constants
│   └── utils/                      # Cross-module utilities
│
├── .github/                        # GitHub configuration
│   ├── workflows/                  # CI/CD pipelines
│   └── ISSUE_TEMPLATE/
│
├── .gitignore                      # Git ignore rules
├── .env.example                    # Global environment template
├── package.json                    # Root workspace config (optional)
├── LICENSE                         # Project license
└── README.md                       # 📖 Main project README
```

---

## Migration Strategy

### Phase 1: Preparation (Pre-Migration)
1. **Create Backup**: Full project backup before any changes
2. **Document Dependencies**: Map all inter-module dependencies
3. **Review Git History**: Ensure no uncommitted changes
4. **Create Feature Branch**: `git checkout -b restructure/monorepo-organization`

### Phase 2: Blockchain Module Migration
**Commands:**
```bash
# Create blockchain directory structure
mkdir -p blockchain/{contracts,scripts/{deploy,admin,utils,monitoring,testing},ignition/modules,config,test}

# Move contracts
mv contracts/* blockchain/contracts/

# Move scripts (categorized)
mv scripts/deploy-*.js blockchain/scripts/deploy/
mv scripts/redeploy-all.sh blockchain/scripts/deploy/
mv scripts/admin/* blockchain/scripts/admin/
mv scripts/utils/* blockchain/scripts/utils/
mv scripts/check-*.js blockchain/scripts/monitoring/
mv scripts/complete-demo.js blockchain/scripts/testing/
mv scripts/archived-tests blockchain/scripts/testing/

# Move Hardhat infrastructure
mv hardhat.config.js blockchain/
mv ignition/* blockchain/ignition/
mv artifacts blockchain/
mv cache blockchain/

# Move blockchain config
mv scripts/config blockchain/config

# Create blockchain package.json
# (Extract blockchain dependencies from root package.json)

# Create blockchain README
# (Document smart contract deployment & interaction)
```

### Phase 3: Government Portal Migration
**Commands:**
```bash
# Rename government-frontend to government-portal
mv government-frontend government-portal

# Move CLI scripts into government portal
mkdir -p government-portal/scripts
mv scripts/pre_registration government-portal/scripts/

# Update government portal README
# (Document admin workflows)
```

### Phase 4: Voter Portal Enhancement
**Commands:**
```bash
# Move CLI scripts into voter portal
mkdir -p voter-portal/scripts
mv scripts/generate-keypair.js voter-portal/scripts/
mv scripts/registration_new voter-portal/scripts/registration
mv scripts/voting voter-portal/scripts/
mv scripts/voting_credentials voter-portal/scripts/

# Update voter portal README
# (Document voter workflows)
```

### Phase 5: Documentation Consolidation
**Commands:**
```bash
# Create docs directory
mkdir -p docs/{architecture,protocol,guides,implementation,assets}

# Move documentation files
mv README.md docs/LEGACY_README.md
mv VOTING_IMPLEMENTATION_SUMMARY.md docs/implementation/voting-implementation.md
mv TALLY_IMPLEMENTATION_SUMMARY.md docs/implementation/tally-implementation.md
mv VOTING_PHASE.md docs/protocol/voting-phase.md
mv VOTING_QUICKSTART.md docs/guides/voting-quickstart.md
mv ELECTION_PHASE_CONTROL.md docs/protocol/election-phases.md
mv flowcharts docs/assets/
mv voter-portal/STANDALONE_ARCHITECTURE.md docs/architecture/voter-portal-architecture.md
mv government-portal/STANDALONE_ARCHITECTURE.md docs/architecture/government-portal-architecture.md
mv E_Voting.pdf docs/protocol/

# Create new comprehensive docs
# (Create system-overview.md, deployment-guide.md, etc.)
```

### Phase 6: Configuration Updates
**Files to Update:**

1. **blockchain/hardhat.config.js**
   - No path changes needed (already references local contracts)

2. **blockchain/scripts/** (all scripts)
   - Update relative paths to contracts: `../artifacts/contracts/...`
   - Update config paths: `./config/deployment.json`

3. **voter-portal/lib/*.ts**
   - Update contract ABI imports: `require('../../blockchain/artifacts/...')`
   - Or use public/abi/ directory with copied ABIs

4. **government-portal/lib/*.ts**
   - Update contract ABI imports similarly

5. **Root .gitignore**
   - Update to reference new paths
   - Add entries:
     ```
     blockchain/artifacts/
     blockchain/cache/
     blockchain/node_modules/
     voter-portal/node_modules/
     government-portal/node_modules/
     ```

### Phase 7: Create Root README
Create comprehensive `README.md` at project root with:
- Quick start guide
- Architecture overview
- Links to module-specific READMEs
- Development workflow
- Contribution guidelines

### Phase 8: Testing & Validation
1. **Blockchain Module**:
   ```bash
   cd blockchain
   npm install
   npx hardhat compile
   npx hardhat test (if tests exist)
   ```

2. **Voter Portal**:
   ```bash
   cd voter-portal
   npm install
   npm run build
   npm run dev
   ```

3. **Government Portal**:
   ```bash
   cd government-portal
   npm install
   npm run build
   npm run dev
   ```

4. **Integration Testing**:
   - Deploy contracts from blockchain module
   - Test voter portal connection to contracts
   - Test government portal admin functions
   - Verify end-to-end election flow

### Phase 9: Cleanup
```bash
# Remove empty directories
find . -type d -empty -delete

# Remove old scripts directory if empty
rmdir scripts 2>/dev/null || true

# Update all documentation references
# (Search and replace old paths with new paths)
```

### Phase 10: Git Commit Strategy
```bash
# Commit in logical chunks
git add blockchain/
git commit -m "refactor: create blockchain module with contracts, scripts, and config"

git add government-portal/
git commit -m "refactor: organize government portal with CLI scripts"

git add voter-portal/
git commit -m "refactor: organize voter portal with CLI scripts"

git add docs/
git commit -m "docs: consolidate documentation in centralized docs directory"

git add README.md
git commit -m "docs: create comprehensive root README"

git add .gitignore
git commit -m "chore: update gitignore for new structure"

# Final commit
git commit -m "refactor: complete monorepo reorganization into blockchain, voter-portal, and government-portal modules"
```

---

## Benefits of Reorganization

### 1. **Separation of Concerns**
- Each module has clear boundaries and responsibilities
- Easier to reason about codebase structure
- Facilitates parallel development

### 2. **Improved Developer Experience**
- Clear entry points for each module
- Logical file organization
- Faster navigation and file discovery

### 3. **Better Dependency Management**
- Each module has its own `package.json`
- Prevents dependency pollution
- Easier to upgrade individual modules

### 4. **Enhanced Documentation**
- Centralized documentation hub
- Module-specific READMEs for focused guidance
- Clear separation of architectural vs. usage docs

### 5. **Scalability**
- Easy to add new modules (e.g., analytics dashboard, auditor portal)
- Clear patterns for organizing new features
- Facilitates microservices architecture if needed

### 6. **CI/CD Optimization**
- Can run tests per module
- Deploy modules independently
- Faster build times with targeted builds

### 7. **Onboarding**
- New developers can focus on one module
- Clear README path guides new contributors
- Reduced cognitive load

---

## Configuration Management

### Environment Variables Strategy

**blockchain/.env**
```bash
PRIVATE_KEY=0x...
IITBH_RPC_URL=http://10.10.0.61:8550
LOCALHOST_RPC_URL=http://localhost:8545
```

**voter-portal/.env.local**
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://10.10.0.61:8550
NEXT_PUBLIC_CHAIN_ID=1337
```

**government-portal/.env.local**
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://10.10.0.61:8550
NEXT_PUBLIC_CHAIN_ID=1337
GOVERNMENT_PRIVATE_KEY=0x...
```

### Shared Configuration Pattern

Create `blockchain/config/network-config.js`:
```javascript
module.exports = {
  iitbh: {
    rpc: 'http://10.10.0.61:8550',
    chainId: 1337,
    contractAddress: '0xED8CAB8a931A4C0489ad3E3FB5BdEA84f74fD23E'
  },
  localhost: {
    rpc: 'http://localhost:8545',
    chainId: 31337,
    contractAddress: process.env.LOCALHOST_CONTRACT_ADDRESS
  }
};
```

Both portals can import this configuration:
```typescript
// voter-portal/lib/blockchain-utils.ts
import networkConfig from '../../blockchain/config/network-config';
```

---

## Monorepo Considerations (Optional Future Enhancement)

For even better management, consider using a monorepo tool:

### Option 1: npm/yarn Workspaces
**Root package.json:**
```json
{
  "name": "evoting-lsag-monorepo",
  "private": true,
  "workspaces": [
    "blockchain",
    "voter-portal",
    "government-portal"
  ],
  "scripts": {
    "install:all": "npm install",
    "build:blockchain": "npm run compile --workspace=blockchain",
    "build:voter": "npm run build --workspace=voter-portal",
    "build:gov": "npm run build --workspace=government-portal",
    "dev:voter": "npm run dev --workspace=voter-portal",
    "dev:gov": "npm run dev --workspace=government-portal"
  }
}
```

### Option 2: Turborepo
- High-performance build system
- Intelligent caching
- Parallel execution
- Better for larger teams

### Option 3: Nx
- Advanced monorepo tooling
- Dependency graph visualization
- Code generation
- Better for enterprise scale

**Recommendation**: Start with simple npm workspaces, migrate to Turborepo/Nx if project scales significantly.

---

## Timeline Estimate

| Phase | Duration | Complexity |
|-------|----------|------------|
| Preparation | 30 min | Low |
| Blockchain Migration | 1 hour | Medium |
| Government Portal Migration | 30 min | Low |
| Voter Portal Enhancement | 30 min | Low |
| Documentation Consolidation | 1 hour | Medium |
| Configuration Updates | 1.5 hours | High |
| Root README Creation | 45 min | Medium |
| Testing & Validation | 2 hours | High |
| Cleanup | 30 min | Low |
| Git Commits | 30 min | Low |
| **Total** | **~8-9 hours** | **Medium-High** |

**Risk Factors:**
- Breaking changes in import paths
- Configuration mismatches
- Incomplete dependency mapping

**Mitigation:**
- Thorough testing after each phase
- Keep original structure until validation complete
- Use feature branch (easy rollback)

---

## Post-Migration Checklist

- [ ] All modules compile successfully
- [ ] Blockchain contracts deploy correctly
- [ ] Voter portal builds and runs
- [ ] Government portal builds and runs
- [ ] Contract interactions work from both portals
- [ ] All documentation links updated
- [ ] .gitignore properly excludes build artifacts
- [ ] Environment variable templates created
- [ ] README.md files created for all modules
- [ ] Root README.md comprehensive and accurate
- [ ] All scripts execute from new locations
- [ ] No broken import paths
- [ ] Git history preserved
- [ ] Original backup available

---

## Maintenance Guidelines

### Adding New Features
1. Identify which module(s) the feature belongs to
2. Add code in appropriate module directory
3. Update module-specific README if needed
4. Update root README if architecture changes

### Updating Dependencies
```bash
# Update blockchain dependencies
cd blockchain && npm update

# Update voter portal dependencies
cd voter-portal && npm update

# Update government portal dependencies
cd government-portal && npm update
```

### Adding New Modules
1. Create new directory at root level
2. Initialize with `package.json` and `README.md`
3. Add to workspace configuration (if using workspaces)
4. Update root README with module description

---

## Conclusion

This reorganization transforms the LSAG-based E-Voting System from a mixed-structure project into a professional, modular architecture. The separation into blockchain, voter-portal, and government-portal modules provides clear boundaries, improves maintainability, and facilitates future scaling.

**Next Steps:**
1. Review this plan with team
2. Create backup of current state
3. Execute migration in feature branch
4. Validate all functionality
5. Merge to main branch
6. Archive this reorganization plan document

**Questions or Issues:**
- Refer to module-specific README files
- Check documentation in `docs/` directory
- Review original structure backup if needed

---

**Document Version:** 1.0  
**Created:** 2025  
**Last Updated:** 2025  
**Status:** Ready for Implementation
