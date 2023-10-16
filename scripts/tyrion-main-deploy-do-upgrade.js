// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, upgrades } = require("hardhat");

const { upgradeContract } = require('./utils.js');

async function mainETH() {
    // const Tyrion = await ethers.getContractFactory('Tyrion');
    // const tyrion = await Tyrion.deploy(ethers.constants.AddressZero);
    // console.log("Tyrion", tyrion.address);
    const tyrion = {
        address: '0x881020118fb2A40B81D819eCD32C9A417d914aCA'
    }

    const registryProxyAddress = '0x996957FE80547002FcD000Add27ffE8B5E62431e';
    const brokerProxyAddress = '0xc28d813030739ecf9F5AEa1563D618215CC60181';

    const regImplAddress = upgradeContract('TyrionRegistry', registryProxyAddress);
    const brokerImplAddress = upgradeContract('TyrionBroker', brokerProxyAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
mainETH().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
