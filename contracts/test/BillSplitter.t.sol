// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BillSplitter.sol";

contract BillSplitterTest is Test {
    BillSplitter public splitter;
    address public creator = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public charlie = address(0x4);

    bytes32 public descHash = keccak256("Team dinner");

    function setUp() public {
        splitter = new BillSplitter();
        vm.deal(creator, 10 ether);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    function _createDefaultSplit() internal returns (uint256) {
        address[] memory participants = new address[](3);
        participants[0] = alice;
        participants[1] = bob;
        participants[2] = charlie;

        uint256[] memory shares = new uint256[](3);
        shares[0] = 0.3 ether;
        shares[1] = 0.3 ether;
        shares[2] = 0.4 ether;

        vm.prank(creator);
        return splitter.createSplit(descHash, participants, shares, 1 ether);
    }

    // ── createSplit ──

    function test_createSplit() public {
        uint256 id = _createDefaultSplit();
        assertEq(id, 0);

        (,address c, bytes32 dh, uint256 total, BillSplitter.SplitStatus status,,) = splitter.getSplitBasic(id);
        assertEq(c, creator);
        assertEq(dh, descHash);
        assertEq(total, 1 ether);
        assertEq(uint8(status), uint8(BillSplitter.SplitStatus.Active));
    }

    function test_createSplit_revertsLessThan2() public {
        address[] memory participants = new address[](1);
        participants[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 1 ether;

        vm.prank(creator);
        vm.expectRevert(BillSplitter.InvalidParticipants.selector);
        splitter.createSplit(descHash, participants, shares, 1 ether);
    }

    function test_createSplit_revertsMismatch() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;
        uint256[] memory shares = new uint256[](3);
        shares[0] = 0.3 ether;
        shares[1] = 0.3 ether;
        shares[2] = 0.4 ether;

        vm.prank(creator);
        vm.expectRevert(BillSplitter.MismatchedArrays.selector);
        splitter.createSplit(descHash, participants, shares, 1 ether);
    }

    function test_createSplit_revertsTotalMismatch() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 0.3 ether;
        shares[1] = 0.3 ether;

        vm.prank(creator);
        vm.expectRevert(BillSplitter.TotalMismatch.selector);
        splitter.createSplit(descHash, participants, shares, 1 ether);
    }

    // ── payShare ──

    function test_payShare() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        assertTrue(splitter.hasParticipantPaid(id, alice));
        assertFalse(splitter.hasParticipantPaid(id, bob));
    }

    function test_payShare_refundsExcess() public {
        uint256 id = _createDefaultSplit();

        uint256 aliceBal = alice.balance;

        vm.prank(alice);
        splitter.payShare{value: 1 ether}(id);

        assertEq(alice.balance, aliceBal - 0.3 ether);
    }

    function test_payShare_revertsAlreadyPaid() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        vm.prank(alice);
        vm.expectRevert(BillSplitter.AlreadyPaid.selector);
        splitter.payShare{value: 0.3 ether}(id);
    }

    function test_payShare_revertsNotParticipant() public {
        uint256 id = _createDefaultSplit();

        vm.prank(creator);
        vm.expectRevert(BillSplitter.NotParticipant.selector);
        splitter.payShare{value: 0.3 ether}(id);
    }

    function test_payShare_autoCompletes() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        vm.prank(bob);
        splitter.payShare{value: 0.3 ether}(id);

        vm.prank(charlie);
        splitter.payShare{value: 0.4 ether}(id);

        (,,,,BillSplitter.SplitStatus status,,) = splitter.getSplitBasic(id);
        assertEq(uint8(status), uint8(BillSplitter.SplitStatus.Completed));
    }

    // ── withdrawCollected ──

    function test_withdrawCollected() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        uint256 creatorBal = creator.balance;

        vm.prank(creator);
        splitter.withdrawCollected(id);

        assertEq(creator.balance, creatorBal + 0.3 ether);
    }

    function test_withdrawCollected_revertsNotCreator() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        vm.prank(alice);
        vm.expectRevert(BillSplitter.NotCreator.selector);
        splitter.withdrawCollected(id);
    }

    // ── cancelSplit ──

    function test_cancelSplit_refundsPaidParticipants() public {
        uint256 id = _createDefaultSplit();

        vm.prank(alice);
        splitter.payShare{value: 0.3 ether}(id);

        uint256 aliceBal = alice.balance;

        vm.prank(creator);
        splitter.cancelSplit(id);

        assertEq(alice.balance, aliceBal + 0.3 ether);

        (,,,,BillSplitter.SplitStatus status,,) = splitter.getSplitBasic(id);
        assertEq(uint8(status), uint8(BillSplitter.SplitStatus.Cancelled));
    }
}
