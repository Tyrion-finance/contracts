const hre = require("hardhat");
const readline = require("readline");
const {ethers, upgrades} = require("hardhat");

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function verifyContract(contractObj, constructorArgs, doSleep=true) {
    if (doSleep) {
        await sleep(60);
    }

    await hre.run("verify:verify", {
        address: contractObj.address,
        constructorArguments: constructorArgs
    });
}

function getUserInput(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(promptText, (input) => {
            resolve(input);
            rl.close();
        });
    });
}

async function getImplementationAddress(proxyAddress) {
    const ProxyContract = await ethers.getContractAt('TransparentUpgradeableProxy', proxyAddress);
    return await ProxyContract.implementation();
}

async function deployUpgradable(contractName, initArgs=[]) {
    const MyContractFactory = await ethers.getContractFactory(contractName);
    const deployedContract = await upgrades.deployProxy(MyContractFactory, initArgs);

    await verifyContract(deployedContract.address, []);
    return deployedContract;
}

async function upgradeContract(contractName, proxyAddress) {
    const MyContractFactory = await ethers.getContractFactory(contractName);
    await upgrades.upgradeProxy(proxyAddress, MyContractFactory);
    const implAddress = getImplementationAddress(registryProxyAddress);

    await verifyContract(implAddress, []);
    return implAddress;
}

module.exports = {
    verifyContract,
    getUserInput,
    upgradeContract,
    deployUpgradable
}