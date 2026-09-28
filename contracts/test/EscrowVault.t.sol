// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EscrowVault.sol";

contract EscrowVaultTest is Test {
    EscrowVault public vault;
    address public depositor = address(0x1);
    address public recipient = address(0x2);
    address public admin;

    function setUp() public {
        vault = new EscrowVault();
        admin = address(this);
        vm.deal(depositor, 10 ether);
    }

    // ── deposit ──

    function test_deposit() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        EscrowVault.Escrow memory esc = vault.getEscrow(1);
        assertEq(esc.depositor, depositor);
        assertEq(esc.recipient, recipient);
        assertEq(esc.amount, 1 ether);
        assertEq(uint8(esc.status), uint8(EscrowVault.EscrowStatus.Deposited));
    }

    function test_deposit_revertsIfExists() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.prank(depositor);
        vm.expectRevert(EscrowVault.EscrowExists.selector);
        vault.deposit{value: 1 ether}(1, recipient);
    }

    // ── release ──

    function test_release_byDepositor() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        uint256 recipientBal = recipient.balance;

        vm.prank(depositor);
        vault.release(1);

        assertEq(recipient.balance, recipientBal + 1 ether);
        EscrowVault.Escrow memory esc = vault.getEscrow(1);
        assertEq(uint8(esc.status), uint8(EscrowVault.EscrowStatus.Released));
    }

    function test_release_afterTimeout() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        // Warp past timeout
        vm.warp(block.timestamp + 8 days);

        // Anyone can release after timeout
        vault.release(1);

        EscrowVault.Escrow memory esc = vault.getEscrow(1);
        assertEq(uint8(esc.status), uint8(EscrowVault.EscrowStatus.Released));
    }

    function test_release_revertsTooEarly() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        // Non-depositor tries to release before timeout
        vm.prank(recipient);
        vm.expectRevert(EscrowVault.TooEarlyToRelease.selector);
        vault.release(1);
    }

    // ── refund ──

    function test_refund() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        uint256 depositorBal = depositor.balance;

        vm.prank(depositor);
        vault.refund(1);

        assertEq(depositor.balance, depositorBal + 1 ether);
    }

    function test_refund_revertsNotDepositor() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.prank(recipient);
        vm.expectRevert(EscrowVault.NotDepositor.selector);
        vault.refund(1);
    }

    // ── dispute ──

    function test_dispute() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        bytes32 reasonHash = keccak256("Work not delivered");

        vm.prank(depositor);
        vault.dispute(1, reasonHash);

        EscrowVault.Escrow memory esc = vault.getEscrow(1);
        assertEq(uint8(esc.status), uint8(EscrowVault.EscrowStatus.Disputed));
        assertEq(esc.disputeReasonHash, reasonHash);
    }

    function test_dispute_revertsAfterWindow() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.warp(block.timestamp + 4 days);

        vm.prank(depositor);
        vm.expectRevert(EscrowVault.DisputeWindowClosed.selector);
        vault.dispute(1, keccak256("late"));
    }

    // ── resolveDispute ──

    function test_resolveDispute_toRecipient() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.prank(depositor);
        vault.dispute(1, keccak256("reason"));

        uint256 recipientBal = recipient.balance;

        vault.resolveDispute(1, true);

        assertEq(recipient.balance, recipientBal + 1 ether);
    }

    function test_resolveDispute_toDepositor() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.prank(depositor);
        vault.dispute(1, keccak256("reason"));

        uint256 depositorBal = depositor.balance;

        vault.resolveDispute(1, false);

        assertEq(depositor.balance, depositorBal + 1 ether);
    }

    function test_resolveDispute_revertsNotAdmin() public {
        vm.prank(depositor);
        vault.deposit{value: 1 ether}(1, recipient);

        vm.prank(depositor);
        vault.dispute(1, keccak256("reason"));

        vm.prank(depositor);
        vm.expectRevert(EscrowVault.NotAdmin.selector);
        vault.resolveDispute(1, true);
    }
}
