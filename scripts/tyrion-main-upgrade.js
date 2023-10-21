// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, upgrades } = require("hardhat");

const { upgradeContract } = require('./util/utils.js');
const { upgradeMain, deployMain } = require('./util/tyrion-functions.js');
const constvars = require('./util/const.js');

async function mainETH() {
    await upgradeMain(constvars.REGISTRY_SEPOLIA, constvars.BROKER_SEPOLIA);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
