// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HarvestEscrow} from "../src/HarvestEscrow.sol";

/// @notice Deploys HarvestEscrow to BNB Smart Chain Testnet (chain id 97).
/// @dev Required env vars:
///      PRIVATE_KEY  - deployer private key (owner role)
///      ORACLE_ADDRESS - trusted AI agent oracle wallet
contract DeployScript is Script {
    function run() external returns (HarvestEscrow escrow) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracle = vm.envAddress("ORACLE_ADDRESS");

        vm.startBroadcast(deployerKey);
        escrow = new HarvestEscrow(oracle);
        vm.stopBroadcast();

        console.log("HarvestEscrow deployed at:", address(escrow));
        console.log("Owner (deployer):", vm.addr(deployerKey));
        console.log("Oracle:", oracle);
    }
}
