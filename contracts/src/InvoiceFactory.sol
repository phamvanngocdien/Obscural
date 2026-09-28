// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InvoiceFactory
 * @notice Creates and manages invoices on-chain.
 *
 * Privacy architecture:
 *  - On-chain: only dataHash + addresses + amounts (Etherscan cannot read content)
 *  - Signing: EIP-712 shows full content to user when signing
 *  - Off-chain: encrypted content stored in Supabase (only sender/recipient can decrypt)
 */
contract InvoiceFactory {
    // ── Types ──

    enum Status {
        Draft,
        Sent,
        Paid,
        Overdue,
        Cancelled,
        Disputed
    }

    struct Invoice {
        uint256 id;
        address creator;
        address recipient;
        bytes32 dataHash; // keccak256(recipientName + memo + items) — unreadable on-chain
        uint256 amount;
        address token; // address(0) = ETH
        uint256 dueDate;
        Status status;
        uint256 createdAt;
        uint256 paidAt;
    }

    // ── State ──

    uint256 public nextInvoiceId;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _recipientInvoices;

    // ── Events (only hashes + addresses + amounts, never readable content) ──

    event InvoiceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        bytes32 dataHash,
        uint256 amount,
        address token
    );

    event InvoiceStatusUpdated(uint256 indexed id, Status oldStatus, Status newStatus);

    event InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount);

    // ── Errors ──

    error InvalidRecipient();
    error InvalidAmount();
    error InvoiceNotFound();
    error NotAuthorized();
    error InvalidStatusTransition();
    error AlreadyPaid();
    error InsufficientPayment();

    // ── Core Functions ──

    /**
     * @notice Create a new invoice.
     * @param recipient Recipient wallet address
     * @param dataHash  keccak256 hash of (recipientName, memo, items) — content stays private
     * @param amount    Payment amount in wei (or token smallest unit)
     * @param token     Token address (address(0) for native ETH)
     * @param dueDate   Unix timestamp for payment deadline
     */
    function createInvoice(
        address recipient,
        bytes32 dataHash,
        uint256 amount,
        address token,
        uint256 dueDate
    ) external returns (uint256 invoiceId) {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        invoiceId = nextInvoiceId++;

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            creator: msg.sender,
            recipient: recipient,
            dataHash: dataHash,
            amount: amount,
            token: token,
            dueDate: dueDate,
            status: Status.Sent,
            createdAt: block.timestamp,
            paidAt: 0
        });

        _creatorInvoices[msg.sender].push(invoiceId);
        _recipientInvoices[recipient].push(invoiceId);

        emit InvoiceCreated(invoiceId, msg.sender, recipient, dataHash, amount, token);
    }

    /**
     * @notice Pay an invoice with native ETH.
     * @param invoiceId The invoice to pay
     */
    function payInvoice(uint256 invoiceId) external payable {
        Invoice storage inv = invoices[invoiceId];
        if (inv.creator == address(0)) revert InvoiceNotFound();
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert InvalidStatusTransition();
        if (inv.token != address(0)) revert InvalidStatusTransition(); // Use payInvoiceToken for ERC20
        if (msg.value < inv.amount) revert InsufficientPayment();

        Status oldStatus = inv.status;
        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;

        // Send payment to creator
        (bool success,) = payable(inv.creator).call{value: inv.amount}("");
        require(success, "Transfer failed");

        // Refund excess
        if (msg.value > inv.amount) {
            (bool refundSuccess,) = payable(msg.sender).call{value: msg.value - inv.amount}("");
            require(refundSuccess, "Refund failed");
        }

        emit InvoiceStatusUpdated(invoiceId, oldStatus, Status.Paid);
        emit InvoicePaid(invoiceId, msg.sender, inv.amount);
    }

    /**
     * @notice Update invoice status (creator only).
     */
    function updateStatus(uint256 invoiceId, Status newStatus) external {
        Invoice storage inv = invoices[invoiceId];
        if (inv.creator == address(0)) revert InvoiceNotFound();
        if (msg.sender != inv.creator) revert NotAuthorized();
        if (inv.status == Status.Paid) revert InvalidStatusTransition();

        Status oldStatus = inv.status;
        inv.status = newStatus;

        emit InvoiceStatusUpdated(invoiceId, oldStatus, newStatus);
    }

    /**
     * @notice Verify that off-chain data matches the on-chain hash.
     */
    function verifyData(uint256 invoiceId, bytes calldata data) external view returns (bool) {
        Invoice storage inv = invoices[invoiceId];
        if (inv.creator == address(0)) revert InvoiceNotFound();
        return keccak256(data) == inv.dataHash;
    }

    // ── View Functions ──

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        Invoice storage inv = invoices[invoiceId];
        if (inv.creator == address(0)) revert InvoiceNotFound();
        return inv;
    }

    function getInvoicesByCreator(address creator) external view returns (uint256[] memory) {
        return _creatorInvoices[creator];
    }

    function getInvoicesByRecipient(address recipient) external view returns (uint256[] memory) {
        return _recipientInvoices[recipient];
    }
}
