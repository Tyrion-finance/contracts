
const hre = require("hardhat");

const { verifyContract, getUserInput } = require('./utils.js');

async function mainETH() {
    const Tyrion = await hre.ethers.getContractFactory('Tyrion');
    const tyrion = await Tyrion.deploy(ethers.constants.AddressZero);
    console.log("Tyrion", tyrion.address);

    const TyrionRegistry = await hre.ethers.getContractFactory('TyrionRegistry');
    const tyrionRegistry = await TyrionRegistry.deploy();
    console.log("TyrionRegistry", tyrionRegistry.address);

    const TyrionBroker = await hre.ethers.getContractFactory('TyrionBroker');
    const tyrionBroker = await TyrionBroker.deploy(tyrion.address, tyrionRegistry.address);
    console.log("TyrionBroker", tyrionBroker.address);


    await verifyContract(tyrion, [ethers.constants.AddressZero]);
    await verifyContract(tyrionRegistry, [], false);
    await verifyContract(tyrionRegistry, [tyrion.address, tyrionRegistry.address], false);

    await tyrionRegistry.setBrokerAddress(tyrionBroker.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
