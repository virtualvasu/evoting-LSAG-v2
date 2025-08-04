// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Interface for VoterRegistrationContract
interface IVoterRegistrationContract {
    struct VoterRecord {
        bytes lsagSignature;
        bytes votingPublicKey;
        bool isRegistered;
        uint256 registrationTime;
    }
    
    function isRegistered(uint256 voterIndex) external view returns (bool);
    function registeredVoters(uint256 index) external view returns (VoterRecord memory);
    function getVoterCount() external view returns (uint256);
}

// Interface for RegistrationContract
interface IRegistrationContract {
    function electionId() external view returns (bytes32);
    function candidates() external view returns (bytes32[] memory);
    function electionAuthority() external view returns (address);
    function electionSetup() external view returns (bool);
}

/**
 * @title VotingAndTallyingContract
 * @dev Contract 3: Handle vote casting and tallying phases (Steps 3-4)
 * Purpose: Manage voting process and tally results
 */
contract VotingAndTallyingContract {
    
    // Reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    
    // Vote record structure
    struct VoteRecord {
        bytes signatureOnHash;      // σ''v = PKS.sign(hv, Pr'v)
        bytes32 voteHash;           // hv = H(σ'v, L)
        bool voteSubmitted;
        bool voteTallied;
        uint256 submissionTime;
    }

    // State variables
    mapping(uint256 => VoteRecord) public votes;
    mapping(bytes32 => uint256) public tallyResults;    // Final vote counts per candidate
    address public voterRegistrationContract;          // Reference to VoterRegistrationContract
    address public registrationContract;               // Reference to RegistrationContract
    bool public votingPhaseActive;
    bool public tallyingPhaseActive;
    bool public resultsFinalized;
    
    // Additional tracking variables
    uint256 public totalVotesCast;
    uint256 public totalVotesTallied;

    // Events
    event VoteCast(uint256 indexed voterIndex, bytes32 voteHash);
    event VoteTallied(uint256 indexed voterIndex, bytes32 indexed candidate);
    event PhaseChanged(string phase, bool active);
    event ResultsFinalized(bytes32[] candidates, uint256[] voteCounts);

    // Modifiers
    modifier onlyElectionAuthority() {
        address authority = IRegistrationContract(registrationContract).electionAuthority();
        require(msg.sender == authority, "Only election authority can call this function");
        _;
    }

    modifier onlyDuringVoting() {
        require(votingPhaseActive, "Voting phase is not active");
        require(!tallyingPhaseActive, "Tallying phase has started");
        _;
    }

    modifier onlyDuringTallying() {
        require(tallyingPhaseActive, "Tallying phase is not active");
        require(!resultsFinalized, "Results already finalized");
        _;
    }

    modifier onlyRegisteredVoter(uint256 voterIndex) {
        require(
            IVoterRegistrationContract(voterRegistrationContract).isRegistered(voterIndex),
            "Voter is not registered"
        );
        _;
    }

    modifier validVoteData(bytes memory signatureOnHash, bytes32 voteHash) {
        require(signatureOnHash.length > 0, "Signature on hash cannot be empty");
        require(voteHash != bytes32(0), "Vote hash cannot be empty");
        _;
    }

    /**
     * @dev Constructor sets the contract addresses
     * @param _voterRegistrationContract Address of VoterRegistrationContract
     * @param _registrationContract Address of RegistrationContract
     */
    constructor(
        address _voterRegistrationContract,
        address _registrationContract
    ) {
        require(_voterRegistrationContract != address(0), "Invalid voter registration contract");
        require(_registrationContract != address(0), "Invalid registration contract");
        
        voterRegistrationContract = _voterRegistrationContract;
        registrationContract = _registrationContract;
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Cast a vote during voting phase
     * @param signatureOnHash Signature on vote hash (σ''v = PKS.sign(hv, Pr'v))
     * @param voteHash Vote hash (hv = H(σ'v, L))
     * @param voterIndex Voter's registration index
     * @return success Boolean indicating successful vote casting
     */
    function voting(
        bytes memory signatureOnHash,
        bytes32 voteHash,
        uint256 voterIndex
    ) 
        public 
        nonReentrant 
        onlyDuringVoting 
        onlyRegisteredVoter(voterIndex)
        validVoteData(signatureOnHash, voteHash)
        returns (bool success) 
    {
        require(!votes[voterIndex].voteSubmitted, "Vote already submitted");

        // Get voter's voting public key
        IVoterRegistrationContract.VoterRecord memory voterRecord = 
            IVoterRegistrationContract(voterRegistrationContract).registeredVoters(voterIndex);

        // Verify signature on hash using voter's voting public key
        require(
            _verifySignatureOnHash(signatureOnHash, voteHash, voterRecord.votingPublicKey),
            "Invalid signature on vote hash"
        );

        // Store vote record
        votes[voterIndex] = VoteRecord({
            signatureOnHash: signatureOnHash,
            voteHash: voteHash,
            voteSubmitted: true,
            voteTallied: false,
            submissionTime: block.timestamp
        });

        totalVotesCast++;
        emit VoteCast(voterIndex, voteHash);
        return true;
    }

    /**
     * @dev Tally a vote during tallying phase
     * @param actualVoteSignature Actual vote signature (σ'v = PKS.sign(candidate, Pr'v))
     * @param voterIndex Voter's registration index
     * @return success Boolean indicating successful tallying
     */
    function tally(
        bytes memory actualVoteSignature,
        uint256 voterIndex
    ) 
        public 
        nonReentrant 
        onlyDuringTallying 
        onlyRegisteredVoter(voterIndex)
        returns (bool success) 
    {
        require(votes[voterIndex].voteSubmitted, "No vote submitted for this voter");
        require(!votes[voterIndex].voteTallied, "Vote already tallied");

        // Get election ID
        bytes32 electionId = IRegistrationContract(registrationContract).electionId();
        
        // Verify stored vote hash matches H(actualVoteSignature, electionId)
        bytes32 computedHash = keccak256(abi.encodePacked(actualVoteSignature, electionId));
        require(
            computedHash == votes[voterIndex].voteHash,
            "Vote hash verification failed"
        );

        // Extract candidate from signature and verify it's valid
        bytes32 candidate = _extractCandidateFromSignature(actualVoteSignature);
        require(_isValidCandidate(candidate), "Invalid candidate");

        // Get voter's voting public key for signature verification
        IVoterRegistrationContract.VoterRecord memory voterRecord = 
            IVoterRegistrationContract(voterRegistrationContract).registeredVoters(voterIndex);

        // Verify signature corresponds to a valid candidate
        require(
            _verifyVoteSignature(actualVoteSignature, candidate, voterRecord.votingPublicKey),
            "Invalid vote signature"
        );

        // Increment vote count for the candidate
        tallyResults[candidate]++;
        votes[voterIndex].voteTallied = true;
        totalVotesTallied++;

        emit VoteTallied(voterIndex, candidate);
        return true;
    }

    /**
     * @dev Get tally results
     * @return candidates Array of candidate identifiers
     * @return voteCounts Array of vote counts per candidate
     */
    function getTallyResults() 
        public 
        view 
        returns (bytes32[] memory candidates, uint256[] memory voteCounts) 
    {
        bytes32[] memory allCandidates = IRegistrationContract(registrationContract).candidates();
        uint256[] memory counts = new uint256[](allCandidates.length);
        
        for (uint256 i = 0; i < allCandidates.length; i++) {
            counts[i] = tallyResults[allCandidates[i]];
        }
        
        return (allCandidates, counts);
    }

    /**
     * @dev Start voting phase
     * @return success Boolean indicating successful phase start
     */
    function startVotingPhase() 
        public 
        onlyElectionAuthority 
        returns (bool success) 
    {
        require(
            IRegistrationContract(registrationContract).electionSetup(),
            "Election not setup"
        );
        require(!votingPhaseActive, "Voting phase already active");
        require(!tallyingPhaseActive, "Cannot start voting during tallying");

        votingPhaseActive = true;
        emit PhaseChanged("voting", true);
        return true;
    }

    /**
     * @dev Start tallying phase (ends voting)
     * @return success Boolean indicating successful phase transition
     */
    function startTallyingPhase() 
        public 
        onlyElectionAuthority 
        returns (bool success) 
    {
        require(votingPhaseActive, "Voting phase must be active first");
        require(!tallyingPhaseActive, "Tallying phase already active");

        votingPhaseActive = false;
        tallyingPhaseActive = true;
        
        emit PhaseChanged("voting", false);
        emit PhaseChanged("tallying", true);
        return true;
    }

    /**
     * @dev Finalize results (ends tallying)
     * @return success Boolean indicating successful finalization
     */
    function finalizeResults() 
        public 
        onlyElectionAuthority 
        returns (bool success) 
    {
        require(tallyingPhaseActive, "Tallying phase must be active");
        require(!resultsFinalized, "Results already finalized");

        tallyingPhaseActive = false;
        resultsFinalized = true;

        (bytes32[] memory candidates, uint256[] memory voteCounts) = getTallyResults();
        
        emit PhaseChanged("tallying", false);
        emit ResultsFinalized(candidates, voteCounts);
        return true;
    }

    /**
     * @dev Internal function to verify signature on hash
     * @param signatureOnHash The signature on the hash
     * @param voteHash The vote hash
     * @param votingPublicKey Voter's voting public key
     * @return valid Boolean indicating signature validity
     */
    function _verifySignatureOnHash(
        bytes memory signatureOnHash,
        bytes32 voteHash,
        bytes memory votingPublicKey
    ) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Implementation note: This is a simplified verification
        // In a real implementation, this would use actual PKS.verify
        
        bytes32 messageHash = keccak256(abi.encodePacked(voteHash, votingPublicKey));
        bytes32 sigHash = keccak256(signatureOnHash);
        
        // This is a placeholder verification - replace with actual PKS verification
        return sigHash != bytes32(0) && messageHash != bytes32(0);
    }

    /**
     * @dev Internal function to extract candidate from vote signature
     * @param voteSignature The vote signature
     * @return candidate The candidate identifier
     */
    function _extractCandidateFromSignature(bytes memory voteSignature) 
        internal 
        pure 
        returns (bytes32 candidate) 
    {
        // Implementation note: This is a simplified extraction
        // In a real implementation, this would parse the actual signature structure
        
        require(voteSignature.length >= 32, "Invalid vote signature length");
        
        // Extract candidate from signature (simplified approach)
        bytes32 extractedCandidate;
        assembly {
            extractedCandidate := mload(add(voteSignature, 32))
        }
        
        return extractedCandidate;
    }

    /**
     * @dev Internal function to check if candidate is valid
     * @param candidate The candidate identifier to check
     * @return valid Boolean indicating candidate validity
     */
    function _isValidCandidate(bytes32 candidate) 
        internal 
        view 
        returns (bool valid) 
    {
        bytes32[] memory validCandidates = IRegistrationContract(registrationContract).candidates();
        
        for (uint256 i = 0; i < validCandidates.length; i++) {
            if (validCandidates[i] == candidate) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * @dev Internal function to verify vote signature
     * @param voteSignature The vote signature
     * @param candidate The candidate being voted for
     * @param votingPublicKey Voter's voting public key
     * @return valid Boolean indicating signature validity
     */
    function _verifyVoteSignature(
        bytes memory voteSignature,
        bytes32 candidate,
        bytes memory votingPublicKey
    ) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Implementation note: This is a simplified verification
        // In a real implementation, this would use actual PKS.verify
        
        bytes32 messageHash = keccak256(abi.encodePacked(candidate, votingPublicKey));
        bytes32 sigHash = keccak256(voteSignature);
        
        // This is a placeholder verification - replace with actual PKS verification
        return sigHash != bytes32(0) && messageHash != bytes32(0);
    }

    /**
     * @dev Get voting statistics
     * @return totalRegistered Total registered voters
     * @return votesCast Total votes cast
     * @return votesTallied Total votes tallied
     * @return currentPhase Current election phase
     */
    function getVotingStats() 
        public 
        view 
        returns (
            uint256 totalRegistered,
            uint256 votesCast,
            uint256 votesTallied,
            string memory currentPhase
        ) 
    {
        totalRegistered = IVoterRegistrationContract(voterRegistrationContract).getVoterCount();
        votesCast = totalVotesCast;
        votesTallied = totalVotesTallied;
        
        if (resultsFinalized) {
            currentPhase = "finalized";
        } else if (tallyingPhaseActive) {
            currentPhase = "tallying";
        } else if (votingPhaseActive) {
            currentPhase = "voting";
        } else {
            currentPhase = "setup";
        }
        
        return (totalRegistered, votesCast, votesTallied, currentPhase);
    }

    /**
     * @dev Check if voter has cast a vote
     * @param voterIndex Voter's registration index
     * @return voted Boolean indicating if vote was cast
     */
    function hasVoted(uint256 voterIndex) 
        public 
        view 
        returns (bool voted) 
    {
        return votes[voterIndex].voteSubmitted;
    }

    /**
     * @dev Check if voter's vote has been tallied
     * @param voterIndex Voter's registration index
     * @return isTallied Boolean indicating if vote was tallied
     */
    function isVoteTallied(uint256 voterIndex) 
        public 
        view 
        returns (bool isTallied) 
    {
        return votes[voterIndex].voteTallied;
    }
}
