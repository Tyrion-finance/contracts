// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const {deployUpgradable} = require("./utils");


async function mainETH() {
    const tyrion = {
        address: '0x881020118fb2A40B81D819eCD32C9A417d914aCA'
    }

    const tyrionRegistry = await deployUpgradable('TyrionRegistry', []);
    console.log("TyrionRegistry", tyrionRegistry.address);
    console.log("Implementation", await tyrionRegistry.implementation())

    const tyrionBroker = await deployUpgradable('TyrionBroker', [tyrion.address, tyrionRegistry.address]);
    console.log("TyrionBroker", tyrionBroker.address);
    console.log("Implementation", await tyrionBroker.implementation())

    await tyrionRegistry.setBrokerAddress(tyrionBroker.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
