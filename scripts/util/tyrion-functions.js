const {upgradeContract, deployUpgradable, getImplementationAddress} = require("./utils");
const {ADDRESSES} = require("./const");
const hre = require("hardhat");

async function upgradeMain(registryProxyAddress, brokerProxyAddress, verify=true) {
    const regImplAddress = await upgradeContract('TyrionRegistry', registryProxyAddress, verify);
    const brokerImplAddress = await upgradeContract('TyrionBroker', brokerProxyAddress, verify);
}

async function deployMain(tyrionAddress, verify=true) {
    const tyrionRegistry = await deployUpgradable('TyrionRegistry', [], verify);
    const tyrionBroker = await deployUpgradable('TyrionBroker', [tyrionAddress, tyrionRegistry.address], verify);

    await tyrionRegistry.setBrokerAddress(tyrionBroker.address);
    await tyrionBroker.setFundsManager(ADDRESSES[hre.network.name].SERVER)

    return {
        registry: tyrionRegistry.address,
        broker: tyrionBroker.address
    }
}

module.exports = {
    upgradeMain,
    deployMain
}