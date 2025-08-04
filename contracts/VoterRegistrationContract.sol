// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Interface for Registration Contract
interface IRegistrationContract {
    function isCertified(bytes memory publicKey) external view returns (bool);
    function electionId() external view returns (bytes32);
    function candidates() external view returns (bytes32[] memory);
    function electionSetup() external view returns (bool);
}

/**
 * @title VoterRegistrationContract
 * @dev Contract 2: Handle anonymous voter registration with LSAG signatures (Step 2)
 * Purpose: Register voters anonymously using LSAG signatures
 */
contract VoterRegistrationContract {
    
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
    
    // Voter record structure
    struct VoterRecord {
        bytes lsagSignature;        // σv = LSAG.sign(L, Pu, Prv)
        bytes votingPublicKey;      // Pu'v (new voting public key)
        bool isRegistered;
        uint256 registrationTime;
    }

    // State variables
    mapping(uint256 => VoterRecord) public registeredVoters;
    mapping(bytes => bool) public usedKeyImages;        // Prevent double registration
    uint256 public voterCount;
    address public registrationContract;                // Reference to RegistrationContract

    // Events
    event VoterRegistered(uint256 indexed voterIndex, bytes votingPublicKey);
    event RegistrationRejected(bytes lsagSignature, string reason);

    // Modifiers
    modifier onlyWhenElectionSetup() {
        require(
            IRegistrationContract(registrationContract).electionSetup(),
            "Election not setup yet"
        );
        _;
    }

    modifier validSignatureAndKey(bytes memory lsagSignature, bytes memory votingPublicKey) {
        require(lsagSignature.length > 0, "LSAG signature cannot be empty");
        require(votingPublicKey.length > 0, "Voting public key cannot be empty");
        _;
    }

    /**
     * @dev Constructor sets the registration contract address
     * @param _registrationContract Address of the RegistrationContract
     */
    constructor(address _registrationContract) {
        require(_registrationContract != address(0), "Invalid registration contract address");
        registrationContract = _registrationContract;
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Verify LSAG signature and register voter
     * @param lsagSignature LSAG signature on election ID
     * @param votingPublicKey New voting public key (Pu'v)
     * @return voterIndex Assigned voter index (kv)
     */
    function verify(
        bytes memory lsagSignature,
        bytes memory votingPublicKey
    ) 
        public 
        nonReentrant 
        onlyWhenElectionSetup
        validSignatureAndKey(lsagSignature, votingPublicKey)
        returns (uint256 voterIndex) 
    {
        // Get election ID from registration contract
        bytes32 electionId = IRegistrationContract(registrationContract).electionId();
        
        // Extract key image from LSAG signature for linkability check
        bytes memory keyImage = _extractKeyImage(lsagSignature);
        
        // Check if this key image has been used (prevent double registration)
        if (usedKeyImages[keyImage]) {
            emit RegistrationRejected(lsagSignature, "Key image already used");
            revert("Double registration attempt detected");
        }

        // Verify LSAG signature against certified public keys
        require(
            _verifyLSAGSignature(lsagSignature, electionId),
            "Invalid LSAG signature"
        );

        // Check linkability using LSAG.linkVer
        require(
            _checkLinkability(lsagSignature, keyImage),
            "Linkability check failed"
        );

        // Register the voter
        voterIndex = voterCount;
        registeredVoters[voterIndex] = VoterRecord({
            lsagSignature: lsagSignature,
            votingPublicKey: votingPublicKey,
            isRegistered: true,
            registrationTime: block.timestamp
        });

        // Mark key image as used
        usedKeyImages[keyImage] = true;
        voterCount++;

        emit VoterRegistered(voterIndex, votingPublicKey);
        return voterIndex;
    }

    /**
     * @dev Check if a voter is registered
     * @param voterIndex Voter index to check
     * @return registered Boolean indicating registration status
     */
    function isRegistered(uint256 voterIndex) 
        public 
        view 
        returns (bool registered) 
    {
        return voterIndex < voterCount && registeredVoters[voterIndex].isRegistered;
    }

    /**
     * @dev Get total number of registered voters
     * @return count Total voter count
     */
    function getVoterCount() 
        public 
        view 
        returns (uint256 count) 
    {
        return voterCount;
    }

    /**
     * @dev Get voter record by index
     * @param voterIndex Index of the voter
     * @return record VoterRecord struct
     */
    function getVoterRecord(uint256 voterIndex) 
        public 
        view 
        returns (VoterRecord memory record) 
    {
        require(voterIndex < voterCount, "Invalid voter index");
        return registeredVoters[voterIndex];
    }

    /**
     * @dev Internal function to extract key image from LSAG signature
     * @param lsagSignature The LSAG signature
     * @return keyImage Extracted key image for linkability
     */
    function _extractKeyImage(bytes memory lsagSignature) 
        internal 
        pure 
        returns (bytes memory keyImage) 
    {
        // Implementation note: This is a simplified extraction
        // In a real implementation, this would parse the actual LSAG signature structure
        // For now, we'll use a hash-based approach to simulate key image extraction
        
        require(lsagSignature.length >= 32, "Invalid LSAG signature length");
        
        // Extract the first 32 bytes as key image (simplified)
        keyImage = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            keyImage[i] = lsagSignature[i];
        }
        
        return keyImage;
    }

    /**
     * @dev Internal function to verify LSAG signature
     * @param lsagSignature The LSAG signature to verify
     * @param electionId The election ID that was signed
     * @return valid Boolean indicating signature validity
     */
    function _verifyLSAGSignature(
        bytes memory lsagSignature,
        bytes32 electionId
    ) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Implementation note: This is a simplified verification
        // In a real implementation, this would use actual LSAG.verify
        // against the ring of certified public keys from RegistrationContract
        
        bytes32 messageHash = keccak256(abi.encodePacked(electionId));
        bytes32 signatureHash = keccak256(lsagSignature);
        
        // This is a placeholder verification - replace with actual LSAG verification
        // Should verify against ring of certified public keys
        return signatureHash != bytes32(0) && messageHash != bytes32(0);
    }

    /**
     * @dev Internal function to check linkability
     * @param lsagSignature The LSAG signature
     * @param keyImage The extracted key image
     * @return valid Boolean indicating linkability check result
     */
    function _checkLinkability(
        bytes memory lsagSignature,
        bytes memory keyImage
    ) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Implementation note: This is a simplified linkability check
        // In a real implementation, this would use LSAG.linkVer
        
        bytes32 sigHash = keccak256(lsagSignature);
        bytes32 keyImageHash = keccak256(keyImage);
        
        // This is a placeholder check - replace with actual LSAG linkability verification
        return sigHash != bytes32(0) && keyImageHash != bytes32(0);
    }

    /**
     * @dev Check if a key image has been used
     * @param keyImage The key image to check
     * @return used Boolean indicating if key image is used
     */
    function isKeyImageUsed(bytes memory keyImage) 
        public 
        view 
        returns (bool used) 
    {
        return usedKeyImages[keyImage];
    }

    /**
     * @dev Get registration statistics
     * @return totalRegistered Total number of registered voters
     * @return registrationOpen Whether registration is still open
     */
    function getRegistrationStats() 
        public 
        view 
        returns (uint256 totalRegistered, bool registrationOpen) 
    {
        totalRegistered = voterCount;
        registrationOpen = IRegistrationContract(registrationContract).electionSetup();
        return (totalRegistered, registrationOpen);
    }
}
