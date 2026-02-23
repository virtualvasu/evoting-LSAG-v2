// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library MessageHashUtils {
    /**
     * @dev Returns an Ethereum Signed Message, created from a `hash`. This
     * produces hash corresponding to the one signed with the eth_sign JSON-RPC method.
     *
     * See https://eth.wiki/json-rpc/API#eth_sign
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // 32 is the length in bytes of hash,
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
