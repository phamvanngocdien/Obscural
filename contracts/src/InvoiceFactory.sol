// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* ── Minimal interfaces ── */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @dev Lightweight SafeERC20 — handles non-standard tokens (e.g. USDT)
 *      that may not return a bool from transferFrom.
 */
library SafeERC20 {
    error SafeERC20TransferFailed();

    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        (bool callSuccess, bytes memory returnData) = address(token).call(
            abi.encodeWithSelector(token.transferFrom.selector, from, to, amount)
        );
        // Call must succeed AND (return nothing OR return true)
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert SafeERC20TransferFailed();
        }
    }
}

/**
 * @title InvoiceFactory
 * @notice Creates and manages invoices on-chain.
 *
 * Security improvements:
 *  - ReentrancyGuard (defense-in-depth)
 *  - Strict state-machine transitions
 *  - ERC-20 token payment support
 *  - dueDate validation
 *  - Access control per action (creator vs recipient)
 *
 * Privacy architecture:
 *  - On-chain: only dataHash + addresses + amounts (Etherscan cannot read content)
 *  - Signing: EIP-712 shows full content to user when signing
 *  - Off-chain: encrypted content stored in Supabase (only sender/recipient can decrypt)
 */
contract InvoiceFactory {
    // ── Reentrancy Guard ──

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // ── Types ──

    enum Status {
        Draft,      // 0
        Sent,       // 1
        Paid,       // 2
        Overdue,    // 3
        Cancelled,  // 4
        Disputed    // 5
    }

    struct Invoice {
        uint256 id;
        address creator;
        address recipient;
        bytes32 dataHash;   // keccak256(recipientName + memo + items) — unreadable on-chain
        uint256 amount;
        address token;      // address(0) = native ETH
        uint256 dueDate;
        Status  status;
        uint256 createdAt;
        uint256 paidAt;
    }

    // ── State ──

    uint256 public nextInvoiceId;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _recipientInvoices;

    // ── Events ──

    event InvoiceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        bytes32 dataHash,
        uint256 amount,
        address token
    );

    event InvoiceStatusUpdated(uint256 indexed id, Status oldStatus, Status newStatus);

    event InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount, address token);

    // ── Errors ──

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidDueDate();
    error InvalidToken();
    error InvoiceNotFound();
    error NotAuthorized();
    error InvalidStatusTransition();
    error AlreadyPaid();
    error InsufficientPayment();
    error EthTransferFailed();
    error OnlyRecipientCanPay();
    error InvoiceOverdue();

    // ── Modifiers ──

    modifier invoiceExists(uint256 invoiceId) {
        if (invoices[invoiceId].creator == address(0)) revert InvoiceNotFound();
        _;
    }

    // ── Core Functions ──

    /**
     * @notice Create a new invoice.
     * @param recipient Recipient wallet address
     * @param dataHash  keccak256 hash of (recipientName, memo, items) — content stays private
     * @param amount    Payment amount in wei (or token smallest unit)
     * @param token     Token address (address(0) for native ETH)
     * @param dueDate   Unix timestamp for payment deadline (must be in the future)
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
        if (dueDate != 0 && dueDate <= block.timestamp) revert InvalidDueDate();
        if (token != address(0) && token.code.length == 0) revert InvalidToken();

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
     * @notice Pay an invoice with native ETH. Only the invoice recipient can pay.
     * @param invoiceId The invoice to pay
     */
    function payInvoice(uint256 invoiceId)
        external
        payable
        nonReentrant
        invoiceExists(invoiceId)
    {
        Invoice storage inv = invoices[invoiceId];

        // Access control: only recipient can pay
        if (msg.sender != inv.recipient) revert OnlyRecipientCanPay();

        // Status checks
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert InvalidStatusTransition();
        if (inv.token != address(0)) revert InvalidStatusTransition(); // Use payInvoiceToken for ERC-20

        // Due date check
        if (inv.dueDate != 0 && block.timestamp > inv.dueDate) revert InvoiceOverdue();

        // Amount check
        if (msg.value < inv.amount) revert InsufficientPayment();

        // CEI: update state BEFORE external calls
        Status oldStatus = inv.status;
        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;

        // Transfer payment to creator
        (bool success,) = payable(inv.creator).call{value: inv.amount}("");
        if (!success) revert EthTransferFailed();

        // Refund excess
        if (msg.value > inv.amount) {
            (bool refundOk,) = payable(msg.sender).call{value: msg.value - inv.amount}("");
            if (!refundOk) revert EthTransferFailed();
        }

        emit InvoiceStatusUpdated(invoiceId, oldStatus, Status.Paid);
        emit InvoicePaid(invoiceId, msg.sender, inv.amount, address(0));
    }

    /**
     * @notice Pay an invoice with an ERC-20 token. Only the invoice recipient can pay.
     *         Caller must have approved this contract for >= inv.amount beforehand.
     * @param invoiceId The invoice to pay
     */
    function payInvoiceToken(uint256 invoiceId)
        external
        nonReentrant
        invoiceExists(invoiceId)
    {
        Invoice storage inv = invoices[invoiceId];

        // Access control
        if (msg.sender != inv.recipient) revert OnlyRecipientCanPay();

        // Status checks
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert InvalidStatusTransition();
        if (inv.token == address(0)) revert InvalidStatusTransition(); // Use payInvoice for ETH

        // Due date check
        if (inv.dueDate != 0 && block.timestamp > inv.dueDate) revert InvoiceOverdue();

        // CEI: update state BEFORE external call
        Status oldStatus = inv.status;
        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;

        // Transfer tokens from payer to creator (SafeERC20 handles non-standard tokens like USDT)
        SafeERC20.safeTransferFrom(IERC20(inv.token), msg.sender, inv.creator, inv.amount);

        emit InvoiceStatusUpdated(invoiceId, oldStatus, Status.Paid);
        emit InvoicePaid(invoiceId, msg.sender, inv.amount, inv.token);
    }

    /**
     * @notice Cancel an invoice. Only the creator can cancel, and only from Sent or Disputed.
     */
    function cancelInvoice(uint256 invoiceId) external invoiceExists(invoiceId) {
        Invoice storage inv = invoices[invoiceId];
        if (msg.sender != inv.creator) revert NotAuthorized();

        // Only allow cancel from Sent or Disputed
        if (inv.status != Status.Sent && inv.status != Status.Disputed) {
            revert InvalidStatusTransition();
        }

        Status oldStatus = inv.status;
        inv.status = Status.Cancelled;

        emit InvoiceStatusUpdated(invoiceId, oldStatus, Status.Cancelled);
    }

    /**
     * @notice Dispute an invoice. Either creator or recipient can dispute, only from Sent or Overdue.
     */
    function disputeInvoice(uint256 invoiceId) external invoiceExists(invoiceId) {
        Invoice storage inv = invoices[invoiceId];

        // Only creator or recipient can dispute
        if (msg.sender != inv.creator && msg.sender != inv.recipient) revert NotAuthorized();

        // Only from Sent or Overdue
        if (inv.status != Status.Sent && inv.status != Status.Overdue) {
            revert InvalidStatusTransition();
        }

        Status oldStatus = inv.status;
        inv.status = Status.Disputed;

        emit InvoiceStatusUpdated(invoiceId, oldStatus, Status.Disputed);
    }

    /**
     * @notice Mark an invoice as overdue. Anyone can call this if the due date has passed.
     *         Only transitions from Sent → Overdue.
     */
    function markOverdue(uint256 invoiceId) external invoiceExists(invoiceId) {
        Invoice storage inv = invoices[invoiceId];

        if (inv.status != Status.Sent) revert InvalidStatusTransition();
        if (inv.dueDate == 0 || block.timestamp <= inv.dueDate) revert InvalidStatusTransition();

        inv.status = Status.Overdue;

        emit InvoiceStatusUpdated(invoiceId, Status.Sent, Status.Overdue);
    }

    /**
     * @notice Verify that off-chain data matches the on-chain hash.
     */
    function verifyData(uint256 invoiceId, bytes calldata data)
        external
        view
        invoiceExists(invoiceId)
        returns (bool)
    {
        return keccak256(data) == invoices[invoiceId].dataHash;
    }

    // ── View Functions ──

    function getInvoice(uint256 invoiceId)
        external
        view
        invoiceExists(invoiceId)
        returns (Invoice memory)
    {
        return invoices[invoiceId];
    }

    function getInvoicesByCreator(address creator) external view returns (uint256[] memory) {
        return _creatorInvoices[creator];
    }

    function getInvoicesByRecipient(address recipient) external view returns (uint256[] memory) {
        return _recipientInvoices[recipient];
    }

    /**
     * @notice Check if an invoice is past its due date.
     */
    function isOverdue(uint256 invoiceId)
        external
        view
        invoiceExists(invoiceId)
        returns (bool)
    {
        Invoice storage inv = invoices[invoiceId];
        if (inv.status == Status.Paid || inv.status == Status.Cancelled) return false;
        return inv.dueDate != 0 && block.timestamp > inv.dueDate;
    }
}
