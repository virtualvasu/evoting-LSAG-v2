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

    // Certificate structure: CERT_v = {σ̃_v, P_ugov, P_uv, voterName, sid}
    struct Certificate {
        bytes sigma_tilde_v;   // σ̃_v = PKS.sign({voter_name, student_id, voter_public_key}, P_rgov)
        bytes P_ugov;          // P_ugov - government public key
        bytes P_uv;            // P_uv - voter's public key
        string voterName;      // Voter's name
        string sid;            // Student/Voter ID
    }

    // Mappings
    mapping(bytes => VoterPublicKey) public publicKeys;
    
    // Voter ring storage
    bytes32[] public voterRing;
    mapping(bytes32 => bytes) public hashToPublicKey;  // Map hash to actual public key

    // Events
    event PublicKeyStored(bytes signature, bytes publicKey);

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
}
