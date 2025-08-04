// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title RegistrationContract
 * @dev Contract 1: Handle certificate storage and election setup (Steps 0-1)
 * Purpose: Store voter certificates and set up election parameters
 */
contract RegistrationContract {
    
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
    // Certificate structure for voter registration
    struct Certificate {
        bytes governmentSignature;  // σ˜v = PKS.sign(Puv, Prgov)
        bytes governmentPublicKey;  // Pugov
        bytes voterPublicKey;       // Puv (LSAG public key)
    }

    // State variables
    mapping(bytes => bool) public certifiedPublicKeys;  // Track valid certificates
    bytes32 public electionId;                          // L
    bytes32[] public candidates;                        // C
    bytes32 public randomChallenge;                     // r
    address public electionAuthority;                   // EA address
    bool public electionSetup;                          // Setup status
    address private _owner;

    // Events
    event CertificateStored(bytes indexed voterPublicKey);
    event ElectionSetup(bytes32 indexed electionId, uint256 candidateCount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    modifier onlyElectionAuthority() {
        require(msg.sender == electionAuthority, "Only election authority can call this function");
        _;
    }

    modifier validCertificate(Certificate memory cert) {
        require(cert.governmentSignature.length > 0, "Government signature cannot be empty");
        require(cert.governmentPublicKey.length > 0, "Government public key cannot be empty");
        require(cert.voterPublicKey.length > 0, "Voter public key cannot be empty");
        _;
    }

    /**
     * @dev Constructor sets the election authority
     * @param _electionAuthority Address of the election authority
     */
    constructor(address _electionAuthority) {
        require(_electionAuthority != address(0), "Invalid election authority address");
        electionAuthority = _electionAuthority;
        _owner = msg.sender;
        _status = _NOT_ENTERED;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @dev Store a voter's certificate after government verification
     * @param cert Certificate struct containing signature and keys
     * @return success Boolean indicating successful storage
     */
    function storePub(Certificate memory cert) 
        public 
        nonReentrant 
        validCertificate(cert) 
        returns (bool success) 
    {
        // Check if public key is already certified
        require(!certifiedPublicKeys[cert.voterPublicKey], "Public key already certified");
        
        // Verify government signature using PKS.verify
        require(
            _verifyGovernmentSignature(
                cert.voterPublicKey, 
                cert.governmentPublicKey, 
                cert.governmentSignature
            ), 
            "Invalid government signature"
        );

        // Store the certified public key
        certifiedPublicKeys[cert.voterPublicKey] = true;

        emit CertificateStored(cert.voterPublicKey);
        return true;
    }

    /**
     * @dev Store election parameters and setup election
     * @param _electionId Election identifier
     * @param _candidates Array of candidate identifiers
     * @param _randomChallenge Random challenge for LSAG signatures
     * @return success Boolean indicating successful setup
     */
    function storePollParams(
        bytes32 _electionId,
        bytes32[] memory _candidates,
        bytes32 _randomChallenge
    ) 
        public 
        onlyElectionAuthority 
        nonReentrant 
        returns (bool success) 
    {
        require(!electionSetup, "Election already setup");
        require(_electionId != bytes32(0), "Invalid election ID");
        require(_candidates.length > 0, "Must have at least one candidate");
        require(_randomChallenge != bytes32(0), "Invalid random challenge");

        electionId = _electionId;
        candidates = _candidates;
        randomChallenge = _randomChallenge;
        electionSetup = true;

        emit ElectionSetup(_electionId, _candidates.length);
        return true;
    }

    /**
     * @dev Check if a public key is certified
     * @param publicKey Voter's public key to check
     * @return certified Boolean indicating certification status
     */
    function isCertified(bytes memory publicKey) 
        public 
        view 
        returns (bool certified) 
    {
        return certifiedPublicKeys[publicKey];
    }

    /**
     * @dev Get all candidates
     * @return candidateList Array of candidate identifiers
     */
    function getCandidates() 
        public 
        view 
        returns (bytes32[] memory candidateList) 
    {
        return candidates;
    }

    /**
     * @dev Get election setup status
     * @return setup Boolean indicating if election is set up
     */
    function isElectionSetup() 
        public 
        view 
        returns (bool setup) 
    {
        return electionSetup;
    }

    /**
     * @dev Internal function to verify government signature
     * @param voterPublicKey Voter's public key
     * @param governmentPublicKey Government's public key
     * @param signature Government's signature
     * @return valid Boolean indicating signature validity
     */
    function _verifyGovernmentSignature(
        bytes memory voterPublicKey,
        bytes memory governmentPublicKey,
        bytes memory signature
    ) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Implementation note: This is a simplified verification
        // In a real implementation, this would use actual PKS.verify
        // For now, we'll use a basic hash-based verification
        
        bytes32 messageHash = keccak256(abi.encodePacked(voterPublicKey, governmentPublicKey));
        bytes32 signatureHash = keccak256(signature);
        
        // This is a placeholder verification - replace with actual PKS verification
        return signatureHash != bytes32(0) && messageHash != bytes32(0);
    }

    /**
     * @dev Update election authority (only current authority can do this)
     * @param newAuthority Address of new election authority
     */
    function updateElectionAuthority(address newAuthority) 
        public 
        onlyElectionAuthority 
    {
        require(newAuthority != address(0), "Invalid new authority address");
        electionAuthority = newAuthority;
    }

    /**
     * @dev Emergency function to reset election setup (only authority)
     */
    function resetElectionSetup() 
        public 
        onlyElectionAuthority 
    {
        electionSetup = false;
        delete electionId;
        delete candidates;
        delete randomChallenge;
    }

    /**
     * @dev Returns the address of the current owner
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`)
     * Can only be called by the current owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}
