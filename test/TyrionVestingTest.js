const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers")

ether = parseEther = ethers.utils.parseEther

async function advanceTime(time) {
    await helpers.time.increase(time)
}

function almostEqual(a, b, epsilon=.2) {
    expect(a / 10e14).to.be.closeTo(b / 10e14, epsilon);  // Amount shouldn't change
}

describe("TyrionVestingTest", function() {
    let TyrionVesting, vesting, Token, token, token2, owner, beneficiary1, beneficiary2, nonExempted;

    beforeEach(async () => {
        [owner, beneficiary1, beneficiary2, nonExempted] = await ethers.getSigners();

        Token = await ethers.getContractFactory("ERC20Mock"); // Assuming you have a mock ERC20 for testing
        token = await Token.deploy("TestToken", "TTN", parseEther("1000000"));
        token2 = await Token.deploy("Token B", "TKB", ether("1000000"));

        TyrionVesting = await ethers.getContractFactory("TyrionVesting");
        vesting = await TyrionVesting.deploy();

        for (var tok of [token, token2]) {
            await tok.transfer(beneficiary1.address, parseEther("10000"));
            await tok.transfer(beneficiary2.address, parseEther("10000"));
            await tok.transfer(nonExempted.address, parseEther("10000"));
        }
        // await token.connect(beneficiary1).approve(vesting.target, parseEther("1000"));
    });

    it("should allow adding vesting with future start time by paying the correct fee", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100"), true, { value: parseEther("1") }))
            .to.emit(vesting, "VestingAdded");
    });

    it("should not allow adding vesting without the correct fee", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100"), true))
            .to.be.revertedWith("Fee not provided");
    });

    it("should allow adding vesting with past start time", async () => {
        let pastTime = (await ethers.provider.getBlock()).timestamp - 10000; // 10000 seconds in the past
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, pastTime, 100000, parseEther("100"), true, { value: parseEther("1") }))
            .to.emit(vesting, "VestingAdded");
    });

    it("should require the correct fee when non-exempted", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(nonExempted).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(nonExempted).addVesting(nonExempted.address, token.address, futureTime, 100000, parseEther("100"), true, { value: parseEther("0.00001") }))
            .to.be.revertedWith("Fee not provided");
    });

    it("should allow exempted addresses to add vesting without fee", async () => {
        await vesting.setFeeExempted(beneficiary2.address, true);
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary2).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary2).addVesting(beneficiary2.address, token.address, futureTime, 100000, parseEther("100"), true))
            .to.emit(vesting, "VestingAdded");
    });

    it("should allow beneficiaries to withdraw according to vesting schedule", async () => {
        let startTime = (await ethers.provider.getBlock()).timestamp;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, 1000, parseEther("100"), true, { value: parseEther("1") });

        let initialBalance = await token.balanceOf(beneficiary1.address);

        // After half of the vesting duration (50 seconds out of 100), half the amount should be vestable
        await advanceTime(500);
        await vesting.connect(beneficiary1).withdraw(0, {value: parseEther("0.1")});

        let currentBalance = await token.balanceOf(beneficiary1.address);

        almostEqual(currentBalance - initialBalance, parseEther("50"), 350);
    });

    it("should allow setting vesting fee", async () => {
        await vesting.setVestingFee(parseEther("0.5"));
        expect(await vesting.vestingFee()).to.equal(parseEther("0.5"));
    });

    it("should exempt addresses from fees", async () => {
        await vesting.setFeeExempted(beneficiary2.address, true);
        expect(await vesting.isExempted(beneficiary2.address)).to.be.true;
    });

    it("should provide vesting info by vesting ID", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100"), true, { value: parseEther("1") });

        let vestingInfo = await vesting.getVestingById(0);
        expect(vestingInfo.beneficiary).to.equal(beneficiary1.address);
        expect(vestingInfo.token).to.equal(token.address);
    });

    it("should emit correct events when vestings are added", async () => {
        // Set up multiple vestings for beneficiary1 with different tokens
        await token.connect(owner).approve(vesting.address, ether("100"));
        await token2.connect(owner).approve(vesting.address, ether("200"));

        let startTime = (await ethers.provider.getBlock()).timestamp;

        await expect(vesting.addVesting(beneficiary1.address, token.address, startTime, 100000, ether("100"), true, { value: ether("1") }))
            .to.emit(vesting, "VestingAdded")
            .withArgs(0, owner.address, beneficiary1.address, token.address, startTime, 100000, ether("100"));

        await expect(vesting.addVesting(beneficiary1.address, token2.address, startTime + 100, 200000, ether("200"), true, { value: ether("1") }))
            .to.emit(vesting, "VestingAdded")
            .withArgs(1, owner.address, beneficiary1.address, token2.address, startTime + 100, 200000, ether("200"));
    });

    it("should allow UI to query amounts left to withdraw for a beneficiary", async () => {
        let startTime = (await ethers.provider.getBlock()).timestamp;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, 1000, parseEther("100"), true, { value: parseEther("1") });
        let amountLeftToWithdrawOld = await vesting.withdrawableAmount(0);

        // After 25 seconds, 25% should have been vested
        await advanceTime(250);

        let amountLeftToWithdraw = await vesting.withdrawableAmount(0);
        almostEqual(amountLeftToWithdraw, parseEther("25"), 300);
        // expect(amountLeftToWithdraw.toString()).to.equal(parseEther("25").toString());
    });

    it("should allow querying events to list all vestings for a beneficiary", async () => {
        // Filter for events specific to the beneficiary1
        let timestamp = (await ethers.provider.getBlock()).timestamp;
        for (ben of [beneficiary1, beneficiary2]) {
            for (tok of [token, token2]) {
                await tok.connect(ben).approve(vesting.address, parseEther("100"));
                await vesting.connect(ben).addVesting(ben.address, tok.address, timestamp, 100, parseEther("100"), true, {value: parseEther("1")});
            }
        }

        const filter = vesting.filters.VestingAdded(null, beneficiary1.address);
        const events = await vesting.queryFilter(filter);

        expect(events.length).to.equal(2);

        // Check event details for the first vesting
        expect(events[0].args.beneficiary).to.equal(beneficiary1.address);
        expect(events[0].args.token).to.equal(token.address);

        // Check event details for the second vesting
        expect(events[1].args.beneficiary).to.equal(beneficiary1.address);
        expect(events[1].args.token).to.equal(token2.address);
    });

    it("should allow querying events to list all tokens we have vestings for", async () => {
        let timestamp = (await ethers.provider.getBlock()).timestamp;
        for (var ben of [beneficiary1, beneficiary2]) {
            for (var tok of [token, token2]) {
                await tok.connect(ben).approve(vesting.address, parseEther("100"));
                await vesting.connect(ben).addVesting(ben.address, tok.address, timestamp, 100, parseEther("100"), true, {value: parseEther("0.5")});
            }
        }

        const filter = vesting.filters.VestingAdded();
        const events = await vesting.queryFilter(filter);

        const tokens = [...new Set(events.map(event => event.args.token))]; // Use Set to filter unique tokens

        expect(tokens.length).to.equal(2);
        expect(tokens).to.include(token.address);
        expect(tokens).to.include(token2.address);
    });

    it("should handle pause and unpause correctly", async function() {
        const amount = ethers.utils.parseEther("100");
        const duration = 86400 * 30; // 30 days
        const startTime = (await ethers.provider.getBlock('latest')).timestamp;

        // await token.transfer(vesting.address, amount);
        await token.approve(vesting.address, amount);
        await vesting.addVesting(beneficiary1.address, token.address, startTime, duration, amount, true, { value: parseEther("0.5") });
        const filter = vesting.filters.VestingAdded();
        const vestingId = (await vesting.queryFilter(filter))[0].args.vestingId;

        await advanceTime(86400 * 15);  // Fast forward 15 days

        const halfVested = ethers.utils.parseEther("50");
        await vesting.pauseVesting(vestingId, true);  // Pause the vesting
        expect(await vesting.withdrawableAmount(vestingId) / 10e14).to.be.closeTo(halfVested / 10e14, .2);

        await advanceTime(86400 * 5);  // Fast forward another 5 days

        expect(await vesting.withdrawableAmount(vestingId) / 10e14).to.be.closeTo(halfVested / 10e14, .2);  // Amount shouldn't change

        await vesting.pauseVesting(vestingId, false);  // Unpause the vesting

        await advanceTime(86400 * 15);  // Fast forward another 15 days - to after vesting end

        expect(await vesting.withdrawableAmount(vestingId)).to.equal(amount);
        // expect(await vesting.withdrawableAmount(vestingId)).to.be.closeTo(expectedAmount, 1);  // 2/3 of the tokens should have vested
    });

    describe("pauseVesting()", function() {
        it("Should pause and unpause a vesting schedule", async function() {
            let startTime = (await ethers.provider.getBlock()).timestamp;
            await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
            await vesting.connect(beneficiary1).addVesting(beneficiary2.address, token.address, startTime, 1000, parseEther("100"), true, { value: parseEther("1") });

            // Pause the vesting
            await vesting.connect(beneficiary1).pauseVesting(0, true);
            expect((await vesting.getVestingById(0)).pausedAt).to.not.equal(0);

            advanceTime(200);
            await vesting.connect(beneficiary2).withdraw(0, { value: parseEther("0.1") });  // Should fail because the vesting is paused

            // Unpause the vesting
            await vesting.connect(beneficiary1).pauseVesting(0, false);
            expect((await vesting.getVestingById(0)).pausedAt).to.equal(0);
        });
    });

    describe("changeVestingOwner()", function() {
        it("Should change the owner of a vesting schedule", async function() {
            let startTime = (await ethers.provider.getBlock()).timestamp;
            await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
            await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, 1000, parseEther("100"), true, { value: parseEther("1") });
            await vesting.connect(beneficiary1).changeVestingOwner(0, beneficiary2.address);
            expect((await vesting.getVestingById(0)).owner).to.equal(beneficiary2.address);
        });
    });

    describe("transferVestingBeneficiary()", function() {
        it("Should transfer the beneficiary of a vesting", async function() {
            let startTime = (await ethers.provider.getBlock()).timestamp;
            await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
            await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, 1000, parseEther("100"), true, { value: parseEther("1") });
            await vesting.connect(beneficiary1).transferVestingBeneficiary(0, beneficiary2.address);
            expect((await vesting.getVestingById(0)).beneficiary).to.equal(beneficiary2.address);
        });
    });

    describe("extendVesting()", function() {
        it("Should extend the duration of a vesting", async function() {
            const originalDuration = 1000; // Assuming this is the initial duration
            let startTime = (await ethers.provider.getBlock()).timestamp;
            await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
            await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, originalDuration, parseEther("100"), true, { value: parseEther("1") });

            const newDuration = originalDuration + 500;
            await vesting.connect(beneficiary1).extendVesting(0, newDuration);
            expect((await vesting.getVestingById(0)).duration).to.equal(newDuration);
        });

        it("Should not allow decreasing the vesting duration", async function() {
            const originalDuration = 1000;
            let startTime = (await ethers.provider.getBlock()).timestamp;
            await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
            await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, originalDuration, parseEther("100"), true, { value: parseEther("1") });

            const shorterDuration = originalDuration - 500;
            await expect(vesting.connect(beneficiary1).extendVesting(0, shorterDuration)).to.be.revertedWith("Duration should be greater than previous");
        });
    });

    describe("setWithdrawalFee function", function() {
        it("Should revert if caller is not the owner", async function() {
            await expect(vesting.connect(beneficiary1).setWithdrawalFee(1)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert if new fee is not less than previous", async function() {
            await expect(vesting.setWithdrawalFee(parseEther("1"))).to.be.revertedWith("New fee should be less than previous");
        });

        it("Should set new fee if conditions met", async function() {
            const oldFee = await vesting.withdrawalFee();
            const newFee = oldFee.sub(1);
            await vesting.setWithdrawalFee(newFee);
            expect(await vesting.withdrawalFee()).to.equal(newFee);
        });
    });

    describe("withdrawEth function", function() {
        it("Should revert if caller is not the owner", async function() {
            await expect(vesting.connect(beneficiary1).withdrawEth(beneficiary1.address)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should transfer all contract ETH balance to the specified address", async function() {
            const depositAmount = ethers.utils.parseEther("1");
            await owner.sendTransaction({ to: vesting.address, value: depositAmount });

            const initialBalance = await ethers.provider.getBalance(owner.address);
            await vesting.withdrawEth(owner.address);

            const finalBalance = await ethers.provider.getBalance(owner.address);
            almostEqual(finalBalance, initialBalance.add(depositAmount), 0.1);
        });
    });
});
