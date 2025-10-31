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
        bytes32[] c;           // Challenge array
        bytes32[] s;           // Response array  
        bytes32 linkingTag;    // L (linking tag)
        bytes message;         // The message being signed
        bytes32[] ring;        // Ring of public keys used
    }
    
    // Certificate structure: CERT_v = {σ̃_v, P_ugov, P_uv}
    struct Certificate {
        bytes sigma_tilde_v;   // σ̃_v = PKS.sign(P_uv, P_rgov) - government signature
        bytes P_ugov;          // P_ugov - government public key
        bytes P_uv;            // P_uv - voter's public key
    }
    
    // Mappings
    mapping(bytes => VoterPublicKey) public publicKeys; // signature -> public key
    mapping(bytes => Vote) public votes; // voter key -> vote
    mapping(bytes => TallyResult) public tallyResults; // voter key -> tally
    mapping(bytes32 => bool) public usedLinkingTags; // Track used linking tags
    mapping(bytes32 => bytes32[]) public registeredRings; // Store rings of public keys
    
    // T array structure for storing verified registrations: T[j] = (σ_vu, P_vu)
    struct RegistrationEntry {
        bytes sigma_vu;    // T[j][0] - LSAG signature
        bytes P_vu;        // T[j][1] - voter's public key
        bool exists;
    }
    
    // T array - stores all verified registrations
    RegistrationEntry[] public T;
    mapping(bytes32 => uint256) public registrationIndex; // Maps signature hash to T index
    
    // Ring storage
    bytes32[] public voterRing; // The main ring of all registered voters
    
    // Events
    event PublicKeyStored(bytes signature, bytes publicKey);
    event VoterVerified(bytes sigma_vu, bytes P_vu);
    event RegistrationAdded(uint256 indexed registrationIndex, bytes sigma_vu, bytes P_vu);
    event VoteCast(bytes signature, bytes32 hashValue);
    event TallyCounted(bytes voterKey, bytes candidate);


    // -------- REGISTRATION PHASE -------- //
    
    // ================ BB.storePub =============== //

    // BB.storePub following flowchart: BB.storePub(CERT_u)
    // where CERT_v = {σ̃_v, P_ugov, P_uv} and σ̃_v = PKS.sign(P_uv, P_rgov)
    function storePub(Certificate memory cert_u) public {
        // Use P_uv (voter's public key) as the identifier
        bytes memory voterKey = cert_u.P_uv;
        require(!publicKeys[voterKey].exists, "Public key already stored");
        
        // PKS.ver(CERT_u) = 1 - verify the certificate
        require(pksVerifyCertificate(cert_u), "PKS certificate verification failed");
        
        // P_u := P_u ∪ {P_uw} - add public key to the set
        publicKeys[voterKey] = VoterPublicKey({
            publicKey: cert_u.P_uv,
            exists: true
        });
        
        // Add to the voter ring
        bytes32 pubKeyHash = keccak256(cert_u.P_uv);
        voterRing.push(pubKeyHash);
        
        emit PublicKeyStored(voterKey, cert_u.P_uv);
    }
    
    // PKS certificate verification function for new certificate structure
    function pksVerifyCertificate(Certificate memory cert) internal pure returns (bool) {
        // Verify CERT_v = {σ̃_v, P_ugov, P_uv} where σ̃_v = PKS.sign(P_uv, P_rgov)
        
        // 1. Check if all components are present and valid
        if (cert.sigma_tilde_v.length == 0 || cert.P_ugov.length == 0 || cert.P_uv.length == 0) {
            return false;
        }
        
        // 2. Verify P_uv (voter's public key) is valid
        if (!pksVerify(cert.P_uv)) {
            return false;
        }
        
        // 3. Verify P_ugov (government public key) is valid
        if (!pksVerify(cert.P_ugov)) {
            return false;
        }
        
        // 4. Verify σ̃_v = PKS.sign(P_uv, P_rgov)
        // This should verify that the government has signed the voter's public key
        if (!pksVerifySignature(keccak256(cert.P_uv), cert.P_ugov, cert.sigma_tilde_v)) {
            return false;
        }
        
        return true;
    }
    
    // PKS verification function (helper function)
    function pksVerify(bytes memory certificate) internal pure returns (bool) {
        
        // 1. Check if certificate is not empty
        if (certificate.length == 0) {
            return false;
        }
        
        // 2. Check minimum length for a valid public key (e.g., 32 bytes for secp256k1)
        if (certificate.length < 32) {
            return false;
        }
        
        // 3. Check maximum reasonable length to prevent DoS
        if (certificate.length > 256) {
            return false;
        }
        
        // 4. For elliptic curve public keys, check if it's a valid point
        // This is a simplified check
        if (certificate.length == 64) { // Uncompressed EC public key
            // Check if the key represents a valid point on the curve
            // This would require implementing elliptic curve math
            return isValidECPoint(certificate);
        }
        
        // 5. For compressed EC public keys (33 bytes)
        if (certificate.length == 33) {
            // First byte should be 0x02 or 0x03 for compressed keys
            uint8 prefix = uint8(certificate[0]);
            if (prefix != 0x02 && prefix != 0x03) {
                return false;
            }
            return true;
        }
        
        // 6. Basic hash-based validation (if using hash-based signatures)
        // Check if the certificate has expected structure
        
        return false; // Default to true for other formats
    }

    // Helper function to validate elliptic curve point
    function isValidECPoint(bytes memory point) internal pure returns (bool) {
        // This is a simplified version - you'd need to implement
        // proper elliptic curve point validation for your specific curve
        
        if (point.length != 64) {
            return false;
        }
        
        // Extract x and y coordinates (32 bytes each)
        bytes32 x;
        bytes32 y;
        
        assembly {
            x := mload(add(point, 32))
            y := mload(add(point, 64))
        }
        
        // Check if point is not the point at infinity (0,0)
        if (x == 0 && y == 0) {
            return false;
        }
        
        // For secp256k1, check if point lies on curve: y² ≡ x³ + 7 (mod p)
        // where p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
        return isValidSecp256k1Point(x, y);
    }
    
    // Validate if a point lies on the secp256k1 elliptic curve
    function isValidSecp256k1Point(bytes32 x, bytes32 y) internal pure returns (bool) {
        // secp256k1 prime field modulus
        uint256 p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
        
        // Convert bytes32 to uint256
        uint256 x_coord = uint256(x);
        uint256 y_coord = uint256(y);
        
        // Check if coordinates are within field
        if (x_coord >= p || y_coord >= p) {
            return false;
        }
        
        // Calculate left side: y²
        uint256 left_side = mulmod(y_coord, y_coord, p);
        
        // Calculate right side: x³ + 7
        uint256 x_squared = mulmod(x_coord, x_coord, p);
        uint256 x_cubed = mulmod(x_squared, x_coord, p);
        uint256 right_side = addmod(x_cubed, 7, p);
        
        // Check if y² ≡ x³ + 7 (mod p)
        return left_side == right_side;
    }

    // =========================== // 
    
    // =============== LSAG Functions ================== //
    
    // LSAG.ver - Verify LSAG signature
    function lsagVer(
        bytes32[] memory ring,
        bytes memory publicKey,
        LSAGSignature memory signature
    ) internal pure returns (bool) {
        // Basic validation
        if (ring.length == 0 || signature.c.length != ring.length || signature.s.length != ring.length) {
            return false;
        }
        
        // Find the position of the public key in the ring
        bytes32 pubKeyHash = keccak256(publicKey);
        uint256 signerIndex = ring.length; // Invalid index initially
        
        for (uint256 i = 0; i < ring.length; i++) {
            if (ring[i] == pubKeyHash) {
                signerIndex = i;
                break;
            }
        }
        
        if (signerIndex >= ring.length) {
            return false; // Public key not found in ring
        }
        
        // Verify the ring signature using the standard LSAG verification algorithm
        bytes32 h = keccak256(abi.encodePacked(signature.message, signature.linkingTag));
        
        // Reconstruct the challenge
        bytes32 computedChallenge = signature.c[0];
        
        for (uint256 i = 0; i < ring.length; i++) {
            bytes32 tempHash;
            if (i == signerIndex) {
                // For the signer's position, use the response directly
                tempHash = keccak256(abi.encodePacked(
                    ring[i],
                    signature.s[i],
                    h
                ));
            } else {
                // For other positions, use challenge and response
                tempHash = keccak256(abi.encodePacked(
                    ring[i],
                    signature.c[i],
                    signature.s[i],
                    h
                ));
            }
            
            if (i == ring.length - 1) {
                // Final verification
                computedChallenge = keccak256(abi.encodePacked(computedChallenge, tempHash));
            } else {
                computedChallenge = keccak256(abi.encodePacked(computedChallenge, tempHash));
            }
        }
        
        return computedChallenge == signature.c[0];
    }
    
    // LSAG.linkVer - Check if two LSAG signatures are linked
    function lsagLinkVer(
        bytes memory publicKey,
        bytes32[] memory ring,
        LSAGSignature memory signature1,
        LSAGSignature memory signature2
    ) internal pure returns (bool) {
        // Two signatures are linked if they have the same linking tag
        // and both are valid signatures from the same ring
        if (signature1.linkingTag != signature2.linkingTag) {
            return false;
        }
        
        // Verify both signatures are valid
        if (!lsagVer(ring, publicKey, signature1)) {
            return false;
        }
        
        if (!lsagVer(ring, publicKey, signature2)) {
            return false;
        }
        
        return true;
    }
    
    // Helper function to get the current voter ring
    function getVoterRing() public view returns (bytes32[] memory) {
        return voterRing;
    }

    // =============== BB.verify ================== //
    
    // BB.verify implementation following the flowchart exactly: BB.verify(σ_vu, P_vu)
    function verify(
        bytes memory sigma_vu,     // σ_vu - LSAG signature from voter
        bytes memory P_vu          // P_vu - voter's public key
    ) public returns (bool) {
        
        // Get the current ring L
        bytes32[] memory L = getVoterRing();
        
        // Create LSAG signature structure for verification
        LSAGSignature memory lsagSig = parseLSAGSignature(sigma_vu);
        
        // Step 1: LSAG.ver(L, P_vu, σ_vu) = 1
        bool isValidSignature = lsagVer(L, P_vu, lsagSig);
        
        if (isValidSignature) {
            // If LSAG signature is valid (jr = 1)
            
            // Step 2: ∃j ∈ {0,1,...,|T|-1}: LSAG.linkVer(P_vu, L, σ_vu, T[j][0]) = 1
            // Loop through all existing registrations in T array
            for (uint256 j = 0; j < T.length; j++) {
                if (T[j].exists) {
                    // Parse the stored signature T[j][0]
                    LSAGSignature memory storedSig = parseLSAGSignature(T[j].sigma_vu);
                    
                    // Check LSAG.linkVer(P_vu, L, σ_vu, T[j][0]) = 1
                    if (lsagLinkVer(P_vu, L, lsagSig, storedSig)) {
                        // If linked signature found, abort registration
                        revert("Invalid Registration - Linked signature detected");
                    }
                }
            }
            
            // If no linking found, proceed with valid registration
            // k_u = 1 (valid registration)
            
            // T[u] := (σ_vu, P_vu) - add new registration to T array
            uint256 newIndex = T.length;
            T.push(RegistrationEntry({
                sigma_vu: sigma_vu,
                P_vu: P_vu,
                exists: true
            }));
            
            // Store mapping for quick lookup
            bytes32 sigHash = keccak256(sigma_vu);
            registrationIndex[sigHash] = newIndex;
            
            // Also maintain the old publicKeys mapping for compatibility
            publicKeys[sigma_vu] = VoterPublicKey({
                publicKey: P_vu,
                exists: true
            });
            
            // Add to voter ring
            bytes32 pubKeyHash = keccak256(P_vu);
            voterRing.push(pubKeyHash);
            
            emit VoterVerified(sigma_vu, P_vu);
            emit RegistrationAdded(newIndex, sigma_vu, P_vu);
            return true;
            
        } else {
            // If LSAG signature is invalid (jr ≠ 1), abort registration
            revert("Invalid Registration - LSAG signature verification failed");
        }
    }
    
    // Helper function to parse LSAG signature from bytes
    function parseLSAGSignature(bytes memory sigma_vu) internal pure returns (LSAGSignature memory) {
        // This is a simplified parser - in practice, you'd properly decode the signature
        // For now, create a mock structure for demonstration
        
        bytes32[] memory c = new bytes32[](1);
        bytes32[] memory s = new bytes32[](1);
        bytes32[] memory ring = new bytes32[](0);
        
        if (sigma_vu.length >= 64) {
            bytes32 temp1;
            bytes32 temp2;
            assembly {
                let dataPtr := add(sigma_vu, 32)
                temp1 := mload(dataPtr)
                temp2 := mload(add(dataPtr, 32))
            }
            c[0] = temp1;
            s[0] = temp2;
        }
        
        return LSAGSignature({
            c: c,
            s: s,
            linkingTag: keccak256(sigma_vu), // Simplified linking tag
            message: sigma_vu,
            ring: ring
        });
    }
    
    // =============== BB.voting ================== //
    
    // BB.voting - Submit hashed vote following flowchart: BB.voting(σ'_vu, h_v, k_v)
    function voting(
        bytes memory sigma_v_prime, // σ'_vu - LSAG signature for voting
        bytes32 h_v,               // h_v - hash of vote (H(c||r))
        bytes memory k_v           // k_v - PKS signature of h_v
    ) public {
        // Find voter by their linking tag (from sigma_v_prime)
        // For now, using sigma_v_prime as voter identifier
        require(publicKeys[sigma_v_prime].exists, "Voter not registered");
        require(!votes[sigma_v_prime].exists, "Vote already cast");
        
        // Get stored public key for this voter
        bytes memory storedPubKey = publicKeys[sigma_v_prime].publicKey;
        
        // PKS.ver(h_v, T[k_v][2], σ'_v) = 1 - Verify PKS signature on hash
        require(pksVerifySignature(h_v, storedPubKey, k_v), "PKS signature verification failed");
        
        // Store the vote
        votes[sigma_v_prime] = Vote({
            hashValue: h_v,
            hashedVote: k_v,  // Store k_v as the hashed vote
            exists: true
        });
        
        emit VoteCast(sigma_v_prime, h_v);
    }
    
    // PKS signature verification for voting
    function pksVerifySignature(
        bytes32 message, 
        bytes memory publicKey, 
        bytes memory signature
    ) internal pure returns (bool) {
        // Simplified PKS signature verification
        // In a real implementation, this would verify the signature against the message
        
        // Basic checks
        if (signature.length == 0 || publicKey.length == 0) {
            return false;
        }
        
        // For demonstration: verify signature format and basic structure
        // Real implementation would use cryptographic verification
        
        // Check signature length (assuming ECDSA signature)
        if (signature.length != 65) { // 65 bytes for ECDSA signature
            return false;
        }
        
        // Verify the message was actually signed by reconstructing
        bytes32 messageHash = keccak256(abi.encodePacked(message));
        
        // In real implementation: recover public key from signature and compare
        // For now: simplified check based on structure
        // Use messageHash in verification logic
        if (messageHash == bytes32(0)) {
            return false;
        }
        
        return true; // Placeholder - implement proper ECDSA verification
    }
    
    // =============== BB.tally ================== //
    
    // BB.tally - Record decrypted vote following flowchart: BB.tally(c, r, k_v)
    function tally(
        bytes memory c,        // candidate choice
        bytes memory r,        // randomness used in vote
        bytes memory k_v       // voter key (k_v from voting phase)
    ) public {
        require(votes[k_v].exists, "No vote found for this voter key");
        require(!tallyResults[k_v].exists, "Vote already tallied");
        
        // Critical verification: if T[k_v][2] ≠ H(c||r) then abort vote counting
        bytes32 computedHash = keccak256(abi.encodePacked(c, r));
        bytes32 storedHash = votes[k_v].hashValue;
        
        require(computedHash == storedHash, "Vote integrity check failed - H(c||r) does not match stored hash");
        
        // If verification passes, store the tally result
        tallyResults[k_v] = TallyResult({
            candidate: c,
            randomness: r,
            exists: true
        });
        
        emit TallyCounted(k_v, c);
    }
    
    // Helper function to check if voter has voted
    function hasVoted(bytes memory voterKey) public view returns (bool) {
        return votes[voterKey].exists;
    }
    
    // Helper function to check if vote has been tallied
    function isTallied(bytes memory voterKey) public view returns (bool) {
        return tallyResults[voterKey].exists;
    }
    
    // =============== LSAG Helper Functions ================== //
    
    // Get the total number of verified registrations
    function getTotalRegistrations() public view returns (uint256) {
        return T.length;
    }
    
    // Get registration entry by index
    function getRegistration(uint256 index) public view returns (RegistrationEntry memory) {
        require(index < T.length, "Registration index out of bounds");
        return T[index];
    }
    
    // Check if a signature is already registered
    function isSignatureRegistered(bytes memory sigma_vu) public view returns (bool) {
        bytes32 sigHash = keccak256(sigma_vu);
        if (registrationIndex[sigHash] < T.length) {
            return T[registrationIndex[sigHash]].exists;
        }
        return false;
    }
    
    // Helper function to create a certificate structure
    function createCertificate(
        bytes memory sigma_tilde_v,  // σ̃_v = PKS.sign(P_uv, P_rgov)
        bytes memory P_ugov,         // Government public key
        bytes memory P_uv            // Voter's public key
    ) public pure returns (Certificate memory) {
        return Certificate({
            sigma_tilde_v: sigma_tilde_v,
            P_ugov: P_ugov,
            P_uv: P_uv
        });
    }
    
    // Check if a linking tag has been used
    function isLinkingTagUsed(bytes32 linkingTag) public view returns (bool) {
        return usedLinkingTags[linkingTag];
    }
    
    // Get the size of the current voter ring
    function getRingSize() public view returns (uint256) {
        return voterRing.length;
    }
    
    // Verify if a public key is in the ring
    function isPublicKeyInRing(bytes memory publicKey) public view returns (bool) {
        bytes32 pubKeyHash = keccak256(publicKey);
        for (uint256 i = 0; i < voterRing.length; i++) {
            if (voterRing[i] == pubKeyHash) {
                return true;
            }
        }
        return false;
    }
    
    // Create LSAG signature structure (helper for off-chain creation)
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

//todo: bring lasg.ver and lsag.linkver and pks.ver on chain (security) - next friday ()


//todo: revise the voting part by encrypting c and r with the pressiding officer's public key and storing voting phase 
//todo: use zk proof for the proof of authenticity of private key of presiding officer
