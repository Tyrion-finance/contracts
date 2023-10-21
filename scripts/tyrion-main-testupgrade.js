
const hre = require("hardhat");

const { verifyContract, getUserInput } = require('./util/utils.js');
const {deployMain, upgradeMain} = require("./util/tyrion-functions");
const {TYRION_MAINNET} = require("./util/const");

async function mainETH() {
    const { registry, broker } = await deployMain(TYRION_MAINNET, false);
    await upgradeMain(registry, broker, false);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
