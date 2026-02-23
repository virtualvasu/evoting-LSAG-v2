// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Secp256k1
 * @dev Elliptic curve operations on secp256k1
 * Modernized from reference implementation for use with LSAG signatures
 */
contract Secp256k1 {
    uint256 constant GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
    uint256 constant GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
    uint256 constant PP = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
    uint256 constant A = 0;
    uint256 constant B = 7;

    function _jAdd(uint256 x1, uint256 z1, uint256 x2, uint256 z2) internal pure
        returns(uint256 x3, uint256 z3)
    {
        x3 = addmod(mulmod(z2, x1, PP), mulmod(x2, z1, PP), PP);
        z3 = mulmod(z1, z2, PP);
    }

    function _jSub(uint256 x1, uint256 z1, uint256 x2, uint256 z2) internal pure
        returns(uint256 x3, uint256 z3)
    {
        x3 = addmod(mulmod(z2, x1, PP), mulmod(PP - x2, z1, PP), PP);
        z3 = mulmod(z1, z2, PP);
    }

    function _jMul(uint256 x1, uint256 z1, uint256 x2, uint256 z2) internal pure
        returns(uint256 x3, uint256 z3)
    {
        x3 = mulmod(x1, x2, PP);
        z3 = mulmod(z1, z2, PP);
    }

    function _jDiv(uint256 x1, uint256 z1, uint256 x2, uint256 z2) internal pure
        returns(uint256 x3, uint256 z3)
    {
        x3 = mulmod(x1, z2, PP);
        z3 = mulmod(z1, x2, PP);
    }

    function _inverse(uint256 a) internal pure returns(uint256 invA) {
        uint256 t = 0;
        uint256 newT = 1;
        uint256 r = PP;
        uint256 newR = a;
        uint256 q;
        
        while (newR != 0) {
            q = r / newR;
            (t, newT) = (newT, addmod(t, (PP - mulmod(q, newT, PP)), PP));
            (r, newR) = (newR, r - q * newR);
        }
        
        return t;
    }

    function _ecAdd(uint256 x1, uint256 y1, uint256 z1,
                    uint256 x2, uint256 y2, uint256 z2) internal pure
        returns(uint256 x3, uint256 y3, uint256 z3)
    {
        uint256 l;
        uint256 lz;
        uint256 da;
        uint256 db;

        if ((x1 == 0) && (y1 == 0)) {
            return (x2, y2, z2);
        }

        if ((x2 == 0) && (y2 == 0)) {
            return (x1, y1, z1);
        }

        if ((x1 == x2) && (y1 == y2)) {
            (l, lz) = _jMul(x1, z1, x1, z1);
            (l, lz) = _jMul(l, lz, 3, 1);
            (l, lz) = _jAdd(l, lz, A, 1);
            (da, db) = _jMul(y1, z1, 2, 1);
        } else {
            (l, lz) = _jSub(y2, z2, y1, z1);
            (da, db) = _jSub(x2, z2, x1, z1);
        }

        (l, lz) = _jDiv(l, lz, da, db);

        (x3, da) = _jMul(l, lz, l, lz);
        (x3, da) = _jSub(x3, da, x1, z1);
        (x3, da) = _jSub(x3, da, x2, z2);

        (y3, db) = _jSub(x1, z1, x3, da);
        (y3, db) = _jMul(y3, db, l, lz);
        (y3, db) = _jSub(y3, db, y1, z1);

        if (da != db) {
            x3 = mulmod(x3, db, PP);
            y3 = mulmod(y3, da, PP);
            z3 = mulmod(da, db, PP);
        } else {
            z3 = da;
        }
    }

    function _ecDouble(uint256 x1, uint256 y1, uint256 z1) internal pure
        returns(uint256 x3, uint256 y3, uint256 z3)
    {
        (x3, y3, z3) = _ecAdd(x1, y1, z1, x1, y1, z1);
    }

    function _ecMul(uint256 d, uint256 x1, uint256 y1, uint256 z1) internal pure
        returns(uint256 x3, uint256 y3, uint256 z3)
    {
        uint256 remaining = d;
        uint256 px = x1;
        uint256 py = y1;
        uint256 pz = z1;
        uint256 acx = 0;
        uint256 acy = 0;
        uint256 acz = 1;

        if (d == 0) {
            return (0, 0, 1);
        }

        while (remaining != 0) {
            if ((remaining & 1) != 0) {
                (acx, acy, acz) = _ecAdd(acx, acy, acz, px, py, pz);
            }
            remaining = remaining / 2;
            (px, py, pz) = _ecDouble(px, py, pz);
        }

        (x3, y3, z3) = (acx, acy, acz);
    }

    function ScalarMult(uint256 px, uint256 py, uint256 scalar) public pure 
        returns(uint256 qx, uint256 qy)
    {
        uint256 x;
        uint256 y;
        uint256 z;
        (x, y, z) = _ecMul(scalar, px, py, 1);
        z = _inverse(z);
        qx = mulmod(x, z, PP);
        qy = mulmod(y, z, PP);
    }

    function ScalarBaseMult(uint256 scalar) public pure 
        returns(uint256 qx, uint256 qy)
    {
        uint256 x;
        uint256 y;
        uint256 z;
        (x, y, z) = _ecMul(scalar, GX, GY, 1);
        z = _inverse(z);
        qx = mulmod(x, z, PP);
        qy = mulmod(y, z, PP);
    }

    function HashToPoint(uint256 x1, uint256 y1) public pure 
        returns (uint256 qx, uint256 qy)
    {
        uint256 x;
        uint256 y;
        uint256 z;
        uint256 scalar = uint256(keccak256(abi.encodePacked(x1, y1)));
        (x, y, z) = _ecMul(scalar, GX, GY, 1);
        z = _inverse(z);
        qx = mulmod(x, z, PP);
        qy = mulmod(y, z, PP);
    }

    function Add(uint256 x1, uint256 y1, uint256 x2, uint256 y2) public pure
        returns (uint256 x3, uint256 y3)
    {
        uint256 x;
        uint256 y;
        uint256 z;
        (x, y, z) = _ecAdd(x1, y1, 1, x2, y2, 1);
        z = _inverse(z);
        x3 = mulmod(x, z, PP);
        y3 = mulmod(y, z, PP);
    }
}
