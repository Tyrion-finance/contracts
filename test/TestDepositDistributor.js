const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("DepositDistributor", function() {
    let DepositDistributor, depositDistributor, owner, taxWallet, addr1, addr2, addr3, addrs;

    beforeEach(async function() {
        DepositDistributor = await ethers.getContractFactory("DepositDistributor");
        [owner, taxWallet, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        depositDistributor = await DepositDistributor.deploy(taxWallet.address);
    });

    it("Should correctly set the tax wallet", async function() {
        expect(await depositDistributor.taxWallet()).to.equal(taxWallet.address);
    });

    it("Should allow owner to add recipients", async function() {
        await depositDistributor.connect(owner).addRecipient(addr1.address, 1);
        expect(await depositDistributor.recipients(addr1.address)).to.deep.equal([ethers.BigNumber.from(1), true]);

        await depositDistributor.connect(owner).addRecipient(addr2.address, 2);
        expect(await depositDistributor.recipients(addr2.address)).to.deep.equal([ethers.BigNumber.from(2), true]);
    });

    it("Should distribute correctly below the TAX_LIMIT", async function() {
        const depositValue = ethers.utils.parseEther("10");

        await depositDistributor.connect(owner).addRecipient(addr1.address, 1);
        await depositDistributor.connect(owner).addRecipient(addr2.address, 2);
        await depositDistributor.connect(owner).addRecipient(addr3.address, 1);

        await depositDistributor.deposit({ value: depositValue });
        expect(await ethers.provider.getBalance(depositDistributor.address)).to.equal(depositValue);

        expect(await ethers.provider.getBalance(taxWallet.address)).to.equal(depositValue);

        await depositDistributor.distributeFunds();

        const addr1Balance = await ethers.provider.getBalance(addr1.address);
        const addr2Balance = await ethers.provider.getBalance(addr2.address);
        const addr3Balance = await ethers.provider.getBalance(addr3.address);

        expect(addr2Balance).to.be.above(addr1Balance);
        expect(addr1Balance).to.equal(addr3Balance);
    });

    it("Should distribute correctly above the TAX_LIMIT", async function() {
        const depositValue = ethers.utils.parseEther("20");

        await depositDistributor.connect(owner).addRecipient(addr1.address, 1);
        await depositDistributor.connect(owner).addRecipient(addr2.address, 2);
        await depositDistributor.connect(owner).addRecipient(addr3.address, 1);

        await depositDistributor.deposit({ value: depositValue });
        //
        expect(await ethers.provider.getBalance(depositDistributor.address)).to.equal(ethers.utils.parseEther("5"));

        expect(await ethers.provider.getBalance(taxWallet.address)).to.equal(ethers.utils.parseEther("15"));

        await depositDistributor.distributeFunds();

        const addr1Balance = await ethers.provider.getBalance(addr1.address);
        const addr2Balance = await ethers.provider.getBalance(addr2.address);
        const addr3Balance = await ethers.provider.getBalance(addr3.address);

        expect(addr2Balance).to.be.above(addr1Balance);
        expect(addr1Balance).to.equal(addr3Balance);
    });

    // ... More tests can be added as required, for instance for removing recipients, edge cases, etc.
});
