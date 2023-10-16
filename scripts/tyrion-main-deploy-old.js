// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");


async function mainETH() {
    const tyrion_address = '0x5e27e384aCBBa20982f991893B9970AaF3f43181';

    const TyrionRegistry = await hre.ethers.getContractFactory('TyrionRegistry');
    const tyrionRegistry = await TyrionRegistry.deploy();
    console.log("TyrionRegistry", tyrionRegistry.address);

    const TyrionBroker = await hre.ethers.getContractFactory('TyrionBroker');
    const tyrionBroker = await TyrionBroker.deploy(tyrion_address, tyrionRegistry.address);
    console.log("TyrionBroker", tyrionBroker.address);

    await tyrionRegistry.setBrokerAddress(tyrionBroker.address);

    const [owner, user1, user2, user3] = await ethers.getSigners();

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
