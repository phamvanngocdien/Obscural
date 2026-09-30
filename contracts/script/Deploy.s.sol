// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/InvoiceFactory.sol";
import "../src/EscrowVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        InvoiceFactory invoiceFactory = new InvoiceFactory();
        EscrowVault escrowVault = new EscrowVault();

        vm.stopBroadcast();

        console.log("InvoiceFactory deployed at:", address(invoiceFactory));
        console.log("EscrowVault deployed at:", address(escrowVault));
    }
}
