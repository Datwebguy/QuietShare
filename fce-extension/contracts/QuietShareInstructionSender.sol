// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";

/// @title QuietShareInstructionSender
/// @author QuietShare (built on the Flare-provided fce-extension-scaffold)
/// @notice On-chain entry point for QuietShare's Confidential Compute instructions.
///
/// This is deliberately separate from PotVault.sol (which moves real ERC20 value).
/// This contract only ever forwards two things to the TEE: an encrypted per-deposit
/// note (so the TEE can build a private per-member ledger PotVault never stores),
/// and a balance query authenticated by the caller's own address. Both send
/// functions embed `msg.sender` into the message themselves — the TEE handler never
/// trusts a caller-supplied identity, only what this contract attached on-chain.
///
/// DO NOT MODIFY: constructor, setExtensionId(), _getExtensionId() (scaffold-managed).
contract QuietShareInstructionSender {
    /// @notice Operation type for all QuietShare private-ledger actions.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_QUIETSHARE = bytes32("QUIETSHARE");

    /// @notice Record a deposit's encrypted note against the private ledger.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_RECORD_DEPOSIT = bytes32("RECORD_DEPOSIT");

    /// @notice Ask the TEE for the caller's own private balance in a pot.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_GET_BALANCE = bytes32("GET_BALANCE");

    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000;

    uint256 private _extensionId;

    /// @notice Payload for RECORD_DEPOSIT — mirrors PotVault.deposit()'s encryptedNote,
    /// plus the depositor's address attached by this contract, not the caller.
    struct RecordDepositMessage {
        bytes32 potId;
        address member;
        bytes encryptedNote;
    }

    /// @notice Payload for GET_BALANCE — the pot to query, and the requester's address
    /// attached by this contract so the TEE only ever returns *your own* balance.
    struct GetBalanceMessage {
        bytes32 potId;
        address member;
    }

    constructor(
        ITeeExtensionRegistry _teeExtensionRegistry,
        ITeeMachineRegistry _teeMachineRegistry
    ) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
    }

    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");

        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    /// @notice Notify the TEE of a deposit's encrypted note so it can update the
    /// caller's private balance for `potId`. Call this right after PotVault.deposit().
    function sendRecordDeposit(bytes32 potId, bytes calldata encryptedNote) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_QUIETSHARE,
            opCommand: OP_COMMAND_RECORD_DEPOSIT,
            message: abi.encode(RecordDepositMessage({ potId: potId, member: msg.sender, encryptedNote: encryptedNote })),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
    }

    /// @notice Ask the TEE for the caller's own private balance in `potId`. Poll the
    /// TEE proxy's result endpoint with the returned instruction id to read the answer.
    function sendGetBalance(bytes32 potId) external payable returns (bytes32 instructionId) {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_QUIETSHARE,
            opCommand: OP_COMMAND_GET_BALANCE,
            message: abi.encode(GetBalanceMessage({ potId: potId, member: msg.sender })),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
    }

    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }
}
