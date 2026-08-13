// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PotVault
/// @notice On-chain shell for a QuietShare group money pot.
/// @dev By design this contract stores NO per-member balance mapping. It only tracks
///      that a pot exists, who its members are, and the pot's total token balance
///      (which is inherently public for any ERC20-holding contract). The private
///      ledger — how much of the pot belongs to each member — is computed off-chain
///      by the QuietShare Confidential Compute (TEE) service from the encrypted note
///      attached to each deposit, and is only ever served back to authenticated
///      members. See README "What is private vs public" for the full model.
contract PotVault {
    struct Pot {
        address creator;
        address token;
        bool exists;
    }

    mapping(bytes32 => Pot) public pots;
    mapping(bytes32 => mapping(address => bool)) public isMember;
    mapping(bytes32 => address[]) private potMembers;
    mapping(bytes32 => uint256) public potTotal;

    struct SpendProposal {
        bytes32 potId;
        address to;
        uint256 amount;
        string memo;
        address proposer;
        bool executed;
        mapping(address => bool) approvals;
        uint256 approvalCount;
    }

    mapping(bytes32 => SpendProposal) private proposals;
    uint256 private nextProposalNonce;

    event PotCreated(bytes32 indexed potId, address indexed creator, address token);
    event MemberJoined(bytes32 indexed potId, address indexed member);
    event Deposited(bytes32 indexed potId, address indexed depositor, uint256 amount, bytes encryptedNote);
    event SpendProposed(bytes32 indexed potId, bytes32 indexed proposalId, address indexed proposer, address to, uint256 amount, string memo);
    event SpendApproved(bytes32 indexed proposalId, address indexed approver, uint256 approvalCount);
    event SpendExecuted(bytes32 indexed proposalId, address indexed to, uint256 amount);

    modifier onlyMember(bytes32 potId) {
        require(isMember[potId][msg.sender], "QuietShare: not a pot member");
        _;
    }

    function createPot(bytes32 potId, address token) external {
        require(!pots[potId].exists, "QuietShare: pot already exists");
        require(token != address(0), "QuietShare: token required");

        pots[potId] = Pot({creator: msg.sender, token: token, exists: true});
        isMember[potId][msg.sender] = true;
        potMembers[potId].push(msg.sender);

        emit PotCreated(potId, msg.sender, token);
        emit MemberJoined(potId, msg.sender);
    }

    /// @notice Anyone holding the potId (shared via invite link) can join for the demo.
    function joinPot(bytes32 potId) external {
        require(pots[potId].exists, "QuietShare: pot does not exist");
        require(!isMember[potId][msg.sender], "QuietShare: already a member");

        isMember[potId][msg.sender] = true;
        potMembers[potId].push(msg.sender);

        emit MemberJoined(potId, msg.sender);
    }

    /// @param encryptedNote ECIES ciphertext (encrypted to the TEE service's public key)
    ///        containing {potId, member, amount, memo}. This is what lets the TEE build
    ///        a private per-member ledger without the contract ever storing it.
    function deposit(bytes32 potId, uint256 amount, bytes calldata encryptedNote) external onlyMember(potId) {
        require(amount > 0, "QuietShare: amount must be > 0");
        Pot storage pot = pots[potId];

        bool ok = IERC20(pot.token).transferFrom(msg.sender, address(this), amount);
        require(ok, "QuietShare: transfer failed");

        potTotal[potId] += amount;

        emit Deposited(potId, msg.sender, amount, encryptedNote);
    }

    function proposeSpend(bytes32 potId, address to, uint256 amount, string calldata memo)
        external
        onlyMember(potId)
        returns (bytes32 proposalId)
    {
        require(to != address(0), "QuietShare: bad recipient");
        require(amount > 0, "QuietShare: amount must be > 0");

        proposalId = keccak256(abi.encodePacked(potId, nextProposalNonce++, block.timestamp, msg.sender));

        SpendProposal storage p = proposals[proposalId];
        p.potId = potId;
        p.to = to;
        p.amount = amount;
        p.memo = memo;
        p.proposer = msg.sender;

        emit SpendProposed(potId, proposalId, msg.sender, to, amount, memo);
    }

    function approveSpend(bytes32 proposalId) external {
        SpendProposal storage p = proposals[proposalId];
        require(p.proposer != address(0), "QuietShare: unknown proposal");
        require(isMember[p.potId][msg.sender], "QuietShare: not a pot member");
        require(!p.executed, "QuietShare: already executed");
        require(!p.approvals[msg.sender], "QuietShare: already approved");

        p.approvals[msg.sender] = true;
        p.approvalCount += 1;

        emit SpendApproved(proposalId, msg.sender, p.approvalCount);

        if (p.approvalCount * 2 > potMembers[p.potId].length) {
            _executeSpend(proposalId, p);
        }
    }

    function _executeSpend(bytes32 proposalId, SpendProposal storage p) private {
        require(p.amount <= potTotal[p.potId], "QuietShare: exceeds pot balance");
        p.executed = true;
        potTotal[p.potId] -= p.amount;
        address token = pots[p.potId].token;
        bool ok = IERC20(token).transfer(p.to, p.amount);
        require(ok, "QuietShare: payout failed");
        emit SpendExecuted(proposalId, p.to, p.amount);
    }

    function members(bytes32 potId) external view returns (address[] memory) {
        return potMembers[potId];
    }

    function memberCount(bytes32 potId) external view returns (uint256) {
        return potMembers[potId].length;
    }

    function potBalance(bytes32 potId) external view returns (uint256) {
        return potTotal[potId];
    }
}
