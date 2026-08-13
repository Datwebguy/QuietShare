// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo test stablecoin for QuietShare pots on Coston2.
/// @dev Public mint is intentional — this is testnet play-money for the hackathon demo,
///      not the production asset. Production path is FXRP (see README).
contract MockStable is ERC20 {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 500 * 10 ** DECIMALS;

    constructor() ERC20("QuietShare Test USD", "qUSD") {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Anyone can mint themselves faucet funds for the demo.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
