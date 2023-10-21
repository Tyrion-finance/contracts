const hre = require("hardhat");
const readline = require("readline");
const {ethers, upgrades} = require("hardhat");
// const { TransparentUpgradeableProxy } = require('hardhat-upgrades');

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function verifyContract(address, constructorArgs, doSleep=true) {
    if (doSleep) {
        await sleep(60);
    }

    await hre.run("verify:verify", {
        address: address,
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
    // const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    return await upgrades.erc1967.getImplementationAddress(proxyAddress);
    // const ProxyContract = await ethers.getContractAt("TransparentUpgradeableProxy", proxyAddress);
    // return await ProxyContract.implementation();
}

async function deployUpgradable(contractName, initArgs=[], verify=true) {
    const MyContractFactory = await ethers.getContractFactory(contractName);
    const deployedContract = await upgrades.deployProxy(MyContractFactory, initArgs);
    // Otherwise the contract is not yet visible on Etherscan
    await sleep(60);

    console.log("Deployed", contractName, "proxy at", deployedContract.address, "implementation at",
        await getImplementationAddress(deployedContract.address));

    if (verify) {
        await verifyContract(deployedContract.address, [], false);
    }
    return deployedContract;
}

async function upgradeContract(contractName, proxyAddress, verify=true) {
    const MyContractFactory = await ethers.getContractFactory(contractName);
    await upgrades.upgradeProxy(proxyAddress, MyContractFactory);
    await sleep(60);
    const implAddress = await getImplementationAddress(proxyAddress);

    console.log("Upgraded", contractName, "at", proxyAddress, "to", implAddress);

    if (verify) {
        await verifyContract(implAddress, [], false);
    }

    return implAddress;
}

module.exports = {
    verifyContract,
    getUserInput,
    upgradeContract,
    deployUpgradable,
    getImplementationAddress
}