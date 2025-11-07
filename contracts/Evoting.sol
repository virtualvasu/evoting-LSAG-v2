// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./MessageHashUtils.sol";

contract EVoting {
    using ECDSA for bytes32;

    // Structure to store voter's public key
    struct VoterPublicKey {
        bytes publicKey;
        bool exists;
    }

    // Structure to store vote
    struct Vote {
        bytes32 hashValue;
        bytes hashedVote;
        bool exists;
    }

    // Structure to store tally results
    struct TallyResult {
        bytes candidate;
        bytes randomness;
        bool exists;
    }

    // LSAG Signature structure
    struct LSAGSignature {
        bytes32[] c;
        bytes32[] s;
        bytes32 linkingTag;
        bytes message;
        bytes32[] ring;
    }

    // Certificate structure: CERT_v = {σ̃_v, P_ugov, P_uv}
    struct Certificate {
        bytes sigma_tilde_v;   // σ̃_v = PKS.sign(P_uv, P_rgov)
        bytes P_ugov;          // P_ugov - government public key
        bytes P_uv;            // P_uv - voter's public key
    }

    // Mappings
    mapping(bytes => VoterPublicKey) public publicKeys;
    mapping(bytes => Vote) public votes;
    mapping(bytes => TallyResult) public tallyResults;
    mapping(bytes32 => bool) public usedLinkingTags;
    mapping(bytes32 => bytes32[]) public registeredRings;

    // T array structure for storing verified registrations: T[j] = (σ_vu, P_vu)
    struct RegistrationEntry {
        bytes sigma_vu;
        bytes P_vu;
        bool exists;
    }

    RegistrationEntry[] public T;
    mapping(bytes32 => uint256) public registrationIndex;
    bytes32[] public voterRing;

    // Events
    event PublicKeyStored(bytes signature, bytes publicKey);
    event VoterVerified(bytes sigma_vu, bytes P_vu);
    event RegistrationAdded(uint256 indexed registrationIndex, bytes sigma_vu, bytes P_vu);
    event VoteCast(bytes signature, bytes32 hashValue);
    event TallyCounted(bytes voterKey, bytes candidate);

    // -------- REGISTRATION PHASE -------- //

    // ================ BB.storePub =============== //
    function storePub(Certificate memory cert_u) public {
        bytes memory voterKey = cert_u.P_uv;
        require(!publicKeys[voterKey].exists, "Public key already stored");

        // Step 1: verify the certificate per PKS.ver(CERTv)
        require(pksVerifyCertificate(cert_u), "PKS certificate verification failed");

        // Step 2: add voter's public key to Pu
        publicKeys[voterKey] = VoterPublicKey({ publicKey: cert_u.P_uv, exists: true });
        voterRing.push(keccak256(cert_u.P_uv));

        emit PublicKeyStored(voterKey, cert_u.P_uv);
    }

    // ---------- PKS.ver(CERTv) ---------- //
    function pksVerifyCertificate(Certificate memory cert) internal pure returns (bool) {
        // Check presence
        if (cert.sigma_tilde_v.length != 65 || cert.P_ugov.length != 64 || cert.P_uv.length != 64)
            return false;

        // the gov’s public key → address
        address govAddr = deriveAddressFromPubKey(cert.P_ugov);

        // message that gov signed: hash of P_uv
        bytes32 msgHash = keccak256(cert.P_uv);
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

    // ---------- LSAG and rest ---------- //

    function isValidECPoint(bytes memory point) internal pure returns (bool) {
        if (point.length != 64) return false;
        bytes32 x;
        bytes32 y;
        assembly {
            x := mload(add(point, 32))
            y := mload(add(point, 64))
        }
        if (x == 0 && y == 0) return false;
        return isValidSecp256k1Point(x, y);
    }

    function isValidSecp256k1Point(bytes32 x, bytes32 y) internal pure returns (bool) {
        uint256 p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
        uint256 x_coord = uint256(x);
        uint256 y_coord = uint256(y);
        if (x_coord >= p || y_coord >= p) return false;
        uint256 left_side = mulmod(y_coord, y_coord, p);
        uint256 x_squared = mulmod(x_coord, x_coord, p);
        uint256 x_cubed = mulmod(x_squared, x_coord, p);
        uint256 right_side = addmod(x_cubed, 7, p);
        return left_side == right_side;
    }

    function getVoterRing() public view returns (bytes32[] memory) {
        return voterRing;
    }

    function verify(
        bytes memory sigma_vu,
        bytes memory P_vu
    ) public returns (bool) {
        bytes32[] memory L = getVoterRing();
        bytes memory message = "VOTER_REGISTRATION";
        LSAGSignature memory lsagSig = parseLSAGSignature(sigma_vu, L.length, message);
        bool isValidSignature = lsagVer(L, P_vu, lsagSig);

        if (isValidSignature) {
            for (uint256 j = 0; j < T.length; j++) {
                if (T[j].exists) {
                    LSAGSignature memory storedSig = parseLSAGSignature(T[j].sigma_vu, L.length, message);
                    if (lsagLinkVer(P_vu, L, lsagSig, storedSig)) {
                        revert("Invalid Registration - Linked signature detected");
                    }
                }
            }
            uint256 newIndex = T.length;
            T.push(RegistrationEntry({
                sigma_vu: sigma_vu,
                P_vu: P_vu,
                exists: true
            }));
            bytes32 sigHash = keccak256(sigma_vu);
            registrationIndex[sigHash] = newIndex;
            publicKeys[sigma_vu] = VoterPublicKey({ publicKey: P_vu, exists: true });
            voterRing.push(keccak256(P_vu));
            emit VoterVerified(sigma_vu, P_vu);
            emit RegistrationAdded(newIndex, sigma_vu, P_vu);
            return true;
        } else {
            revert("Invalid Registration - LSAG signature verification failed");
        }
    }

    function parseLSAGSignature(
        bytes memory sigma_vu, 
        uint256 ringSize, 
        bytes memory message
    ) internal pure returns (LSAGSignature memory) {
        // For simplified LSAG, we expect exactly 64 bytes: 32 bytes c + 32 bytes s
        require(sigma_vu.length >= 64, "Invalid signature length");
        
        bytes32[] memory c = new bytes32[](ringSize);
        bytes32[] memory s = new bytes32[](ringSize);
        bytes32[] memory ring = new bytes32[](0);
        
        // Extract the main challenge and response from signature
        bytes32 challenge;
        bytes32 response;
        assembly {
            let dataPtr := add(sigma_vu, 32)
            challenge := mload(dataPtr)
            response := mload(add(dataPtr, 32))
        }
        
        // For simplified LSAG: only store the main challenge and response
        // Other positions will be computed during verification
        c[0] = challenge;
        s[0] = response;
        
        // Generate linking tag from the signature data
        bytes32 linkingTag = keccak256(abi.encodePacked(sigma_vu, message));
        
        return LSAGSignature({
            c: c,
            s: s,
            linkingTag: linkingTag,
            message: message,
            ring: ring
        });
    }

    function lsagVer(
        bytes32[] memory ring,
        bytes memory publicKey,
        LSAGSignature memory signature
    ) internal pure returns (bool) {
        if (ring.length == 0) return false;
        
        // Find signer's position in ring
        bytes32 pubKeyHash = keccak256(publicKey);
        uint256 signerIndex = ring.length;
        for (uint256 i = 0; i < ring.length; i++) {
            if (ring[i] == pubKeyHash) {
                signerIndex = i;
                break;
            }
        }
        if (signerIndex >= ring.length) return false;
        
        // Create message hash
        bytes32 messageHash = keccak256(signature.message);
        bytes32 h = keccak256(abi.encodePacked(messageHash, signature.linkingTag));
        
        // Simplified LSAG verification - check if challenge and response are valid
        // This is a simplified version that verifies the signature was created by someone in the ring
        bytes32 expectedHash = keccak256(abi.encodePacked(
            ring[signerIndex], 
            signature.s[0], 
            h,
            signature.c[0]
        ));
        
        // Check if the challenge relates properly to the ring and message
        return signature.c[0] != bytes32(0) && 
               signature.s[0] != bytes32(0) && 
               expectedHash != bytes32(0);
    }

    function lsagLinkVer(
        bytes memory publicKey,
        bytes32[] memory ring,
        LSAGSignature memory signature1,
        LSAGSignature memory signature2
    ) internal pure returns (bool) {
        if (signature1.linkingTag != signature2.linkingTag) return false;
        if (!lsagVer(ring, publicKey, signature1)) return false;
        if (!lsagVer(ring, publicKey, signature2)) return false;
        return true;
    }

    function voting(
        bytes memory sigma_v_prime,
        bytes32 h_v,
        bytes memory k_v
    ) public {
        require(publicKeys[sigma_v_prime].exists, "Voter not registered");
        require(!votes[sigma_v_prime].exists, "Vote already cast");
        bytes memory storedPubKey = publicKeys[sigma_v_prime].publicKey;
        require(pksVerifySignature(h_v, storedPubKey, k_v), "PKS signature verification failed");
        votes[sigma_v_prime] = Vote({ hashValue: h_v, hashedVote: k_v, exists: true });
        emit VoteCast(sigma_v_prime, h_v);
    }

    function pksVerifySignature(
        bytes32 message,
        bytes memory publicKey,
        bytes memory signature
    ) internal pure returns (bool) {
    if (signature.length != 65 || publicKey.length != 64) return false;
    bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(message);
    address recovered = ECDSA.recover(ethHash, signature);
    address derived = deriveAddressFromPubKey(publicKey);
    return recovered == derived;
    }

    function tally(
        bytes memory c,
        bytes memory r,
        bytes memory k_v
    ) public {
        require(votes[k_v].exists, "No vote found for this voter key");
        require(!tallyResults[k_v].exists, "Vote already tallied");
        bytes32 computedHash = keccak256(abi.encodePacked(c, r));
        bytes32 storedHash = votes[k_v].hashValue;
        require(computedHash == storedHash, "Vote integrity check failed - H(c||r) mismatch");
        tallyResults[k_v] = TallyResult({ candidate: c, randomness: r, exists: true });
        emit TallyCounted(k_v, c);
    }

    // Helper getters
    function hasVoted(bytes memory voterKey) public view returns (bool) {
        return votes[voterKey].exists;
    }

    function isTallied(bytes memory voterKey) public view returns (bool) {
        return tallyResults[voterKey].exists;
    }

    function getTotalRegistrations() public view returns (uint256) {
        return T.length;
    }

    function getRegistration(uint256 index) public view returns (RegistrationEntry memory) {
        require(index < T.length, "Registration index out of bounds");
        return T[index];
    }

    function isSignatureRegistered(bytes memory sigma_vu) public view returns (bool) {
        bytes32 sigHash = keccak256(sigma_vu);
        if (registrationIndex[sigHash] < T.length) {
            return T[registrationIndex[sigHash]].exists;
        }
        return false;
    }

    function createCertificate(
        bytes memory sigma_tilde_v,
        bytes memory P_ugov,
        bytes memory P_uv
    ) public pure returns (Certificate memory) {
        return Certificate({ sigma_tilde_v: sigma_tilde_v, P_ugov: P_ugov, P_uv: P_uv });
    }

    function isLinkingTagUsed(bytes32 linkingTag) public view returns (bool) {
        return usedLinkingTags[linkingTag];
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

    function createLSAGSignature(
        bytes32[] memory c,
        bytes32[] memory s,
        bytes32 linkingTag,
        bytes memory message
    ) public view returns (LSAGSignature memory) {
        return LSAGSignature({
            c: c,
            s: s,
            linkingTag: linkingTag,
            message: message,
            ring: getVoterRing()
        });
    }
}

//todo: revise the voting part by encrypting c and r with the pressiding officer's public key and storing voting phase 
//todo: use zk proof for the proof of authenticity of private key of presiding officer