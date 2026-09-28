// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EscrowVault
 * @notice Locks funds for invoice payments with dispute resolution and auto-release.
 *
 * Flow: Deposit → (wait) → Release / Dispute → Resolve
 * Privacy: only emits IDs + addresses + amounts, never readable content.
 */
contract EscrowVault {
    // ── Types ──

    enum EscrowStatus {
        None,
        Deposited,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    struct Escrow {
        uint256 invoiceId;
        address depositor;
        address recipient;
        uint256 amount;
        address token;
        EscrowStatus status;
        uint256 depositedAt;
        uint256 releaseAfter; // Auto-release timestamp
        bytes32 disputeReasonHash; // Hash of dispute reason (not readable on-chain)
    }

    // ── State ──

    address public admin;
    uint256 public defaultTimeout = 7 days;
    uint256 public disputeWindow = 3 days;

    mapping(uint256 => Escrow) public escrows; // invoiceId => Escrow

    // ── Events ──

    event Deposited(uint256 indexed invoiceId, address indexed depositor, uint256 amount);
    event Released(uint256 indexed invoiceId, address indexed recipient, uint256 amount);
    event Refunded(uint256 indexed invoiceId, address indexed depositor, uint256 amount);
    event Disputed(uint256 indexed invoiceId, address indexed disputer, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed invoiceId, address indexed releasedTo, uint256 amount);

    // ── Errors ──

    error NotAdmin();
    error EscrowExists();
    error EscrowNotFound();
    error NotDepositor();
    error NotParticipant();
    error InvalidStatus();
    error TooEarlyToRelease();
    error DisputeWindowClosed();

    // ── Modifiers ──

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ── Core Functions ──

    /**
     * @notice Deposit ETH into escrow for an invoice.
     * @param invoiceId The invoice this escrow is for
     * @param recipient Who receives funds on release
     */
    function deposit(uint256 invoiceId, address recipient) external payable {
        if (escrows[invoiceId].status != EscrowStatus.None) revert EscrowExists();
        if (msg.value == 0) revert InvalidStatus();

        escrows[invoiceId] = Escrow({
            invoiceId: invoiceId,
            depositor: msg.sender,
            recipient: recipient,
            amount: msg.value,
            token: address(0),
            status: EscrowStatus.Deposited,
            depositedAt: block.timestamp,
            releaseAfter: block.timestamp + defaultTimeout,
            disputeReasonHash: bytes32(0)
        });

        emit Deposited(invoiceId, msg.sender, msg.value);
    }

    /**
     * @notice Release escrowed funds to recipient. Can be called by depositor or after timeout.
     */
    function release(uint256 invoiceId) external {
        Escrow storage esc = escrows[invoiceId];
        if (esc.status != EscrowStatus.Deposited) revert InvalidStatus();

        // Depositor can release anytime; anyone can release after timeout
        if (msg.sender != esc.depositor && block.timestamp < esc.releaseAfter) {
            revert TooEarlyToRelease();
        }

        esc.status = EscrowStatus.Released;

        (bool success,) = payable(esc.recipient).call{value: esc.amount}("");
        require(success, "Transfer failed");

        emit Released(invoiceId, esc.recipient, esc.amount);
    }

    /**
     * @notice Refund escrowed funds to depositor (depositor only, before release).
     */
    function refund(uint256 invoiceId) external {
        Escrow storage esc = escrows[invoiceId];
        if (esc.status != EscrowStatus.Deposited) revert InvalidStatus();
        if (msg.sender != esc.depositor) revert NotDepositor();

        esc.status = EscrowStatus.Refunded;

        (bool success,) = payable(esc.depositor).call{value: esc.amount}("");
        require(success, "Transfer failed");

        emit Refunded(invoiceId, esc.depositor, esc.amount);
    }

    /**
     * @notice Raise a dispute. Only depositor or recipient within the dispute window.
     * @param reasonHash Hash of the dispute reason (stored as hash, not readable)
     */
    function dispute(uint256 invoiceId, bytes32 reasonHash) external {
        Escrow storage esc = escrows[invoiceId];
        if (esc.status != EscrowStatus.Deposited) revert InvalidStatus();
        if (msg.sender != esc.depositor && msg.sender != esc.recipient) revert NotParticipant();
        if (block.timestamp > esc.depositedAt + disputeWindow) revert DisputeWindowClosed();

        esc.status = EscrowStatus.Disputed;
        esc.disputeReasonHash = reasonHash;

        emit Disputed(invoiceId, msg.sender, reasonHash);
    }

    /**
     * @notice Resolve a dispute (admin only).
     * @param releaseToRecipient If true, funds go to recipient; otherwise refunded to depositor
     */
    function resolveDispute(uint256 invoiceId, bool releaseToRecipient) external onlyAdmin {
        Escrow storage esc = escrows[invoiceId];
        if (esc.status != EscrowStatus.Disputed) revert InvalidStatus();

        esc.status = EscrowStatus.Resolved;
        address to = releaseToRecipient ? esc.recipient : esc.depositor;

        (bool success,) = payable(to).call{value: esc.amount}("");
        require(success, "Transfer failed");

        emit DisputeResolved(invoiceId, to, esc.amount);
    }

    // ── View ──

    function getEscrow(uint256 invoiceId) external view returns (Escrow memory) {
        Escrow storage esc = escrows[invoiceId];
        if (esc.status == EscrowStatus.None) revert EscrowNotFound();
        return esc;
    }

    // ── Admin ──

    function setDefaultTimeout(uint256 _timeout) external onlyAdmin {
        defaultTimeout = _timeout;
    }

    function setDisputeWindow(uint256 _window) external onlyAdmin {
        disputeWindow = _window;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}
