# Election Phase Control System

## Overview
The Evoting contract now includes comprehensive election phase management for government authorities. This system provides granular control over election lifecycle with clear phase transitions and validation.

## Election Phases

The election follows these phases in order:

1. **SETUP** (0) - Initial state after election creation
2. **REGISTRATION** (1) - Voters can register
3. **VOTING** (2) - Registered voters can cast votes
4. **TALLYING** (3) - Votes can be tallied
5. **ENDED** (4) - Election is completed

## Phase Control Functions

### 1. Start Election
```solidity
function startElection(string memory _electionId, string[] memory _candidates)
```
- **Access:** Owner only
- **Purpose:** Initialize a new election
- **Initial Phase:** SETUP
- **Requirements:**
  - No active election running
  - At least one candidate
  - Valid election ID

### 2. Start Registration Phase
```solidity
function startRegistrationPhase()
```
- **Access:** Owner only
- **Purpose:** Open voter registration
- **Transition:** SETUP → REGISTRATION
- **Requirements:**
  - Election must be active
  - Current phase must be SETUP

### 3. Stop Registration Phase
```solidity
function stopRegistrationPhase()
```
- **Access:** Owner only
- **Purpose:** Close voter registration
- **Transition:** REGISTRATION → SETUP
- **Requirements:**
  - Election must be active
  - Current phase must be REGISTRATION

### 4. Start Voting Phase
```solidity
function startVotingPhase()
```
- **Access:** Owner only
- **Purpose:** Open voting period
- **Transition:** SETUP/REGISTRATION → VOTING
- **Requirements:**
  - Election must be active
  - Current phase must be SETUP or REGISTRATION
  - At least one voter must be registered

### 5. Stop Voting Phase
```solidity
function stopVotingPhase()
```
- **Access:** Owner only
- **Purpose:** Close voting period
- **Transition:** VOTING → SETUP
- **Requirements:**
  - Election must be active
  - Current phase must be VOTING

### 6. Start Tallying Phase
```solidity
function startTallyingPhase()
```
- **Access:** Owner only
- **Purpose:** Begin vote counting
- **Transition:** SETUP/VOTING → TALLYING
- **Requirements:**
  - Election must be active
  - Current phase must be SETUP or VOTING

### 7. Stop Tallying Phase
```solidity
function stopTallyingPhase()
```
- **Access:** Owner only
- **Purpose:** Stop vote counting
- **Transition:** TALLYING → SETUP
- **Requirements:**
  - Election must be active
  - Current phase must be TALLYING

### 8. End Election
```solidity
function endElection()
```
- **Access:** Owner only
- **Purpose:** Finalize and close the election
- **Final Phase:** ENDED
- **Requirements:**
  - Election must be active

### 9. Reset Election Data
```solidity
function resetElectionData()
```
- **Access:** Owner only
- **Purpose:** Clear election data for next election
- **Requirements:**
  - Election must be completed
- **Note:** Voter ring remains intact

## Phase Enforcement

### Modified Functions with Phase Restrictions:

1. **BBverify** (Registration)
   - Only callable during REGISTRATION phase
   - Prevents registration outside designated period

2. **BBvoting** (Voting)
   - Only callable during VOTING phase
   - Prevents vote casting outside designated period

3. **BBtally** (Tallying)
   - Only callable during TALLYING phase
   - Prevents tallying outside designated period

## Helper Functions

### Get Current Phase
```solidity
function getCurrentPhase() returns (ElectionPhase)
function getCurrentPhaseString() returns (string memory)
```
- Returns current phase as enum or string

### Get Election Status
```solidity
function getElectionStatus() returns (
    string memory _electionId,
    bool _isActive,
    bool _isCompleted,
    string[] memory _candidates,
    uint256 _registeredVoters,
    ElectionPhase _currentPhase,
    string memory _phaseString
)
```
- Returns comprehensive election information including current phase

## Events

New events for phase tracking:
- `RegistrationPhaseStarted(string indexed electionId)`
- `RegistrationPhaseStopped(string indexed electionId)`
- `VotingPhaseStarted(string indexed electionId)`
- `VotingPhaseStopped(string indexed electionId)`
- `TallyingPhaseStarted(string indexed electionId)`
- `TallyingPhaseStopped(string indexed electionId)`

## Typical Election Flow

```
1. startElection("Election2026", ["Alice", "Bob", "Charlie"])
   → Phase: SETUP

2. startRegistrationPhase()
   → Phase: REGISTRATION
   → Voters can now call BBverify to register

3. stopRegistrationPhase()
   → Phase: SETUP
   → Registration closed

4. startVotingPhase()
   → Phase: VOTING
   → Registered voters can now call BBvoting to cast votes

5. stopVotingPhase()
   → Phase: SETUP
   → Voting closed

6. startTallyingPhase()
   → Phase: TALLYING
   → Government can now call BBtally to count votes

7. stopTallyingPhase()
   → Phase: SETUP
   → Tallying closed

8. endElection()
   → Phase: ENDED
   → Election completed

9. resetElectionData()
   → Ready for next election
```

## Security Features

1. **Phase Validation:** All operations are restricted to appropriate phases
2. **Owner Control:** Only government authority (owner) can control phases
3. **Sequential Enforcement:** Clear phase transitions prevent out-of-order operations
4. **State Protection:** Cannot modify election data in wrong phases
5. **Rollback Capability:** Can return to SETUP phase from any operational phase

## Modifiers

- `onlyInPhase(ElectionPhase _phase)` - Restricts function to specific phase
- `whenElectionActive()` - Requires active election

## Benefits

1. **Granular Control:** Fine-grained control over each election stage
2. **Security:** Prevents unauthorized actions outside designated periods
3. **Transparency:** Clear phase indicators for all participants
4. **Flexibility:** Can pause and resume phases as needed
5. **Auditability:** Events track all phase transitions
