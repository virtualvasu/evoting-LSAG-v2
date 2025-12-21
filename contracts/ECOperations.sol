// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ECOperations
 * @dev Library for elliptic curve operations on secp256k1
 * Uses EVM precompiles: ECADD (0x06) and ECMUL (0x07)
 */
library ECOperations {
    // secp256k1 curve parameters
    uint256 constant GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
    uint256 constant GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
    uint256 constant PP = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
    uint256 constant NN = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    // Point at infinity representation
    uint256 constant INFINITY_X = 0;
    uint256 constant INFINITY_Y = 0;

    /**
     * @dev Add two points on the elliptic curve using ECADD precompile
     * @param P1x X coordinate of first point
     * @param P1y Y coordinate of first point
     * @param P2x X coordinate of second point
     * @param P2y Y coordinate of second point
     * @return Rx X coordinate of result
     * @return Ry Y coordinate of result
     */
    function ecAdd(
        uint256 P1x, uint256 P1y,
        uint256 P2x, uint256 P2y
    ) internal view returns (uint256 Rx, uint256 Ry) {
        // Prepare input for ECADD precompile
        uint256[4] memory input;
        input[0] = P1x;
        input[1] = P1y;
        input[2] = P2x;
        input[3] = P2y;

        // Call ECADD precompile at address 0x06
        uint256[2] memory result;
        assembly {
            if iszero(staticcall(gas(), 0x06, input, 0x80, result, 0x40)) {
                revert(0, 0)
            }
        }

        return (result[0], result[1]);
    }

    /**
     * @dev Multiply a point by a scalar on the elliptic curve using ECMUL precompile
     * @param Px X coordinate of point
     * @param Py Y coordinate of point
     * @param s Scalar for multiplication
     * @return Rx X coordinate of result
     * @return Ry Y coordinate of result
     */
    function ecMul(
        uint256 Px, uint256 Py,
        uint256 s
    ) internal view returns (uint256 Rx, uint256 Ry) {
        // Prepare input for ECMUL precompile
        uint256[3] memory input;
        input[0] = Px;
        input[1] = Py;
        input[2] = s;

        // Call ECMUL precompile at address 0x07
        uint256[2] memory result;
        assembly {
            if iszero(staticcall(gas(), 0x07, input, 0x60, result, 0x40)) {
                revert(0, 0)
            }
        }

        return (result[0], result[1]);
    }

    /**
     * @dev Multiply generator point by scalar: [s]G
     * @param s Scalar for multiplication
     * @return Rx X coordinate of result
     * @return Ry Y coordinate of result
     */
    function ecMulG(uint256 s) internal view returns (uint256 Rx, uint256 Ry) {
        return ecMul(GX, GY, s);
    }

    /**
     * @dev Compute [s1]P1 + [s2]P2 (Shamir's trick variant)
     * More efficient than two separate multiplications
     * @param P1x X coordinate of P1
     * @param P1y Y coordinate of P1
     * @param s1 Scalar for P1
     * @param P2x X coordinate of P2
     * @param P2y Y coordinate of P2
     * @param s2 Scalar for P2
     * @return Rx X coordinate of result
     * @return Ry Y coordinate of result
     */
    function ecLinComb(
        uint256 P1x, uint256 P1y, uint256 s1,
        uint256 P2x, uint256 P2y, uint256 s2
    ) internal view returns (uint256 Rx, uint256 Ry) {
        // Compute [s1]P1
        (uint256 R1x, uint256 R1y) = ecMul(P1x, P1y, s1);
        
        // Compute [s2]P2
        (uint256 R2x, uint256 R2y) = ecMul(P2x, P2y, s2);
        
        // Add them: [s1]P1 + [s2]P2
        return ecAdd(R1x, R1y, R2x, R2y);
    }

    /**
     * @dev Verify ECDSA signature on the curve
     * @param message Message hash (32 bytes as uint256)
     * @param r R component of signature
     * @param s S component of signature
     * @param Px X coordinate of public key
     * @param Py Y coordinate of public key
     * @return True if signature is valid
     */
    function ecdsaVerify(
        uint256 message,
        uint256 r, uint256 s,
        uint256 Px, uint256 Py
    ) internal view returns (bool) {
        // Check r and s are in valid range
        if (r >= NN || s >= NN || r == 0 || s == 0) {
            return false;
        }

        // Compute s_inv = s^-1 mod n
        uint256 s_inv = modInverse(s, NN);
        if (s_inv == 0) return false;

        // Compute u1 = (msg * s_inv) mod n
        uint256 u1 = mulmod(message, s_inv, NN);
        
        // Compute u2 = (r * s_inv) mod n
        uint256 u2 = mulmod(r, s_inv, NN);

        // Compute [u1]G + [u2]Q
        (uint256 Px_result, uint256 Py_result) = ecLinComb(
            GX, GY, u1,
            Px, Py, u2
        );

        // Check if x-coordinate matches r
        return Px_result == r;
    }

    /**
     * @dev Compute modular inverse of a number
     * Uses Fermat's little theorem: a^(p-1) ≡ 1 (mod p)
     * So a^-1 ≡ a^(p-2) (mod p)
     */
    function modInverse(uint256 a, uint256 m) internal view returns (uint256) {
        // Use modexp: a^(m-2) mod m
        return modExp(a, m - 2, m);
    }

    /**
     * @dev Modular exponentiation using MODEXP precompile
     */
    function modExp(uint256 base, uint256 exponent, uint256 modulus) internal view returns (uint256 result) {
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 32)           // base length
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
     * @dev Check if point is on the curve: y^2 = x^3 + 7 (mod p)
     */
    function isOnCurve(uint256 x, uint256 y) internal pure returns (bool) {
        uint256 left = mulmod(y, y, PP);
        uint256 right = addmod(mulmod(mulmod(x, x, PP), x, PP), 7, PP);
        return left == right;
    }

    /**
     * @dev Check if point is valid (on curve and not at infinity)
     */
    function isValidPoint(uint256 x, uint256 y) internal pure returns (bool) {
        if (x == INFINITY_X && y == INFINITY_Y) return false;
        return isOnCurve(x, y);
    }

    /**
     * @dev Get the order of the base point (secp256k1 order)
     */
    function getOrder() internal pure returns (uint256) {
        return NN;
    }

    /**
     * @dev Get the generator point
     */
    function getG() internal pure returns (uint256, uint256) {
        return (GX, GY);
    }
}
