// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title UsernameRegistry
/// @notice A tiny, standalone display-name registry — deliberately independent
/// of PotVault.sol so adding it never requires redeploying (and orphaning)
/// any existing pot. Anyone can set the name shown for their own address;
/// nobody can set one for anyone else. Names are just as public as addresses
/// already are on chain — this doesn't change what's private (each member's
/// balance, still TEE-only) vs public (who's who), it just makes the public
/// side more readable.
contract UsernameRegistry {
    uint256 public constant MAX_NAME_LENGTH = 32;

    mapping(address => string) public nameOf;

    event NameSet(address indexed account, string name);

    /// @notice Set (or clear, with an empty string) the display name shown
    /// for the caller's own address. No registration, no uniqueness check —
    /// this is a convenience label, not an identity system.
    function setName(string calldata name) external {
        require(bytes(name).length <= MAX_NAME_LENGTH, "UsernameRegistry: name too long");
        nameOf[msg.sender] = name;
        emit NameSet(msg.sender, name);
    }
}
