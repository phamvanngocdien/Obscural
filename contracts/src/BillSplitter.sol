// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BillSplitter
 * @notice Split payments among multiple participants.
 *
 * Privacy: Only stores addresses + shares on-chain (anonymous).
 * Participant names + description stored encrypted off-chain in Supabase.
 */
contract BillSplitter {
    // ── Types ──

    enum SplitStatus {
        Active,
        Completed,
        Cancelled
    }

    struct Split {
        uint256 id;
        address creator;
        bytes32 descriptionHash; // Hash of description — not readable on-chain
        address[] participants;
        uint256[] shares; // Amount each participant owes (in wei)
        uint256 totalAmount;
        address token; // address(0) = ETH
        SplitStatus status;
        uint256 createdAt;
        mapping(address => bool) hasPaid;
        uint256 totalCollected;
    }

    // ── State ──

    uint256 public nextSplitId;
    mapping(uint256 => Split) private _splits;
    mapping(address => uint256[]) private _userSplits;

    // ── Events (only addresses + amounts, never readable content) ──

    event SplitCreated(
        uint256 indexed id,
        address indexed creator,
        bytes32 descriptionHash,
        address[] participants,
        uint256[] shares,
        uint256 totalAmount
    );

    event SharePaid(uint256 indexed splitId, address indexed participant, uint256 amount);
    event FundsWithdrawn(uint256 indexed splitId, address indexed creator, uint256 amount);
    event SplitCancelled(uint256 indexed splitId);

    // ── Errors ──

    error InvalidParticipants();
    error MismatchedArrays();
    error TotalMismatch();
    error SplitNotFound();
    error NotParticipant();
    error AlreadyPaid();
    error InsufficientPayment();
    error NotCreator();
    error InvalidStatus();
    error NothingToWithdraw();

    // ── Core Functions ──

    /**
     * @notice Create a new bill split.
     * @param descriptionHash Hash of the bill description (privacy)
     * @param participants    Array of participant wallet addresses
     * @param shares          Array of amounts each participant owes (in wei)
     * @param totalAmount     Total bill amount
     */
    function createSplit(
        bytes32 descriptionHash,
        address[] calldata participants,
        uint256[] calldata shares,
        uint256 totalAmount
    ) external returns (uint256 splitId) {
        if (participants.length < 2) revert InvalidParticipants();
        if (participants.length != shares.length) revert MismatchedArrays();

        uint256 sharesSum;
        for (uint256 i; i < shares.length; i++) {
            sharesSum += shares[i];
        }
        if (sharesSum != totalAmount) revert TotalMismatch();

        splitId = nextSplitId++;

        Split storage s = _splits[splitId];
        s.id = splitId;
        s.creator = msg.sender;
        s.descriptionHash = descriptionHash;
        s.participants = participants;
        s.shares = shares;
        s.totalAmount = totalAmount;
        s.token = address(0);
        s.status = SplitStatus.Active;
        s.createdAt = block.timestamp;

        // Track for each participant
        for (uint256 i; i < participants.length; i++) {
            _userSplits[participants[i]].push(splitId);
        }
        _userSplits[msg.sender].push(splitId);

        emit SplitCreated(splitId, msg.sender, descriptionHash, participants, shares, totalAmount);
    }

    /**
     * @notice Pay your share of the bill.
     */
    function payShare(uint256 splitId) external payable {
        Split storage s = _splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        if (s.status != SplitStatus.Active) revert InvalidStatus();

        // Find participant index
        uint256 shareAmount;
        bool found;
        for (uint256 i; i < s.participants.length; i++) {
            if (s.participants[i] == msg.sender) {
                shareAmount = s.shares[i];
                found = true;
                break;
            }
        }
        if (!found) revert NotParticipant();
        if (s.hasPaid[msg.sender]) revert AlreadyPaid();
        if (msg.value < shareAmount) revert InsufficientPayment();

        s.hasPaid[msg.sender] = true;
        s.totalCollected += shareAmount;

        // Refund excess
        if (msg.value > shareAmount) {
            (bool success,) = payable(msg.sender).call{value: msg.value - shareAmount}("");
            require(success, "Refund failed");
        }

        // Auto-complete if all paid
        bool allPaid = true;
        for (uint256 i; i < s.participants.length; i++) {
            if (!s.hasPaid[s.participants[i]]) {
                allPaid = false;
                break;
            }
        }
        if (allPaid) {
            s.status = SplitStatus.Completed;
        }

        emit SharePaid(splitId, msg.sender, shareAmount);
    }

    /**
     * @notice Creator withdraws collected funds.
     */
    function withdrawCollected(uint256 splitId) external {
        Split storage s = _splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        if (msg.sender != s.creator) revert NotCreator();
        if (s.totalCollected == 0) revert NothingToWithdraw();

        uint256 amount = s.totalCollected;
        s.totalCollected = 0;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(splitId, msg.sender, amount);
    }

    /**
     * @notice Cancel an active split (creator only, refunds paid participants).
     */
    function cancelSplit(uint256 splitId) external {
        Split storage s = _splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        if (msg.sender != s.creator) revert NotCreator();
        if (s.status != SplitStatus.Active) revert InvalidStatus();

        s.status = SplitStatus.Cancelled;

        // Refund participants who already paid
        for (uint256 i; i < s.participants.length; i++) {
            if (s.hasPaid[s.participants[i]]) {
                s.hasPaid[s.participants[i]] = false;
                (bool success,) = payable(s.participants[i]).call{value: s.shares[i]}("");
                require(success, "Refund failed");
            }
        }
        s.totalCollected = 0;

        emit SplitCancelled(splitId);
    }

    // ── View Functions ──

    function getSplitBasic(uint256 splitId)
        external
        view
        returns (
            uint256 id,
            address creator,
            bytes32 descriptionHash,
            uint256 totalAmount,
            SplitStatus status,
            uint256 totalCollected,
            uint256 createdAt
        )
    {
        Split storage s = _splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        return (s.id, s.creator, s.descriptionHash, s.totalAmount, s.status, s.totalCollected, s.createdAt);
    }

    function getSplitParticipants(uint256 splitId)
        external
        view
        returns (address[] memory participants, uint256[] memory shares)
    {
        Split storage s = _splits[splitId];
        if (s.creator == address(0)) revert SplitNotFound();
        return (s.participants, s.shares);
    }

    function hasParticipantPaid(uint256 splitId, address participant) external view returns (bool) {
        return _splits[splitId].hasPaid[participant];
    }

    function getUserSplits(address user) external view returns (uint256[] memory) {
        return _userSplits[user];
    }
}
