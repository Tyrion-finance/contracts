const { expect } = require("chai");

describe("TyrionBroker and TyrionRegistry", function() {
    let TyrionBroker, TyrionRegistry, tyrionBroker, tyrionRegistry, owner, addr1, addr2, addr3;

    beforeEach(async function() {
        // Get the ContractFactory and Signers here.
        TyrionBroker = await ethers.getContractFactory("TyrionBroker");
        TyrionRegistry = await ethers.getContractFactory("TyrionRegistry");

        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        // Deploy the TyrionRegistry contract first since it might be required in TyrionBroker's constructor.
        tyrionRegistry = await TyrionRegistry.deploy(/*...arguments if any...*/);

        // Deploy the TyrionBroker contract.
        tyrionBroker = await TyrionBroker.deploy(/*...arguments which might include tyrionRegistry's address...*/);
    });

    describe("TyrionRegistry", function() {
        it("Should register a new advertiser", async function() {
            await tyrionRegistry.registerAdvertiser(/*...arguments...*/);
            const advertiser = await tyrionRegistry.getAdvertiserById(1);
            expect(advertiser).to.exist;
        });

        it("Should register a new publisher", async function() {
            await tyrionRegistry.registerPublisher(/*...arguments...*/);
            const publisher = await tyrionRegistry.getPublisherById(1);
            expect(publisher).to.exist;
        });

        it("Should register a new referrer", async function() {
            await tyrionRegistry.registerReferrer(/*...arguments...*/);
            const referrer = await tyrionRegistry.getReferrerById(1);
            expect(referrer).to.exist;
        });
    });

    describe("TyrionBroker", function() {
        it("Should allow depositing tokens", async function() {
            // Assuming TYRION token is ERC20 compliant and there's a mock available for testing.
            const TYRIONMock = await ethers.getContractFactory("TYRIONMock");
            const tyrionToken = await TYRIONMock.deploy();
            await tyrionToken.mint(owner.address, 1000);

            // Approve the TyrionBroker contract to spend tokens on behalf of owner
            await tyrionToken.approve(tyrionBroker.address, 500);

            await tyrionBroker.depositTokens(1, 500);  // Assume advertiserId 1 exists.

            const advertiser = await tyrionRegistry.getAdvertiserById(1);
            expect(advertiser.balance).to.equal(350);  // 70% of 500.
        });

        it("Should allow referrers to withdraw their accrued tokens", async function() {
            // Assuming some flow where the referrer has earned tokens, e.g., through the depositTokens function.
            // For simplicity, let's directly increase the referrer's balance here.
            const referrerId = 1;  // Assume referrerId 1 exists.
            const initialBalance = await ethers.provider.getBalance(addr1.address);

            await tyrionBroker.referrerWithdraw(referrerId);

            const newBalance = await ethers.provider.getBalance(addr1.address);
            expect(newBalance).to.be.gt(initialBalance);
        });

        //... other tests, e.g., for publishers, withdrawals, etc.
    });
});
