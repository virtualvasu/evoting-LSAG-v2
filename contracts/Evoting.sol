// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./MessageHashUtils.sol";
import "./ECOperations.sol";

contract EVoting {
    using ECDSA for bytes32;
    using ECOperations for *;

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

    // LSAG Signature structure - Now stores actual cryptographic components
    struct LSAGSignature {
        bytes32[] c;              // Array of challenges for each ring member
        bytes32[] s;              // Array of responses for each ring member
        bytes keyImage;           // Key image (linking tag): I = x * H_p(P) - 33 bytes compressed point
        bytes message;            // Original message being signed
        uint256[] ringX;          // X coordinates of ring public keys
        uint256[] ringY;          // Y coordinates of ring public keys
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
    mapping(bytes32 => bytes) public hashToPublicKey;  // Map hash to actual public key

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
        bytes memory P_vu,
        bytes memory keyImage  // NEW: actual key image for linkability
    ) public returns (bool) {
        bytes memory message = "VOTER_REGISTRATION";
        
        // Parse the LSAG signature (expects specific binary format)
        LSAGSignature memory lsagSig = parseLSAGSignature(sigma_vu);
        
        // Populate ring from stored public keys
        uint256 ringSize = voterRing.length;
        lsagSig.ringX = new uint256[](ringSize);
        lsagSig.ringY = new uint256[](ringSize);
        
        for (uint256 i = 0; i < ringSize; i++) {
            bytes32 pkHash = voterRing[i];
            bytes memory pk = hashToPublicKey[pkHash];
            require(pk.length == 64, "Invalid stored public key length");
            
            // Parse uncompressed public key (64 bytes: 32 bytes x + 32 bytes y)
            uint256 x;
            uint256 y;
            assembly {
                x := mload(add(pk, 32))  // First 32 bytes
                y := mload(add(pk, 64))  // Second 32 bytes
            }
            lsagSig.ringX[i] = x;
            lsagSig.ringY[i] = y;
        }
        
        // Verify the signature is valid
        require(lsagVer(P_vu, lsagSig, message), "Invalid LSAG signature");
        
        // Check if this key image was already used (prevents double voting)
        bytes32 keyImageHash = keccak256(keyImage);
        require(!usedLinkingTags[keyImageHash], "Key image already used - double registration");
        
        // Mark key image as used
        usedLinkingTags[keyImageHash] = true;
        
        // Store registration
        uint256 newIndex = T.length;
        T.push(RegistrationEntry({
            sigma_vu: sigma_vu,
            P_vu: P_vu,
            exists: true
        }));
        
        bytes32 sigHash = keccak256(sigma_vu);
        registrationIndex[sigHash] = newIndex;
        publicKeys[sigma_vu] = VoterPublicKey({ publicKey: P_vu, exists: true });
        bytes32 pubKeyHash = keccak256(P_vu);
        voterRing.push(pubKeyHash);
        hashToPublicKey[pubKeyHash] = P_vu;  // Store mapping
        
        emit VoterVerified(sigma_vu, P_vu);
        emit RegistrationAdded(newIndex, sigma_vu, P_vu);
        
        return true;
    }

    function parseLSAGSignature(bytes memory sigma_vu) 
        internal pure returns (LSAGSignature memory) 
    {
        /**
         * Binary format from JavaScript:
         * - All c values (32 bytes each): c[0], c[1], ..., c[n-1]
         * - All s values (32 bytes each): s[0], s[1], ..., s[n-1]
         * - Key image (33 bytes): compressed EC point
         * 
         * Total: (32 * n) + (32 * n) + 33 = 64*n + 33 bytes
         */
        require(sigma_vu.length >= 97, "Signature too short"); // min: c[0] + s[0] + keyImage (32+32+33)
        require((sigma_vu.length - 33) % 64 == 0, "Invalid signature length");
        
        uint256 n = (sigma_vu.length - 33) / 64; // ring size
        
        LSAGSignature memory sig;
        sig.c = new bytes32[](n);
        sig.s = new bytes32[](n);
        sig.message = bytes("VOTER_REGISTRATION");
        
        uint256 offset = 0;
        
        // Parse c values
        for (uint256 i = 0; i < n; i++) {
            bytes32 c_i;
            assembly {
                c_i := mload(add(add(sigma_vu, 32), offset))
            }
            sig.c[i] = c_i;
            offset += 32;
        }
        
        // Parse s values
        for (uint256 i = 0; i < n; i++) {
            bytes32 s_i;
            assembly {
                s_i := mload(add(add(sigma_vu, 32), offset))
            }
            sig.s[i] = s_i;
            offset += 32;
        }
        
        // Parse key image (last 33 bytes)
        sig.keyImage = new bytes(33);
        for (uint256 i = 0; i < 33; i++) {
            sig.keyImage[i] = sigma_vu[offset + i];
        }
        
        return sig;
    }

    function lsagVer(
        bytes memory publicKey,
        LSAGSignature memory signature,
        bytes memory message
    ) internal view returns (bool) {
        /**
         * Real LSAG Verification using elliptic curve precompiles
         * 
         * Verify the ring equation:
         * For each position i in the ring:
         *   L_i = [s_i]G + [c_i]P_i
         *   R_i = [s_i]H_p(P_i) + [c_i]I
         *   c_{i+1} = H(m || L_i || R_i)
         * 
         * If the ring closes (c_0 computed at end matches c_0 from signature), signature is valid
         */
        
        require(signature.c.length > 0, "Signature missing challenges");
        require(signature.s.length == signature.c.length, "Mismatched c and s lengths");
        require(signature.keyImage.length == 33, "Invalid key image length");
        
        uint256 n = signature.c.length;
        bytes32 messageHash = keccak256(message);
        
        // Parse key image (compressed point, 33 bytes)
        (uint256 Ix, uint256 Iy) = decompressPoint(signature.keyImage);
        require(Ix != 0 || Iy != 0, "Invalid key image");
        
        // Parse public keys from ring (stored as X,Y coordinates in signature)
        require(signature.ringX.length == n, "Ring X mismatch");
        require(signature.ringY.length == n, "Ring Y mismatch");
        
        // Verify ring equation
        bytes32 computedC = signature.c[0];
        
        for (uint256 i = 0; i < n; i++) {
            // Extract signature components
            uint256 c_i = uint256(signature.c[i]);
            uint256 s_i = uint256(signature.s[i]);
            
            // Compute L_i = [s_i]G + [c_i]P_i
            (uint256 Li_x, uint256 Li_y) = ECOperations.ecLinComb(
                ECOperations.GX, ECOperations.GY, s_i,
                signature.ringX[i], signature.ringY[i], c_i
            );
            
            // Compute H_p(P_i) - hash point for this ring member
            // In production, this must match the JavaScript implementation
            (uint256 Hp_x, uint256 Hp_y) = hashToPoint(
                abi.encodePacked(signature.ringX[i], signature.ringY[i])
            );
            
            // Compute R_i = [s_i]H_p(P_i) + [c_i]I
            (uint256 Ri_x, uint256 Ri_y) = ECOperations.ecLinComb(
                Hp_x, Hp_y, s_i,
                Ix, Iy, c_i
            );
            
            // Compute c_{i+1} = H(m || L_i || R_i)
            bytes32 nextC = keccak256(abi.encodePacked(
                messageHash,
                Li_x, Li_y,
                Ri_x, Ri_y
            ));
            
            computedC = nextC;
            
            // If we've completed the ring, check if it closes
            if (i == n - 1) {
                // Final check: computed c should match signature.c[0]
                return uint256(computedC) == uint256(signature.c[0]);
            }
        }
        
        return false;
    }

    /**
     * @dev Decompress a compressed elliptic curve point (33 bytes)
     * Format: 0x02 or 0x03 prefix + 32 bytes of x-coordinate
     * Returns the (x, y) coordinates
     */
    function decompressPoint(bytes memory compressedPoint)
        internal view returns (uint256 x, uint256 y)
    {
        require(compressedPoint.length == 33, "Invalid compressed point length");
        
        // Extract prefix and x-coordinate
        uint8 prefix;
        assembly {
            prefix := byte(0, mload(add(compressedPoint, 32)))
        }
        
        // Extract x coordinate (32 bytes) - skip first byte (prefix)
        bytes32 xBytes;
        assembly {
            xBytes := mload(add(compressedPoint, 33))
        }
        x = uint256(xBytes);
        
        // Compute y^2 = x^3 + 7 (mod p)
        uint256 p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
        uint256 y_squared = addmod(
            mulmod(mulmod(x, x, p), x, p),
            7,
            p
        );
        
        // Compute square root using Tonelli-Shanks or similar
        // For secp256k1, we can use: y = y_squared^((p+1)/4) mod p
        uint256 exponent = (p + 1) / 4;
        y = modpow(y_squared, exponent, p);
        
        // Check if we need the other root
        uint8 expectedPrefix = uint8((y & 1) == 0 ? 2 : 3);
        if (expectedPrefix != prefix) {
            y = p - y; // Take the other root
        }
        
        return (x, y);
    }

    /**
     * @dev Compute y = base^exp mod modulus
     * Uses the MODEXP precompile for efficiency
     */
    function modpow(uint256 base, uint256 exponent, uint256 modulus)
        internal view returns (uint256 result)
    {
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 32)            // base length
            mstore(add(freemem, 32), 32)   // exp length
            mstore(add(freemem, 64), 32)   // mod length
            mstore(add(freemem, 96), base)
            mstore(add(freemem, 128), exponent)
            mstore(add(freemem, 160), modulus)
            
            if iszero(staticcall(gas(), 0x05, freemem, 0xc0, freemem, 0x20)) {
                revert(0, 0)
            }
            result := mload(freemem)
        }
    }

    /**
     * @dev Hash data to a point on the curve
     * Uses a deterministic approach with counter
     * This must match the JavaScript implementation
     */
    function hashToPoint(bytes memory data)
        internal pure returns (uint256 x, uint256 y)
    {
        // Simplified version - in production, implement full hash-to-point
        // with curve equation verification
        bytes32 hash = keccak256(data);
        x = uint256(hash);
        
        // For now, return a deterministic point
        // Full implementation would solve the curve equation
        y = uint256(keccak256(abi.encodePacked(hash, uint8(1))));
        
        return (x, y);
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
        bytes memory keyImage,
        bytes memory message,
        uint256[] memory ringX,
        uint256[] memory ringY
    ) public pure returns (LSAGSignature memory) {
        return LSAGSignature({
            c: c,
            s: s,
            keyImage: keyImage,
            message: message,
            ringX: ringX,
            ringY: ringY
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

//todo: revise the voting part by encrypting c and r with the pressiding officer's public key and storing voting phase 
//todo: use zk proof for the proof of authenticity of private key of presiding officer