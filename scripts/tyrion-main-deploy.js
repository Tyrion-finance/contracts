// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const { upgradeMain, deployMain } = require('./util/tyrion-functions.js');
const { TYRION_MAINNET, TYRION_SEPOLIA } = require('./util/const.js');
const {ADDRESSES} = require("./util/const");


async function mainETH() {
    const config = ADDRESSES[hre.network.name];
    await deployMain(config.TYRION);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
