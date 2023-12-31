const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("TyrionRegistry", function () {
    let tyrionRegistry, owner, addr1, addr2;

    beforeEach(async function () {
        const TyrionRegistry = await ethers.getContractFactory("TyrionRegistry");
        [owner, addr1, addr2] = await ethers.getSigners();
        tyrionRegistry = await TyrionRegistry.deploy();
        await tyrionRegistry.initialize();
    });

    it("Should register an advertiser", async function () {
        await expect(tyrionRegistry.registerAdvertiser(addr1.address, ZERO_ADDRESS))
            .to.emit(tyrionRegistry, "RegisteredAdvertiser")
            .withArgs(1, addr1.address, ZERO_ADDRESS);

        const advertiser = await tyrionRegistry.getAdvertiserById(1);
        expect(advertiser.wallet).to.equal(addr1.address);
    });

    it("Should register a publisher", async function () {
        await expect(tyrionRegistry.registerPublisher(addr1.address, ZERO_ADDRESS))
            .to.emit(tyrionRegistry, "RegisteredPublisher")
            .withArgs(1, addr1.address, ZERO_ADDRESS);

        const publisher = await tyrionRegistry.getPublisherById(1);
        expect(publisher.wallet).to.equal(addr1.address);
    });

    it("Should register a referrer", async function () {
        await expect(tyrionRegistry.registerReferrer(addr1.address))
            .to.emit(tyrionRegistry, "RegisteredReferrer")
            .withArgs(addr1.address);

        const referrer = await tyrionRegistry.getReferrerById(addr1.address);
        expect(referrer.wallet).to.equal(addr1.address);
    });

    it("Should modify advertiser balance", async function () {
        await tyrionRegistry.registerAdvertiser(addr1.address, ZERO_ADDRESS);
        await tyrionRegistry.modifyAdvertiserBalance(1, 50);

        const advertiser = await tyrionRegistry.getAdvertiserById(1);
        expect(advertiser.balance).to.equal(50);
    });

    it("Should modify publisher balance", async function () {
        await tyrionRegistry.registerPublisher(addr1.address, ZERO_ADDRESS);
        await tyrionRegistry.modifyPublisherBalance(1, 50);

        const publisher = await tyrionRegistry.getPublisherById(1);
        expect(publisher.balance).to.equal(50);
    });

    it("Should modify referrer balance", async function () {
        await tyrionRegistry.registerReferrer(addr1.address);
        await tyrionRegistry.modifyReferrerBalance(addr1.address, 50);

        const referrer = await tyrionRegistry.getReferrerById(addr1.address);
        expect(referrer.balance).to.equal(50);
    });
});