// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/InvoiceFactory.sol";

contract InvoiceFactoryTest is Test {
    InvoiceFactory public factory;
    address public creator = address(0x1);
    address public recipient = address(0x2);
    address public payer = address(0x3);

    bytes32 public dataHash = keccak256(abi.encode("Nguyen Van A", "Logo design", "[]"));

    function setUp() public {
        factory = new InvoiceFactory();
        vm.deal(creator, 10 ether);
        vm.deal(payer, 10 ether);
    }

    // ── createInvoice ──

    function test_createInvoice() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        assertEq(id, 0);

        InvoiceFactory.Invoice memory inv = factory.getInvoice(id);
        assertEq(inv.creator, creator);
        assertEq(inv.recipient, recipient);
        assertEq(inv.dataHash, dataHash);
        assertEq(inv.amount, 0.5 ether);
        assertEq(uint8(inv.status), uint8(InvoiceFactory.Status.Sent));
    }

    function test_createInvoice_emitsEvent() public {
        vm.prank(creator);
        vm.expectEmit(true, true, true, true);
        emit InvoiceFactory.InvoiceCreated(0, creator, recipient, dataHash, 0.5 ether, address(0));
        factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);
    }

    function test_createInvoice_revertsZeroRecipient() public {
        vm.prank(creator);
        vm.expectRevert(InvoiceFactory.InvalidRecipient.selector);
        factory.createInvoice(address(0), dataHash, 0.5 ether, address(0), block.timestamp + 30 days);
    }

    function test_createInvoice_revertsSelfRecipient() public {
        vm.prank(creator);
        vm.expectRevert(InvoiceFactory.InvalidRecipient.selector);
        factory.createInvoice(creator, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);
    }

    function test_createInvoice_revertsZeroAmount() public {
        vm.prank(creator);
        vm.expectRevert(InvoiceFactory.InvalidAmount.selector);
        factory.createInvoice(recipient, dataHash, 0, address(0), block.timestamp + 30 days);
    }

    // ── payInvoice ──

    function test_payInvoice() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        uint256 creatorBalBefore = creator.balance;

        vm.prank(payer);
        factory.payInvoice{value: 0.5 ether}(id);

        InvoiceFactory.Invoice memory inv = factory.getInvoice(id);
        assertEq(uint8(inv.status), uint8(InvoiceFactory.Status.Paid));
        assertEq(creator.balance, creatorBalBefore + 0.5 ether);
    }

    function test_payInvoice_refundsExcess() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        uint256 payerBalBefore = payer.balance;

        vm.prank(payer);
        factory.payInvoice{value: 1 ether}(id);

        // Payer should only lose 0.5 ETH
        assertEq(payer.balance, payerBalBefore - 0.5 ether);
    }

    function test_payInvoice_revertsAlreadyPaid() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        vm.prank(payer);
        factory.payInvoice{value: 0.5 ether}(id);

        vm.prank(payer);
        vm.expectRevert(InvoiceFactory.AlreadyPaid.selector);
        factory.payInvoice{value: 0.5 ether}(id);
    }

    function test_payInvoice_revertsInsufficientPayment() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        vm.prank(payer);
        vm.expectRevert(InvoiceFactory.InsufficientPayment.selector);
        factory.payInvoice{value: 0.1 ether}(id);
    }

    // ── updateStatus ──

    function test_updateStatus() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        vm.prank(creator);
        factory.updateStatus(id, InvoiceFactory.Status.Cancelled);

        InvoiceFactory.Invoice memory inv = factory.getInvoice(id);
        assertEq(uint8(inv.status), uint8(InvoiceFactory.Status.Cancelled));
    }

    function test_updateStatus_revertsNotCreator() public {
        vm.prank(creator);
        uint256 id = factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);

        vm.prank(payer);
        vm.expectRevert(InvoiceFactory.NotAuthorized.selector);
        factory.updateStatus(id, InvoiceFactory.Status.Cancelled);
    }

    // ── verifyData ──

    function test_verifyData() public {
        vm.prank(creator);
        bytes memory data = abi.encode("Nguyen Van A", "Logo design", "[]");
        uint256 id = factory.createInvoice(recipient, keccak256(data), 0.5 ether, address(0), block.timestamp + 30 days);

        assertTrue(factory.verifyData(id, data));
        assertFalse(factory.verifyData(id, abi.encode("wrong")));
    }

    // ── View helpers ──

    function test_getInvoicesByCreator() public {
        vm.startPrank(creator);
        factory.createInvoice(recipient, dataHash, 0.5 ether, address(0), block.timestamp + 30 days);
        factory.createInvoice(recipient, dataHash, 1 ether, address(0), block.timestamp + 30 days);
        vm.stopPrank();

        uint256[] memory ids = factory.getInvoicesByCreator(creator);
        assertEq(ids.length, 2);
    }
}
