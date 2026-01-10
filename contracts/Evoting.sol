// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./MessageHashUtils.sol";
import "./ECOperations.sol";

interface ISecp256k1 {
    function ScalarMult(uint256 px, uint256 py, uint256 scalar) external view returns(uint256 qx, uint256 qy);
    function ScalarBaseMult(uint256 scalar) external view returns(uint256 qx, uint256 qy);
    function HashToPoint(uint256 x1, uint256 y1) external view returns (uint256 qx, uint256 qy);
    function Add(uint256 x1, uint256 y1, uint256 x2, uint256 y2) external view returns (uint256 x3, uint256 y3);
}

contract EVoting {
    using ECDSA for bytes32;
    using ECOperations for *;
    
    ISecp256k1 public secp256k1;

    // Structure to store voter's public key
    struct VoterPublicKey {
        bytes publicKey;
        bool exists;
    }

    // Certificate structure: CERT_v = {σ̃_v, P_ugov, P_uv, voterName, sid}
    struct Certificate {
        bytes sigma_tilde_v;   // σ̃_v = PKS.sign({voter_name, student_id, voter_public_key}, P_rgov)
        bytes P_ugov;          // P_ugov - government public key
        bytes P_uv;            // P_uv - voter's public key
        string voterName;      // Voter's name
        string sid;            // Student/Voter ID
    }

    // LSAG Signature structure
    struct LSAGSignature {
        uint256 keyImageX;     // Ix - key image x coordinate
        uint256 keyImageY;     // Iy - key image y coordinate
        uint256 c;             // initial challenge
        uint256[] s;           // response array (one per ring member)
    }

    // Registration table entry: T[k] = (σv, Pu')
    struct RegistrationEntry {
        LSAGSignature lsagSig; // LSAG signature
        bytes publicKey;        // Voter's public key (Pu')
    }

    // Mappings
    mapping(bytes => VoterPublicKey) public publicKeys;
    
    // Voter ring storage
    bytes32[] public voterRing;
    mapping(bytes32 => bytes) public hashToPublicKey;  // Map hash to actual public key

    // Registration table T: stores LSAG signatures and corresponding public keys
    RegistrationEntry[] public registrationTable;

    // Events
    event PublicKeyStored(bytes signature, bytes publicKey);
    event RegistrationSuccess(uint256 indexed kv, bytes publicKey);
    event RegistrationFailed(string reason);

    // Constructor
    constructor(address _secp256k1) {
        require(_secp256k1 != address(0), "Invalid Secp256k1 address");
        secp256k1 = ISecp256k1(_secp256k1);
    }

    // -------- REGISTRATION PHASE -------- //

    // ================ BB.storePub =============== //
    function storePub(Certificate memory cert_u) public {
        bytes memory voterKey = cert_u.P_uv;
        require(!publicKeys[voterKey].exists, "Public key already stored");

        // Step 1: verify the certificate per PKS.ver(CERTv)
        require(pksVerifyCertificate(cert_u), "PKS certificate verification failed");

        // Step 2: add voter's public key to Pu
        publicKeys[voterKey] = VoterPublicKey({ publicKey: cert_u.P_uv, exists: true });
        bytes32 pubKeyHash = keccak256(cert_u.P_uv);
        voterRing.push(pubKeyHash);
        hashToPublicKey[pubKeyHash] = cert_u.P_uv;  // Store mapping

        emit PublicKeyStored(voterKey, cert_u.P_uv);
    }

    // ---------- PKS.ver(CERTv) ---------- //
    function pksVerifyCertificate(Certificate memory cert) internal pure returns (bool) {
        // Check presence
        if (cert.sigma_tilde_v.length != 65 || cert.P_ugov.length != 64 || cert.P_uv.length != 64)
            return false;
        
        if (bytes(cert.voterName).length == 0 || bytes(cert.sid).length == 0)
            return false;

        // the gov's public key → address
        address govAddr = deriveAddressFromPubKey(cert.P_ugov);

        // message that gov signed: hash of (voterName + sid + voterPublicKey)
        bytes32 msgHash = keccak256(abi.encodePacked(cert.voterName, cert.sid, cert.P_uv));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(msgHash);

        // recover signer from signature
        address recovered = ethHash.recover(cert.sigma_tilde_v);

        // valid iff recovered == government address
        return recovered == govAddr;
    }

    // ---------- helper: derive address from raw EC public key ---------- //
    function deriveAddressFromPubKey(bytes memory pubKey) internal pure returns (address) {
        require(pubKey.length == 64, "Expected uncompressed pubkey (64 bytes)");
        bytes32 pubKeyHash = keccak256(pubKey);
        return address(uint160(uint256(pubKeyHash)));
    }

    // Helper getters
    function getVoterRing() public view returns (bytes32[] memory) {
        return voterRing;
    }

    function getRingSize() public view returns (uint256) {
        return voterRing.length;
    }

    function isPublicKeyInRing(bytes memory publicKey) public view returns (bool) {
        bytes32 pubKeyHash = keccak256(publicKey);
        for (uint256 i = 0; i < voterRing.length; i++) {
            if (voterRing[i] == pubKeyHash) {
                return true;
            }
        }
        return false;
    }

    function createCertificate(
        bytes memory sigma_tilde_v,
        bytes memory P_ugov,
        bytes memory P_uv,
        string memory voterName,
        string memory sid
    ) public pure returns (Certificate memory) {
        return Certificate({ 
            sigma_tilde_v: sigma_tilde_v, 
            P_ugov: P_ugov, 
            P_uv: P_uv,
            voterName: voterName,
            sid: sid
        });
    }

    /**
     * Get all registered public keys in the ring
     * Returns array of public keys in same order as voterRing hashes
     */
    function getRegisteredPublicKeys() public view returns (bytes[] memory) {
        bytes[] memory pubKeys = new bytes[](voterRing.length);
        
        for (uint256 i = 0; i < voterRing.length; i++) {
            pubKeys[i] = hashToPublicKey[voterRing[i]];
        }
        
        return pubKeys;
    }

    // -------- LSAG VERIFICATION PHASE -------- //

    /**
     * @dev Hash a point to another point on the curve (deterministic)
     * H(P) for key image computation
     * @param Px X coordinate of point P
     * @param Py Y coordinate of point P
     * @return Hx X coordinate of H(P)
     * @return Hy Y coordinate of H(P)
     */
    function hashToPoint(uint256 Px, uint256 Py) internal view returns (uint256 Hx, uint256 Hy) {
        // Hash the point coordinates
        bytes32 hash = keccak256(abi.encodePacked(Px, Py));
        uint256 scalar = uint256(hash) % ECOperations.getOrder();
        
        // Ensure scalar is not zero
        if (scalar == 0) {
            scalar = 1;
        }
        
        // Multiply generator by the hash scalar: H(P) = [hash(P)]G
        (Hx, Hy) = ECOperations.ecMulG(scalar);
        
        // Validate the resulting point is on curve
        require(ECOperations.isValidPoint(Hx, Hy), "HashToPoint produced invalid point");
        
        return (Hx, Hy);
    }

    /**
     * @dev LSAG.ver - Verify LSAG signature (SIMPLE VERSION)
     * @param electionId Election identifier
     * @param lsagSig LSAG signature containing key image, c (c[0]), and s array
     * @return bool True if signature is valid, false otherwise
     * 
     * Simple forward-chaining: c[0] -> c[1] -> c[2] -> ... -> c[0]
     */
    function LSAGver(
        uint256 electionId,
        LSAGSignature memory lsagSig
    ) public view returns (bool) {
        uint256 ringSize = voterRing.length;
        
        // Signature must have response for each ring member
        require(lsagSig.s.length == ringSize, "Invalid signature length");
        
        if (ringSize == 0) return false;
        
        // Start with c[0] from signature
        uint256 currentChallenge = lsagSig.c;
        uint256 Lix;
        uint256 Liy;
        uint256 Rix;
        uint256 Riy;
        
        // Loop through entire ring
        for (uint256 i = 0; i < ringSize; i++) {
            // Get public key for this ring member
            bytes memory pubKeyBytes = hashToPublicKey[voterRing[i]];
            require(pubKeyBytes.length == 64, "Invalid public key length");
            
            // Extract coordinates
            uint256 Pix;
            uint256 Piy;
            assembly {
                Pix := mload(add(pubKeyBytes, 32))
                Piy := mload(add(pubKeyBytes, 64))
            }
            
            // Compute L = [s[i]]G + [c[i]]P[i]
            (Lix, Liy) = _computeL(lsagSig.s[i], Pix, Piy, currentChallenge);
            
            // Compute R = [s[i]]H(P[i]) + [c[i]]I
            (Rix, Riy) = _computeR(lsagSig.s[i], Pix, Piy, currentChallenge, lsagSig.keyImageX, lsagSig.keyImageY);
            
            // Compute next challenge: c[i+1] = H(electionId, L[i], R[i])
            currentChallenge = uint256(keccak256(abi.encodePacked(electionId, Lix, Liy, Rix, Riy)));
        }
        
        // After full loop, should arrive back at c[0]
        return currentChallenge == lsagSig.c;
    }
    
    /**
     * @dev Helper function: compute L = [s]G + [c]P
     */
    function _computeL(
        uint256 s,
        uint256 Px,
        uint256 Py,
        uint256 c
    ) internal view returns (uint256 Lx, uint256 Ly) {
        uint256 x1;
        uint256 x2;
        uint256 x3;
        uint256 x4;
        
        // [s]G
        (x1, x2) = secp256k1.ScalarBaseMult(s);
        // [c]P
        (x3, x4) = secp256k1.ScalarMult(Px, Py, c);
        // Add them
        return secp256k1.Add(x1, x2, x3, x4);
    }
    
    /**
     * @dev Helper function: compute R = [s]H(P) + [c]I
     */
    function _computeR(
        uint256 s,
        uint256 Px,
        uint256 Py,
        uint256 c,
        uint256 Ix,
        uint256 Iy
    ) internal view returns (uint256 Rx, uint256 Ry) {
        uint256 t1;
        uint256 t2;
        uint256 x3;
        uint256 x4;
        
        // H(P)
        (t1, t2) = secp256k1.HashToPoint(Px, Py);
        // [s]H(P)
        (t1, t2) = secp256k1.ScalarMult(t1, t2, s);
        // [c]I
        (x3, x4) = secp256k1.ScalarMult(Ix, Iy, c);
        // Add them
        return secp256k1.Add(t1, t2, x3, x4);
    }

    /**
     * @dev LSAG.linkVer - Check if two signatures are linked (from same signer)
     * @param sig1 First LSAG signature
     * @param sig2 Second LSAG signature
     * @return bool True if signatures have same key image (linked), false otherwise
     */
    function LSAGlinkVer(
        LSAGSignature memory sig1,
        LSAGSignature memory sig2
    ) public pure returns (bool) {
        // Two signatures are linked if they have the same key image
        return (sig1.keyImageX == sig2.keyImageX && sig1.keyImageY == sig2.keyImageY);
    }

    /**
     * @dev BB.verify - Verify and register voter with LSAG signature
     * Implements the BB.verify(σ, Pu') function from the paper
     * @param electionId Election identifier (L)
     * @param lsagSig LSAG signature (σv)
     * @param voterPubKey Voter's public key (Pu')
     * @return kv Registration index or revert on failure
     */
    function BBverify(
        uint256 electionId,
        LSAGSignature memory lsagSig,
        bytes memory voterPubKey
    ) public returns (uint256 kv) {
        // Step 1: LSAG.ver(L, Pu, σv) = 1
        require(LSAGver(electionId, lsagSig), "LSAG verification failed");
        
        // Step 2: Check for linkability with existing registrations
        // if ∃ j ∈ {0,1,··· ,|T|−1}, LSAG.linkVer(Pu, L, L, σv, T[j][0]) = 1
        for (uint256 j = 0; j < registrationTable.length; j++) {
            if (LSAGlinkVer(lsagSig, registrationTable[j].lsagSig)) {
                // abort registration
                emit RegistrationFailed("Invalid Registration - signature already used");
                revert("Invalid Registration - signature already used");
            }
        }
        
        // Step 3: Add to registration table
        // k := |T|
        kv = registrationTable.length;
        
        // T[k] := (σv, Pu')
        registrationTable.push(RegistrationEntry({
            lsagSig: lsagSig,
            publicKey: voterPubKey
        }));
        
        emit RegistrationSuccess(kv, voterPubKey);
        
        return kv;
    }

    /**
     * @dev Get registration table size
     */
    function getRegistrationTableSize() public view returns (uint256) {
        return registrationTable.length;
    }

    /**
     * @dev Get registration entry by index
     */
    function getRegistrationEntry(uint256 index) public view returns (
        uint256 keyImageX,
        uint256 keyImageY,
        uint256 c,
        uint256[] memory s,
        bytes memory publicKey
    ) {
        require(index < registrationTable.length, "Index out of bounds");
        RegistrationEntry memory entry = registrationTable[index];
        return (
            entry.lsagSig.keyImageX,
            entry.lsagSig.keyImageY,
            entry.lsagSig.c,
            entry.lsagSig.s,
            entry.publicKey
        );
    }
}
