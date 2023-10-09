const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("TyrionBroker", function () {
    let tyrionToken, tyrionRegistry, tyrionBroker, owner, advertiser, publisher, referrer;

    beforeEach(async function () {
        const TyrionToken = await ethers.getContractFactory("Tyrion");
        tyrionToken = await TyrionToken.deploy(ZERO_ADDRESS);

        const TyrionRegistry = await ethers.getContractFactory("TyrionRegistry");
        tyrionRegistry = await TyrionRegistry.deploy();

        const TyrionBroker = await ethers.getContractFactory("TyrionBroker");
        [owner, advertiser, publisher, referrer] = await ethers.getSigners();
        tyrionBroker = await TyrionBroker.deploy(tyrionToken.address, tyrionRegistry.address);

        await tyrionRegistry.transferOwnership(tyrionBroker.address);

        await tyrionRegistry.registerReferrer(referrer.address);
        await tyrionRegistry.registerAdvertiser(advertiser.address, 1);
        await tyrionRegistry.registerPublisher(publisher.address, 1);

        await tyrionToken.transfer(advertiser.address, ethers.utils.parseEther("1000"));
        await tyrionToken.connect(advertiser).approve(tyrionBroker.address, ethers.utils.parseEther("1000"));
    });

    it("Should deposit tokens for an advertiser", async function () {
        const amount = ethers.utils.parseEther("100");
        await tyrionBroker.connect(advertiser).depositTokens(1, amount);
        const advertiserData = await tyrionRegistry.getAdvertiserById(1);
        expect(advertiserData.balance).to.be.gt(0);
    });

    it("Should credit a publisher", async function () {
        const amount = ethers.utils.parseEther("100");
        await tyrionBroker.connect(advertiser).depositTokens(1, amount);
        await tyrionBroker.creditPublisher(1, 1, amount.div(2));
        const publisherData = await tyrionRegistry.getPublisherById(1);
        expect(publisherData.balance).to.be.gt(0);
    });

    it("Should allow a publisher to withdraw", async function () {
        const depositAmount = ethers.utils.parseEther("100");
        const forPublisherAmount = ethers.utils.parseEther("70");
        const withdrawAmount = ethers.utils.parseEther("50");
        await tyrionBroker.connect(advertiser).depositTokens(1, depositAmount);
        await tyrionBroker.creditPublisher(1, 1, forPublisherAmount);
        await tyrionBroker.connect(publisher).publisherWithdraw(1, withdrawAmount);
        const publisherData = await tyrionRegistry.getPublisherById(1);
        expect(publisherData.balance).to.equal(forPublisherAmount.sub(withdrawAmount));
    });

    it("Should allow a referrer to withdraw", async function () {
        const amount = ethers.utils.parseEther("100");
        await tyrionBroker.connect(advertiser).depositTokens(1, amount);
        await tyrionBroker.connect(referrer).referrerWithdraw(1);
        const referrerData = await tyrionRegistry.getReferrerById(1);
        expect(referrerData.balance).to.equal(0);
    });

    it("Should modify the treasury wallet and percentages", async function () {
        const newWallet = publisher.address;
        const newPercentages = [600, 10, 20, 20];

        await tyrionBroker.setTreasuryWallet(newWallet);
        expect(await tyrionBroker.treasuryWallet()).to.equal(newWallet);

        await tyrionBroker.setPercentages(...newPercentages);
        expect(await tyrionBroker.advertiserPercentage()).to.equal(newPercentages[0]);
        expect(await tyrionBroker.burnPercentage()).to.equal(newPercentages[1]);
        expect(await tyrionBroker.referrerDepositPercentage()).to.equal(newPercentages[2]);
        expect(await tyrionBroker.publisherReferrerPercentage()).to.equal(newPercentages[3]);
    });
});