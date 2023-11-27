const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("TyrionBroker", function () {
    let tyrionToken, tyrionRegistry, tyrionBroker, fundsManager, owner, advertiser, publisher, referrer;

    beforeEach(async function () {
        const TyrionToken = await ethers.getContractFactory("Tyrion");
        tyrionToken = await TyrionToken.deploy(ZERO_ADDRESS);

        const TyrionRegistry = await ethers.getContractFactory("TyrionRegistry");
        tyrionRegistry = await TyrionRegistry.deploy();
        await tyrionRegistry.initialize();

        const TyrionBroker = await ethers.getContractFactory("TyrionBroker");
        [owner, advertiser, publisher, referrer, fundsManager] = await ethers.getSigners();
        tyrionBroker = await TyrionBroker.deploy();
        await tyrionBroker.initialize(tyrionToken.address, tyrionRegistry.address);
        await tyrionBroker.setFundsManager(fundsManager.address);

        await tyrionRegistry.setBrokerAddress(tyrionBroker.address);

        // await tyrionRegistry.registerReferrer(referrer.address);
        await tyrionRegistry.registerAdvertiser(advertiser.address, referrer.address);
        await tyrionRegistry.registerPublisher(publisher.address, referrer.address);

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
        await tyrionBroker.connect(fundsManager).creditPublisher(1, 1, amount.div(2));
        const publisherData = await tyrionRegistry.getPublisherById(1);
        expect(publisherData.balance).to.be.gt(0);
    });

    it("Should allow a publisher to withdraw", async function () {
        const depositAmount = ethers.utils.parseEther("100");
        const forPublisherAmount = ethers.utils.parseEther("70");
        const withdrawAmount = ethers.utils.parseEther("50");
        await tyrionBroker.connect(advertiser).depositTokens(1, depositAmount);
        await tyrionBroker.connect(fundsManager).creditPublisher(1, 1, forPublisherAmount);
        await tyrionBroker.connect(publisher).publisherWithdraw(1, withdrawAmount);
        const publisherData = await tyrionRegistry.getPublisherById(1);
        expect(publisherData.balance).to.equal(forPublisherAmount.sub(withdrawAmount));
    });

    it("Should allow a referrer to withdraw", async function () {
        const amount = ethers.utils.parseEther("100");
        await tyrionBroker.connect(advertiser).depositTokens(1, amount);
        const referrerDataPre = await tyrionRegistry.getReferrerById(referrer.address);
        expect(referrerDataPre.balance).to.gt(0);

        await tyrionBroker.connect(referrer).referrerWithdraw(referrer.address);
        const referrerData = await tyrionRegistry.getReferrerById(referrer.address);
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

    describe("withdrawAllTokens", function() {
        beforeEach(async function() {
            // Let's deposit some tokens to the contract to simulate the real-world scenario.
            // Assuming you have a deposit function in your contract. If not, adapt as necessary.
            const amount = ethers.utils.parseEther("100");
            await tyrionToken.transfer(tyrionBroker.address, amount);
        });

        it("Should allow owner to withdraw all tokens", async function() {
            const initialOwnerBalance = await tyrionToken.balanceOf(owner.address);
            const initialContractBalance = await tyrionToken.balanceOf(tyrionBroker.address);

            await expect(initialContractBalance).to.be.gt(0); // Make sure the contract has some tokens.

            await tyrionBroker.connect(owner).withdrawAllTokens();

            const finalOwnerBalance = await tyrionToken.balanceOf(owner.address);
            const finalContractBalance = await tyrionToken.balanceOf(tyrionBroker.address);

            expect(finalContractBalance).to.equal(0);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(initialContractBalance));
        });

        it("Should not allow non-owner to withdraw all tokens", async function() {
            await expect(tyrionBroker.connect(advertiser).withdrawAllTokens()).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});