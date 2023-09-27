const { expect } = require("chai");
const { ethers } = require("hardhat");

ether = parseEther = ethers.utils.parseEther

describe("TyrionVestingTest", function() {
    let TyrionVesting, vesting, Token, token, token2, owner, beneficiary1, beneficiary2, nonExempted;

    beforeEach(async () => {
        [owner, beneficiary1, beneficiary2, nonExempted] = await ethers.getSigners();

        Token = await ethers.getContractFactory("ERC20Mock"); // Assuming you have a mock ERC20 for testing
        token = await Token.deploy("TestToken", "TTN", parseEther("1000000"));
        token2 = await Token.deploy("Token B", "TKB", ether("1000000"));

        TyrionVesting = await ethers.getContractFactory("TyrionVesting");
        vesting = await TyrionVesting.deploy();

        // console.log("deployed contracts", token, token2, vesting);
        // console.log("deployed addresses", token.address, token2.address, vesting.address);
        // console.log("deployed targets", token.target, token2.target, vesting.target);

        await token.transfer(beneficiary1.address, parseEther("10000"));
        await token.transfer(beneficiary2.address, parseEther("10000"));
        await token.transfer(nonExempted.address, parseEther("10000"));
        // await token.connect(beneficiary1).approve(vesting.target, parseEther("1000"));
    });

    it("should allow adding vesting with future start time by paying the correct fee", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100"), { value: parseEther("1") }))
            .to.emit(vesting, "VestingAdded");
    });

    it("should not allow adding vesting without the correct fee", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100")))
            .to.be.revertedWith("Fee not provided");
    });

    it("should allow adding vesting with past start time", async () => {
        let pastTime = (await ethers.provider.getBlock()).timestamp - 10000; // 10000 seconds in the past
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, pastTime, 100000, parseEther("100"), { value: parseEther("1") }))
            .to.emit(vesting, "VestingAdded");
    });

    it("should require the correct fee when non-exempted", async () => {
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(nonExempted).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(nonExempted).addVesting(nonExempted.address, token.address, futureTime, 100000, parseEther("100"), { value: parseEther("0.00001") }))
            .to.be.revertedWith("Fee not provided");
    });

    it("should allow exempted addresses to add vesting without fee", async () => {
        await vesting.setFeeExempted(beneficiary2.address, true);
        let futureTime = (await ethers.provider.getBlock()).timestamp + 10000;
        await token.connect(beneficiary2).approve(vesting.address, parseEther("100"));
        await expect(vesting.connect(beneficiary2).addVesting(beneficiary2.address, token.address, futureTime, 100000, parseEther("100")))
            .to.emit(vesting, "VestingAdded");
    });

    it("should allow beneficiaries to withdraw according to vesting schedule", async () => {
        let pastTime = (await ethers.provider.getBlock()).timestamp - 50;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, pastTime, 100, parseEther("100"), { value: parseEther("1") });

        // After half of the vesting duration (50 seconds out of 100), half the amount should be vestable
        await ethers.provider.send("evm_increaseTime", [100]);  // Fast-forward time by 50 seconds
        await ethers.provider.send("evm_mine");

        await vesting.connect(beneficiary1).withdraw(0);
        expect(await token.balanceOf(beneficiary1.address)).to.equal(parseEther("50"));
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
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, futureTime, 100000, parseEther("100"), { value: parseEther("1") });

        let vestingInfo = await vesting.getVestingById(0);
        expect(vestingInfo.beneficiary).to.equal(beneficiary1.address);
        expect(vestingInfo.token).to.equal(token.address);
    });

    it("should emit correct events when vestings are added", async () => {
        // Set up multiple vestings for beneficiary1 with different tokens
        await token.connect(beneficiary1).approve(vesting.address, ether("100"));
        await token2.connect(beneficiary1).approve(vesting.address, ether("200"));

        let startTime = (await ethers.provider.getBlock()).timestamp;

        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, startTime, 100000, ether("100"), { value: ether("1") }))
            .to.emit(vesting, "VestingAdded")
            .withArgs(beneficiary1.address, token.address, startTime, 100000, ether("100"));

        await expect(vesting.connect(beneficiary1).addVesting(beneficiary1.address, token2.address, startTime + 100, 200000, ether("200"), { value: ether("1") }))
            .to.emit(vesting, "VestingAdded")
            .withArgs(beneficiary1.address, token2.address, startTime + 100, 200000, ether("200"));
    });

    it("should allow UI to query amounts left to withdraw for a beneficiary", async () => {
        let pastTime = (await ethers.provider.getBlock()).timestamp;
        await token.connect(beneficiary1).approve(vesting.address, parseEther("100"));
        await vesting.connect(beneficiary1).addVesting(beneficiary1.address, token.address, pastTime, 100, parseEther("100"), { value: parseEther("1") });

        // After 25 seconds, 25% should have been vested
        await ethers.provider.send("evm_increaseTime", [200]);
        await ethers.provider.send("evm_mine");

        let vestingInfo = await vesting.getVestingById(0);
        let elapsed = (await ethers.provider.getBlock()).timestamp - vestingInfo.startTime;
        let vestedAmount = (vestingInfo.totalAmount * elapsed) / vestingInfo.duration;
        let amountLeftToWithdraw = vestedAmount - vestingInfo.withdrawnAmount;

        expect(amountLeftToWithdraw.toString()).to.equal(parseEther("100").toString());
    });

    it("should allow querying events to list all vestings for a beneficiary", async () => {
        // Filter for events specific to the beneficiary1
        let timestamp = (await ethers.provider.getBlock()).timestamp;
        for (ben of [beneficiary1, beneficiary2]) {
            for (tok of [token, token2]) {
                await tok.connect(ben).approve(vesting.address, parseEther("100"));
                await vesting.connect(ben).addVesting(ben.address, tok.address, timestamp, 100, parseEther("100"), {value: parseEther("1")});
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
        for (ben of [beneficiary1, beneficiary2]) {
            for (tok of [token, token2]) {
                console.log("depositing for", ben.address, tok.address);
                await tok.connect(ben).approve(vesting.address, parseEther("100"));
                await vesting.connect(ben).addVesting(ben.address, tok.address, timestamp, 100, parseEther("100"), {value: parseEther("1")});
            }
        }

        const filter = vesting.filters.VestingAdded();
        const events = await vesting.queryFilter(filter);

        const tokens = [...new Set(events.map(event => event.args.token))]; // Use Set to filter unique tokens

        expect(tokens.length).to.equal(2);
        expect(tokens).to.include(token.address);
        expect(tokens).to.include(token2.address);
    });
});
