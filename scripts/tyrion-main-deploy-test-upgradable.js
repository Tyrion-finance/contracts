
const { ethers, upgrades } = require("hardhat");

const { getImplementationAddress, verifyContract, deployUpgradable } = require('./utils.js');


async function mainETH() {
    // const Tyrion = await ethers.getContractFactory('Tyrion');
    // const tyrion = await Tyrion.deploy(ethers.constants.AddressZero);
    // console.log("Tyrion", tyrion.address);
    const tyrion = {
        // address: '0x881020118fb2A40B81D819eCD32C9A417d914aCA'
        address: '0x5e27e384aCBBa20982f991893B9970AaF3f43181'
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
