const {upgradeContract, deployUpgradable, getImplementationAddress} = require("./utils");
const {ADDRESSES} = require("./const");
const hre = require("hardhat");
const {ethers} = require("hardhat");

async function upgradeMain(registryProxyAddress, brokerProxyAddress, verify=true) {
    const regImplAddress = await upgradeContract('TyrionRegistry', registryProxyAddress, verify);
    const brokerImplAddress = await upgradeContract('TyrionBroker', brokerProxyAddress, verify);
}

async function deployMain(tyrionAddress, verify=true) {
    const tyrionRegistry = await deployUpgradable('TyrionRegistry', [], verify);
    // const registryAddy = '0xA8AD0C99003231501B5F0aFa0e4d67796E0627Df';
    const tyrionBroker = await deployUpgradable('TyrionBroker', [tyrionAddress, tyrionRegistry.address], verify);
    // const tyrionBroker = await deployUpgradable('TyrionBroker', [tyrionAddress, registryAddy], verify);

    await tyrionRegistry.setBrokerAddress(tyrionBroker.address);
    await tyrionBroker.setFundsManager(ADDRESSES[hre.network.name].SERVER);
    await tyrionBroker.setTreasuryWallet('0x9696c4F77bEc513595680fb4F4D2708A93796E9d');

    return {
        registry: registryAddy,
        broker: tyrionBroker.address
    }
}

async function deployMainTmp(tyrionAddress, verify=true) {
    // const tyrionRegistry = await deployUpgradable('TyrionRegistry', [], verify);
    const registryAddy = '0xA8AD0C99003231501B5F0aFa0e4d67796E0627Df';

    const tyrionBroker = await ethers.getContractAt('TyrionBroker', '0x3E1E360B4ea6bc6D3A4698BaEC85c115c16F055B');
    const tyrionRegistry = await ethers.getContractAt('TyrionRegistry', '0xA8AD0C99003231501B5F0aFa0e4d67796E0627Df');

    await tyrionRegistry.setBrokerAddress('0x3E1E360B4ea6bc6D3A4698BaEC85c115c16F055B');
    await tyrionBroker.setFundsManager(ADDRESSES[hre.network.name].SERVER);
    await tyrionBroker.setTreasuryWallet('0x9696c4F77bEc513595680fb4F4D2708A93796E9d');

    return {
        registry: registryAddy,
        broker: tyrionBroker.address
    }
}


module.exports = {
    upgradeMain,
    deployMain
}