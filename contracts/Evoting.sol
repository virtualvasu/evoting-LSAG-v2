// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EVoting {
    
    // Structure to store voter's public key
    struct VoterPublicKey {
        bytes publicKey;
        bool exists;
    }
    
    // Structure to store vote
    struct Vote {
        bytes32 hashValue;
        bytes encryptedVote;
        bool exists;
    }
    
    // Structure to store tally results
    struct TallyResult {
        bytes candidate;
        bytes randomness;
        bool exists;
    }
    
    // Mappings
    mapping(bytes => VoterPublicKey) public publicKeys; // signature -> public key
    mapping(bytes => Vote) public votes; // voter key -> vote
    mapping(bytes => TallyResult) public tallyResults; // voter key -> tally
    
    // Events
    event PublicKeyStored(bytes signature, bytes publicKey);
    event VoterVerified(bytes signature, bytes publicKey);
    event VoteCast(bytes signature, bytes32 hashValue);
    event TallyCounted(bytes voterKey, bytes candidate);
    
    // BB.storePub - Store voter's public key
    function storePub(bytes memory signature, bytes memory publicKey) public {
        require(!publicKeys[signature].exists, "Public key already stored");
        
        publicKeys[signature] = VoterPublicKey({
            publicKey: publicKey,
            exists: true
        });
        
        emit PublicKeyStored(signature, publicKey);
    }
    
    // BB.verify - Verify voter's signature and public key
    function verify(bytes memory signature, bytes memory publicKey) public view returns (bool) {
        require(publicKeys[signature].exists, "Voter not registered");
        
        // Compare stored public key with provided one
        return keccak256(publicKeys[signature].publicKey) == keccak256(publicKey);
    }
    
    // BB.voting - Submit encrypted vote
    function voting(
        bytes memory signature, 
        bytes32 hashValue, 
        bytes memory encryptedVote
    ) public {
        require(publicKeys[signature].exists, "Voter not verified");
        require(!votes[signature].exists, "Vote already cast");
        
        votes[signature] = Vote({
            hashValue: hashValue,
            encryptedVote: encryptedVote,
            exists: true
        });
        
        emit VoteCast(signature, hashValue);
    }
    
    // BB.tally - Record decrypted vote for tallying
    function tally(
        bytes memory candidate, 
        bytes memory randomness, 
        bytes memory voterKey
    ) public {
        require(votes[voterKey].exists, "No vote found for this voter");
        require(!tallyResults[voterKey].exists, "Vote already tallied");
        
        tallyResults[voterKey] = TallyResult({
            candidate: candidate,
            randomness: randomness,
            exists: true
        });
        
        emit TallyCounted(voterKey, candidate);
    }
    
    // Helper function to check if voter has voted
    function hasVoted(bytes memory voterKey) public view returns (bool) {
        return votes[voterKey].exists;
    }
    
    // Helper function to check if vote has been tallied
    function isTallied(bytes memory voterKey) public view returns (bool) {
        return tallyResults[voterKey].exists;
    }
}